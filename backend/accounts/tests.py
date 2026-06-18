from unittest.mock import patch, MagicMock

from django.contrib.auth.tokens import default_token_generator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TestCase
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import Account, HostDetail, TravellerDetail
from accounts.serializers import AccountRegisterSerializer
from accounts.services import auth


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_uid_token(user):
    """Return (uidb64, token) for activation or password-reset links."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return uid, token


def _small_file(name="doc.png"):
    return SimpleUploadedFile(name, b"fake-content", content_type="image/png")


# ---------------------------------------------------------------------------
# Shared account builder (used by classes that don't extend a base)
# ---------------------------------------------------------------------------

_seq = 0


def _create_account(role=Account.Role.TRAVELLER, *, active=True, password="Pass1234!", **kwargs):
    global _seq
    _seq += 1
    user = Account.objects.create(
        email=kwargs.pop("email", f"user-{_seq}@example.com"),
        role=role,
        first_name=kwargs.pop("first_name", "Test"),
        last_name=kwargs.pop("last_name", "User"),
        is_active=active,
        **kwargs,
    )
    if password:
        user.set_password(password)
        user.save(update_fields=["password"])
    return user


# ===========================================================================
# EXISTING — keep intact
# ===========================================================================

class AuthTaskDispatchTests(TestCase):
    account_seq = 0

    def setUp(self):
        self.client = APIClient()

    def create_user(self, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        raw_password = overrides.pop("raw_password", "CurrentPass123!")
        defaults = {
            "email": f"user-{seq}@example.com",
            "role": Account.Role.TRAVELLER,
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
        }
        defaults.update(overrides)
        user = Account.objects.create(**defaults)
        user.set_password(raw_password)
        user.save(update_fields=["password"])
        return user

    @patch("accounts.services.auth.send_activation_email_task.delay")
    def test_register_user_queues_activation_email_on_commit(self, mocked_delay):
        serializer = AccountRegisterSerializer(
            data={
                "email": "new-user@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "role": Account.Role.TRAVELLER,
            }
        )
        serializer.is_valid(raise_exception=True)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            user = auth.register_user(serializer)
            mocked_delay.assert_not_called()

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        mocked_delay.assert_called_once_with(user.id)

    @patch("accounts.services.auth.send_password_reset_task.delay")
    def test_password_reset_request_defers_email_until_commit(self, mocked_delay):
        user = self.create_user(email="reset-me@example.com")

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            with transaction.atomic():
                auth.request_password_reset(user.email)
                mocked_delay.assert_not_called()

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        mocked_delay.assert_called_once_with(user.id)

    @patch("accounts.tasks.send_password_changed_task.delay")
    def test_password_change_view_queues_email_on_commit(self, mocked_delay):
        user = self.create_user(email="password-change@example.com")
        self.client.force_authenticate(user=user)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            response = self.client.post(
                reverse("accounts:password-change"),
                {
                    "current_password": "CurrentPass123!",
                    "new_password": "UpdatedPass123!",
                    "confirm_password": "UpdatedPass123!",
                },
                format="json",
            )
            mocked_delay.assert_not_called()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        mocked_delay.assert_called_once_with(user.id)


# ===========================================================================
# REGISTRATION
# ===========================================================================

class RegistrationTests(TestCase):
    URL = "accounts:register"

    def setUp(self):
        self.client = APIClient()

    def _valid_payload(self, **overrides):
        data = {
            "email": "register@example.com",
            "password": "StrongPass123!",
            "confirm_password": "StrongPass123!",
            "role": Account.Role.TRAVELLER,
        }
        data.update(overrides)
        return data

    @patch("accounts.services.auth.send_activation_email_task.delay")
    def test_valid_registration_creates_inactive_user(self, _mock):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse(self.URL), self._valid_payload(), format="json"
            )
        self.assertEqual(response.status_code, 201)
        user = Account.objects.get(email="register@example.com")
        self.assertFalse(user.is_active)
        self.assertEqual(user.role, Account.Role.TRAVELLER)

    def test_missing_email_returns_400(self):
        payload = self._valid_payload()
        del payload["email"]
        response = self.client.post(reverse(self.URL), payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_invalid_email_format_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            self._valid_payload(email="not-an-email"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    @patch("accounts.services.auth.send_activation_email_task.delay")
    def test_duplicate_email_returns_400(self, _mock):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse(self.URL), self._valid_payload(), format="json")
        response = self.client.post(
            reverse(self.URL), self._valid_payload(), format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_password_mismatch_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            self._valid_payload(confirm_password="DifferentPass999!"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_weak_password_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            self._valid_payload(password="123", confirm_password="123"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_role_registration_is_rejected(self):
        response = self.client.post(
            reverse(self.URL),
            self._valid_payload(role=Account.Role.ADMIN),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Account.objects.filter(email="register@example.com").exists())


# ===========================================================================
# LOGIN
# ===========================================================================

class LoginTests(TestCase):
    URL = "accounts:login"
    PASSWORD = "TestPass123!"

    def setUp(self):
        self.client = APIClient()
        self.user = _create_account(
            email="login@example.com", active=True, password=self.PASSWORD
        )

    def test_valid_credentials_return_access_token(self):
        response = self.client.post(
            reverse(self.URL),
            {"email": "login@example.com", "password": self.PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("user", response.data)
        self.assertIn("refresh_token", response.cookies)

    def test_wrong_password_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            {"email": "login@example.com", "password": "wrongpassword"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_nonexistent_email_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            {"email": "nobody@example.com", "password": self.PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_inactive_account_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        response = self.client.post(
            reverse(self.URL),
            {"email": "login@example.com", "password": self.PASSWORD},
            format="json",
        )
        self.assertIn(response.status_code, [400, 401])

    def test_email_is_case_insensitive(self):
        response = self.client.post(
            reverse(self.URL),
            {"email": "LOGIN@EXAMPLE.COM", "password": self.PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


# ===========================================================================
# EMAIL ACTIVATION
# ===========================================================================

class EmailActivationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create inactive user (as registration would produce)
        self.user = _create_account(email="activate@example.com", active=False)

    def _activation_url(self, uid, token):
        return reverse("accounts:activate-account", kwargs={"uidb64": uid, "token": token})

    def test_valid_token_activates_account(self):
        uid, token = _make_uid_token(self.user)
        response = self.client.get(self._activation_url(uid, token))
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_invalid_token_returns_400(self):
        uid, _ = _make_uid_token(self.user)
        response = self.client.get(self._activation_url(uid, "bad-token"))
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_tampered_uid_returns_400(self):
        _, token = _make_uid_token(self.user)
        response = self.client.get(self._activation_url("invaliduid", token))
        self.assertEqual(response.status_code, 400)

    def test_already_active_account_returns_400(self):
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])
        uid, token = _make_uid_token(self.user)
        response = self.client.get(self._activation_url(uid, token))
        self.assertEqual(response.status_code, 400)


# ===========================================================================
# TOKEN REFRESH
# ===========================================================================

class TokenRefreshTests(TestCase):
    PASSWORD = "TestPass123!"

    def setUp(self):
        self.client = APIClient()
        self.user = _create_account(
            email="refresh@example.com", active=True, password=self.PASSWORD
        )

    def _obtain_refresh_cookie(self):
        """Log in and return the refresh token string from the cookie."""
        response = self.client.post(
            reverse("accounts:login"),
            {"email": "refresh@example.com", "password": self.PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.cookies["refresh_token"].value

    def test_valid_cookie_returns_new_access_token(self):
        refresh = self._obtain_refresh_cookie()
        self.client.cookies["refresh_token"] = refresh
        response = self.client.post(reverse("accounts:token-refresh"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_missing_cookie_returns_401(self):
        response = self.client.post(reverse("accounts:token-refresh"))
        self.assertEqual(response.status_code, 401)

    def test_invalid_token_string_returns_401(self):
        self.client.cookies["refresh_token"] = "this.is.not.a.valid.jwt"
        response = self.client.post(reverse("accounts:token-refresh"))
        self.assertEqual(response.status_code, 401)


# ===========================================================================
# PASSWORD RESET
# ===========================================================================

class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _create_account(email="reset@example.com", active=True)

    def _confirm_url(self, uid, token):
        return reverse(
            "accounts:password-reset-confirm",
            kwargs={"uidb64": uid, "token": token},
        )

    @patch("accounts.services.auth.send_password_reset_task.delay")
    def test_valid_email_queues_reset_email_on_commit(self, mocked_delay):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("accounts:password-reset-request"),
                {"email": "reset@example.com"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        mocked_delay.assert_called_once_with(self.user.id)

    def test_unknown_email_responds_200_without_error(self):
        response = self.client.post(
            reverse("accounts:password-reset-request"),
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_valid_reset_token_updates_password(self):
        uid, token = _make_uid_token(self.user)
        new_password = "NewSecure99!"
        response = self.client.post(
            self._confirm_url(uid, token),
            {"new_password": new_password, "confirm_password": new_password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

    def test_invalid_token_on_confirm_returns_400(self):
        uid, _ = _make_uid_token(self.user)
        response = self.client.post(
            self._confirm_url(uid, "bad-token"),
            {"new_password": "NewSecure99!", "confirm_password": "NewSecure99!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_password_mismatch_on_confirm_returns_400(self):
        uid, token = _make_uid_token(self.user)
        response = self.client.post(
            self._confirm_url(uid, token),
            {"new_password": "NewSecure99!", "confirm_password": "Different99!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


# ===========================================================================
# PASSWORD CHANGE
# ===========================================================================

class PasswordChangeTests(TestCase):
    OLD_PASSWORD = "OldPass123!"
    NEW_PASSWORD = "NewPass123!"
    URL = "accounts:password-change"

    def setUp(self):
        self.client = APIClient()
        self.user = _create_account(
            email="chpass@example.com", active=True, password=self.OLD_PASSWORD
        )
        self.client.force_authenticate(user=self.user)

    def test_correct_current_password_updates_password(self):
        response = self.client.post(
            reverse(self.URL),
            {
                "current_password": self.OLD_PASSWORD,
                "new_password": self.NEW_PASSWORD,
                "confirm_password": self.NEW_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.NEW_PASSWORD))

    def test_wrong_current_password_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            {
                "current_password": "WrongPass999!",
                "new_password": self.NEW_PASSWORD,
                "confirm_password": self.NEW_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_new_password_mismatch_returns_400(self):
        response = self.client.post(
            reverse(self.URL),
            {
                "current_password": self.OLD_PASSWORD,
                "new_password": self.NEW_PASSWORD,
                "confirm_password": "Mismatch99!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_request_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse(self.URL),
            {
                "current_password": self.OLD_PASSWORD,
                "new_password": self.NEW_PASSWORD,
                "confirm_password": self.NEW_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 401)


# ===========================================================================
# PERMISSION BOUNDARIES
# ===========================================================================

class PermissionBoundaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.traveller = _create_account(role=Account.Role.TRAVELLER)
        self.host_user = _create_account(role=Account.Role.HOST)
        self.admin = _create_account(
            role=Account.Role.ADMIN, is_admin=True, is_staff=True
        )

    def test_unauthenticated_me_returns_401(self):
        response = self.client.get(reverse("accounts:me"))
        self.assertEqual(response.status_code, 401)

    def test_traveller_cannot_access_host_basic_profile_endpoint(self):
        self.client.force_authenticate(user=self.traveller)
        response = self.client.patch(
            reverse("accounts:host-basic-profile"),
            {"first_name": "Test"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_host_cannot_access_traveller_basic_profile_endpoint(self):
        self.client.force_authenticate(user=self.host_user)
        response = self.client.patch(
            reverse("accounts:traveller-basic-profile"),
            {"first_name": "Test"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_traveller_cannot_access_admin_host_list(self):
        self.client.force_authenticate(user=self.traveller)
        response = self.client.get(reverse("accounts:admin-host-list"))
        self.assertEqual(response.status_code, 403)

    def test_host_cannot_access_admin_user_list(self):
        self.client.force_authenticate(user=self.host_user)
        response = self.client.get(reverse("accounts:admin-user-list"))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_admin_host_list(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("accounts:admin-host-list"))
        self.assertEqual(response.status_code, 200)


# ===========================================================================
# TRAVELLER ONBOARDING
# ===========================================================================

class TravellerOnboardingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.traveller = _create_account(role=Account.Role.TRAVELLER)
        self.client.force_authenticate(user=self.traveller)

    def test_basic_profile_saves_name_phone_country_city(self):
        response = self.client.patch(
            reverse("accounts:traveller-basic-profile"),
            {
                "first_name": "Girish",
                "last_name": "Thapa",
                "phone": "9800000000",
                "country": "Nepal",
                "city": "Pokhara",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.traveller.refresh_from_db()
        self.assertEqual(self.traveller.first_name, "Girish")
        self.assertEqual(self.traveller.city, "Pokhara")

    def test_basic_profile_missing_required_field_returns_400(self):
        response = self.client.patch(
            reverse("accounts:traveller-basic-profile"),
            {
                "first_name": "Girish",
                # last_name, phone, country, city are missing
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_preferences_creates_traveller_detail(self):
        # Step 1 must be completed before step 2 is accessible
        self.traveller.onboarding_step = 1
        self.traveller.save(update_fields=["onboarding_step"])

        response = self.client.post(
            reverse("accounts:traveller-preferences"),
            {
                "preferred_activities": ["hiking", "cultural"],
                "preferred_min_budget": "500.00",
                "preferred_max_budget": "5000.00",
                "preferred_trip_style": "solo",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            TravellerDetail.objects.filter(user=self.traveller).exists()
        )

    def test_preferences_budget_min_greater_than_max_returns_400(self):
        response = self.client.post(
            reverse("accounts:traveller-preferences"),
            {
                "preferred_min_budget": "9000.00",
                "preferred_max_budget": "1000.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_host_cannot_access_traveller_preferences_endpoint(self):
        host_user = _create_account(role=Account.Role.HOST)
        self.client.force_authenticate(user=host_user)
        response = self.client.post(
            reverse("accounts:traveller-preferences"),
            {"preferred_trip_style": "solo"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


# ===========================================================================
# HOST ONBOARDING
# ===========================================================================

class HostOnboardingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host_user = _create_account(role=Account.Role.HOST)
        self.client.force_authenticate(user=self.host_user)

    def test_basic_profile_saves_name_and_phone(self):
        response = self.client.patch(
            reverse("accounts:host-basic-profile"),
            {
                "first_name": "Hari",
                "last_name": "Host",
                "phone": "9811111111",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.host_user.refresh_from_db()
        self.assertEqual(self.host_user.first_name, "Hari")
        self.assertEqual(self.host_user.phone, "9811111111")

    def test_basic_profile_missing_required_field_returns_400(self):
        response = self.client.patch(
            reverse("accounts:host-basic-profile"),
            {"first_name": "Hari"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_business_info_creates_host_detail(self):
        # Step 1 must be completed before step 2 is accessible
        self.host_user.onboarding_step = 1
        self.host_user.save(update_fields=["onboarding_step"])

        response = self.client.post(
            reverse("accounts:host-business-info"),
            {
                "business_name": "Lakeside Adventures",
                "business_address": "Lakeside, Pokhara",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            HostDetail.objects.filter(user=self.host_user).exists()
        )

    def test_business_info_missing_required_fields_returns_400(self):
        response = self.client.post(
            reverse("accounts:host-business-info"),
            {"business_phone": "9800000000"},  # missing business_name + business_address
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_document_upload_requires_at_least_one_file(self):
        # Create HostDetail first (step 2 must complete before step 3)
        HostDetail.objects.create(
            user=self.host_user,
            business_name="Test Co",
            verification_status=HostDetail.VerificationStatus.NOT_SUBMITTED,
        )
        response = self.client.post(
            reverse("accounts:host-documents"),
            {},  # no files
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    @patch("accounts.services.onboarding.compress_image", side_effect=lambda f: f)
    @patch("accounts.services.onboarding.validate_file")
    def test_uploading_all_documents_sets_verification_pending(self, _mock_validate, _mock_compress):
        HostDetail.objects.create(
            user=self.host_user,
            business_name="Test Co",
            verification_status=HostDetail.VerificationStatus.NOT_SUBMITTED,
        )
        response = self.client.post(
            reverse("accounts:host-documents"),
            {
                "citizenship_file": _small_file("citizenship.png"),
                "pan_file": _small_file("pan.png"),
                "business_license_file": _small_file("license.png"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        host_detail = HostDetail.objects.get(user=self.host_user)
        self.assertEqual(
            host_detail.verification_status,
            HostDetail.VerificationStatus.PENDING,
        )

    def test_traveller_cannot_access_host_business_info_endpoint(self):
        traveller = _create_account(role=Account.Role.TRAVELLER)
        self.client.force_authenticate(user=traveller)
        response = self.client.post(
            reverse("accounts:host-business-info"),
            {"business_name": "Fake Co", "business_address": "Somewhere"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
