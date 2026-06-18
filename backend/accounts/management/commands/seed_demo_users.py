import os
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import AdminDetail, HostDetail, HostDocument, TravellerDetail


SAFE_ENV_NAMES = {
    "local",
    "dev",
    "development",
    "staging",
    "test",
    "testing",
    "ci",
}


class Command(BaseCommand):
    help = (
        "Seed deterministic demo personas for frontend/API testing "
        "(superuser, admin, traveller, host)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--super-email", default="super@connectnepal.com")
        parser.add_argument("--admin-email", default="admin@connectnepal.com")
        parser.add_argument("--traveller-email", default="traveller@connectnepal.com")
        parser.add_argument("--host-email", default="host@connectnepal.com")
        parser.add_argument(
            "--with-docs",
            action="store_true",
            help="Create dummy host verification docs if missing.",
        )
        parser.add_argument(
            "--approve-host",
            action="store_true",
            help="Set host verification_status=approved.",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset persona passwords from env vars/defaults.",
        )
        parser.add_argument(
            "--force-role-sync",
            action="store_true",
            help="If an existing user has a different role, update it instead of failing.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Execute seeding logic and rollback all DB changes.",
        )
        parser.add_argument(
            "--allow-prod",
            action="store_true",
            help="Allow command in non-dev environments (dangerous).",
        )

    def handle(self, *args, **opts):
        self._enforce_safety(allow_prod=opts["allow_prod"])

        super_email = self._normalize_email(opts["super_email"])
        admin_email = self._normalize_email(opts["admin_email"])
        traveller_email = self._normalize_email(opts["traveller_email"])
        host_email = self._normalize_email(opts["host_email"])
        emails = [super_email, admin_email, traveller_email, host_email]
        if len(set(emails)) != len(emails):
            raise CommandError(
                "Demo persona emails must be unique. "
                f"Received: super={super_email}, admin={admin_email}, "
                f"traveller={traveller_email}, host={host_email}"
            )

        super_pw = self._get_password_from_env("SEED_SUPER_PASSWORD", "Hello@123")
        admin_pw = self._get_password_from_env("SEED_ADMIN_PASSWORD", "Hello@123")
        traveller_pw = self._get_password_from_env("SEED_TRAVELLER_PASSWORD", "Hello@123")
        host_pw = self._get_password_from_env("SEED_HOST_PASSWORD", "Hello@123")

        summary = {
            "users": {"created": 0, "updated": 0, "unchanged": 0},
            "details": {"created": 0, "updated": 0, "unchanged": 0},
            "documents": {"created": 0, "updated": 0, "unchanged": 0},
        }

        User = get_user_model()

        with transaction.atomic():
            super_user, super_status = self._upsert_account(
                email=super_email,
                role=User.Role.ADMIN,
                password=super_pw,
                reset_passwords=opts["reset_passwords"],
                force_role_sync=opts["force_role_sync"],
                fields={
                    "first_name": "System",
                    "last_name": "Owner",
                    "is_active": True,
                    "is_staff": True,
                    "is_admin": True,
                    "is_superadmin": True,
                },
            )
            super_flag_status = self._sync_superuser_flag(
                user=super_user,
                should_be_superuser=True,
            )
            summary["users"][self._merge_status(super_status, super_flag_status)] += 1

            _, super_detail_status = self._upsert_detail(
                AdminDetail,
                lookup={"user": super_user},
                defaults={"admin_level": "system_owner"},
            )
            summary["details"][super_detail_status] += 1

            admin_user, admin_status = self._upsert_account(
                email=admin_email,
                role=User.Role.ADMIN,
                password=admin_pw,
                reset_passwords=opts["reset_passwords"],
                force_role_sync=opts["force_role_sync"],
                fields={
                    "first_name": "Platform",
                    "last_name": "Admin",
                    "is_active": True,
                    "is_staff": True,
                    "is_admin": True,
                    "is_superadmin": False,
                },
            )
            admin_flag_status = self._sync_superuser_flag(
                user=admin_user,
                should_be_superuser=False,
            )
            summary["users"][self._merge_status(admin_status, admin_flag_status)] += 1

            _, admin_detail_status = self._upsert_detail(
                AdminDetail,
                lookup={"user": admin_user},
                defaults={"admin_level": "ops_admin"},
            )
            summary["details"][admin_detail_status] += 1

            traveller, traveller_status = self._upsert_account(
                email=traveller_email,
                role=User.Role.TRAVELLER,
                password=traveller_pw,
                reset_passwords=opts["reset_passwords"],
                force_role_sync=opts["force_role_sync"],
                fields={
                    "first_name": "Demo",
                    "last_name": "Traveller",
                    "is_active": True,
                    "has_completed_onboarding": True,
                    "onboarding_step": 99,
                    "country": "Nepal",
                    "city": "Kathmandu",
                },
            )
            summary["users"][traveller_status] += 1

            _, traveller_detail_status = self._upsert_detail(
                TravellerDetail,
                lookup={"user": traveller},
                defaults={
                    "emergency_contact": "+9779800000000",
                    "preferred_activities": ["Hiking", "Cultural Tours", "Food"],
                    "preferred_min_budget": Decimal("5000.00"),
                    "preferred_max_budget": Decimal("25000.00"),
                    "preferred_trip_style": "Budget Traveler",
                },
            )
            summary["details"][traveller_detail_status] += 1

            host, host_status = self._upsert_account(
                email=host_email,
                role=User.Role.HOST,
                password=host_pw,
                reset_passwords=opts["reset_passwords"],
                force_role_sync=opts["force_role_sync"],
                fields={
                    "first_name": "Demo",
                    "last_name": "Host",
                    "is_active": True,
                    "country": "Nepal",
                    "city": "Pokhara",
                },
            )
            summary["users"][host_status] += 1

            host_detail, host_detail_status = self._upsert_detail(
                HostDetail,
                lookup={"user": host},
                defaults={
                    "business_name": "Demo Tours Nepal",
                    "business_address": "Lakeside, Pokhara",
                    "business_phone": "+9779811111111",
                    "about_service": "Guided tours, trekking, and cultural experiences.",
                    "verification_status": HostDetail.VerificationStatus.PENDING,
                },
            )
            summary["details"][host_detail_status] += 1

            if opts["approve_host"]:
                approval_status = self._sync_host_approval(host_detail=host_detail, admin=admin_user)
                summary["details"][approval_status] += 1

            if opts["with_docs"]:
                status_one = self._ensure_host_document(
                    host_detail=host_detail,
                    doc_type=HostDocument.DocumentType.CITIZENSHIP,
                    filename="citizenship_demo.txt",
                    content=b"Demo citizenship doc for testing",
                )
                status_two = self._ensure_host_document(
                    host_detail=host_detail,
                    doc_type=HostDocument.DocumentType.BUSINESS_LICENSE,
                    filename="business_license_demo.txt",
                    content=b"Demo business license doc for testing",
                )
                summary["documents"][status_one] += 1
                summary["documents"][status_two] += 1

            if opts["dry_run"]:
                transaction.set_rollback(True)

        mode = "DRY RUN complete (no changes persisted)." if opts["dry_run"] else "Seed complete."
        style = self.style.WARNING if opts["dry_run"] else self.style.SUCCESS
        self.stdout.write(style(mode))
        self.stdout.write(f"Superuser: {super_email}")
        self.stdout.write(f"Admin:     {admin_email}")
        self.stdout.write(f"Traveller: {traveller_email}")
        self.stdout.write(f"Host:      {host_email}")
        self.stdout.write(
            "Users    -> created={created}, updated={updated}, unchanged={unchanged}".format(
                **summary["users"]
            )
        )
        self.stdout.write(
            "Details  -> created={created}, updated={updated}, unchanged={unchanged}".format(
                **summary["details"]
            )
        )
        self.stdout.write(
            "Documents-> created={created}, updated={updated}, unchanged={unchanged}".format(
                **summary["documents"]
            )
        )
        self.stdout.write("Credentials:")
        self.stdout.write(f"  superuser -> {super_email} / {super_pw}")
        self.stdout.write(f"  admin     -> {admin_email} / {admin_pw}")
        self.stdout.write(f"  traveller -> {traveller_email} / {traveller_pw}")
        self.stdout.write(f"  host      -> {host_email} / {host_pw}")
        if not opts["reset_passwords"]:
            self.stdout.write(
                self.style.WARNING(
                    "Passwords above are guaranteed for newly created users. "
                    "Use --reset-passwords to force-sync existing user passwords."
                )
            )

    def _upsert_account(
        self,
        *,
        email,
        role,
        password,
        reset_passwords,
        force_role_sync,
        fields,
    ):
        User = get_user_model()
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User(email=email, role=role, **fields)
            user.set_password(password)
            user.save()
            return user, "created"

        changed_fields = []

        if user.role != role:
            if not force_role_sync:
                raise CommandError(
                    f"User {email} already exists with role '{user.role}', expected '{role}'. "
                    "Use --force-role-sync to override."
                )
            user.role = role
            changed_fields.append("role")

        for field, value in fields.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed_fields.append(field)

        if reset_passwords:
            user.set_password(password)
            user.save()
            return user, "updated"

        if changed_fields:
            user.save(update_fields=sorted(set(changed_fields)))
            return user, "updated"

        return user, "unchanged"

    def _upsert_detail(self, model, *, lookup, defaults):
        obj, created = model.objects.get_or_create(**lookup, defaults=defaults)
        if created:
            return obj, "created"

        changed_fields = []
        for field, value in defaults.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed_fields.append(field)

        if changed_fields:
            obj.save(update_fields=changed_fields)
            return obj, "updated"

        return obj, "unchanged"

    def _sync_superuser_flag(self, *, user, should_be_superuser):
        if user.is_superuser != should_be_superuser:
            user.is_superuser = should_be_superuser
            user.save(update_fields=["is_superuser"])
            return "updated"
        return "unchanged"

    @staticmethod
    def _merge_status(primary, secondary):
        if primary == "created" or secondary == "created":
            return "created"
        if primary == "updated" or secondary == "updated":
            return "updated"
        return "unchanged"

    def _sync_host_approval(self, *, host_detail, admin):
        changed_fields = []

        if host_detail.verification_status != HostDetail.VerificationStatus.APPROVED:
            host_detail.verification_status = HostDetail.VerificationStatus.APPROVED
            changed_fields.append("verification_status")

        if host_detail.verified_by_id != admin.id:
            host_detail.verified_by = admin
            changed_fields.append("verified_by")

        if host_detail.verification_remarks != "Approved by seed command.":
            host_detail.verification_remarks = "Approved by seed command."
            changed_fields.append("verification_remarks")

        if host_detail.verified_at is None:
            host_detail.verified_at = timezone.now()
            changed_fields.append("verified_at")

        if changed_fields:
            host_detail.save(update_fields=changed_fields)
            return "updated"

        return "unchanged"

    def _ensure_host_document(self, *, host_detail, doc_type, filename, content):
        doc, created = HostDocument.objects.get_or_create(
            host=host_detail,
            document_type=doc_type,
        )

        if created and not doc.file_path:
            transaction.on_commit(
                lambda pk=doc.pk, name=filename, payload=content: self._save_document_file(
                    doc_pk=pk,
                    filename=name,
                    content=payload,
                )
            )
            return "created"

        if not created and not doc.file_path:
            transaction.on_commit(
                lambda pk=doc.pk, name=filename, payload=content: self._save_document_file(
                    doc_pk=pk,
                    filename=name,
                    content=payload,
                )
            )
            return "updated"

        return "unchanged"

    @staticmethod
    def _save_document_file(*, doc_pk, filename, content):
        doc = HostDocument.objects.get(pk=doc_pk)
        doc.file_path.save(filename, ContentFile(content), save=True)

    def _enforce_safety(self, *, allow_prod):
        env_name = (
            os.getenv("DJANGO_ENV")
            or os.getenv("APP_ENV")
            or os.getenv("ENV")
            or os.getenv("ENVIRONMENT")
            or ""
        ).strip().lower()

        if settings.DEBUG or env_name in SAFE_ENV_NAMES:
            return

        if allow_prod:
            self.stderr.write(
                self.style.WARNING(
                    "Running seed command in non-dev environment because --allow-prod was provided."
                )
            )
            return

        raise CommandError(
            "Refusing to seed demo data in this environment. "
            "Use --allow-prod only if you intentionally want this."
        )

    def _get_password_from_env(self, env_name, insecure_fallback):
        value = os.getenv(env_name)
        if value:
            return value

        self.stderr.write(
            self.style.WARNING(
                f"{env_name} is not set. Using insecure fallback password for demo seeding."
            )
        )
        return insecure_fallback

    @staticmethod
    def _normalize_email(value):
        return value.lower().strip()
