from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from django.db import transaction

from .models import Account, HostDetail, TravellerDetail
from django_filters.rest_framework import DjangoFilterBackend

from .serializers import (
    AccountRegisterSerializer,
    LoginSerializer,
    LoginUserSerializer,
    UserReadSerializer,
    TravellerBasicProfileSerializer,
    TravellerPreferencesSerializer,
    HostBasicProfileSerializer,
    HostBusinessInfoSerializer,
    HostDocumentUploadSerializer,
    OnboardingStatusSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    PasswordChangeSerializer,
    HostVerificationListSerializer,
    HostVerificationDetailSerializer,
    HostRejectSerializer,
    AdminUserListSerializer,
    AdminUserDetailSerializer,
    AdminBlockUserSerializer,
    HostProfileSerializer,
    HostDocumentReadSerializer,
    TravellerPreferencesReadSerializer,
)
from .filters import AdminUserFilter
from .permissions import IsTraveller, IsHost, IsAdmin
from .services import auth, onboarding, admin_service
from utils.pagination import EightPerPagePagination


# =============================================================================
# AUTH VIEWS
# =============================================================================

class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.
    Creates a new inactive user and sends verification email.
    """
    serializer_class = AccountRegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth.register_user(serializer)
        return Response(
            {"message": "User created successfully. Please verify your email to login."},
            status=status.HTTP_201_CREATED
        )


@extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
class ActivateAccountView(APIView):
    """
    Account activation endpoint.
    Validates token and activates user account.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def get(self, request, uidb64, token):
        auth.activate_user(uidb64, token)
        return Response({"message": "Account activated successfully."})


class LoginView(APIView):
    """
    Login endpoint.
    Returns access token in response body, sets refresh token in HttpOnly cookie.
    """
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        result = auth.login_user(
            email=serializer.validated_data['user'].email,
            password=request.data.get('password'),
            request=request
        )

        response = Response({
            "access": result['access'],
            "user": LoginUserSerializer(result['user']).data,
        })

        auth.set_refresh_cookie(response, result['refresh'])
        return response


@extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
class TokenRefreshView(APIView):
    """
    Refresh access token using HttpOnly cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        result = auth.refresh_tokens(refresh_token)

        response = Response({"access": result['access']})
        auth.set_refresh_cookie(response, result['refresh'])
        return response


@extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
class LogoutView(APIView):
    """
    Logout endpoint.
    Clears refresh token cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        auth.logout_user(request.COOKIES.get("refresh_token"))
        response = Response({"message": "Logged out successfully."})
        auth.clear_refresh_cookie(response)
        return response


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    GET: Returns current user's data.
    PATCH: Updates current user's profile.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return ProfileUpdateSerializer
        return UserReadSerializer

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        onboarding._compress_profile_photo(serializer)
        serializer.save()


# =============================================================================
# PASSWORD VIEWS
# =============================================================================

class PasswordChangeView(generics.CreateAPIView):
    """
    Change password for authenticated user.
    Requires current password verification.
    """
    serializer_class = PasswordChangeSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth.change_password(request.user, serializer.validated_data['new_password'])
        from accounts.tasks import send_password_changed_task
        transaction.on_commit(
            lambda user_id=request.user.pk: send_password_changed_task.delay(user_id)
        )
        return Response({"message": "Password changed successfully."})


class PasswordResetRequestView(generics.CreateAPIView):
    """
    Request password reset email.
    Always returns success to prevent email enumeration.
    """
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        auth.request_password_reset(serializer.validated_data['email'])

        return Response({
            "message": "If an account exists with this email, you will receive password reset instructions."
        })


class PasswordResetConfirmView(APIView):
    """
    Confirm password reset with new password.
    """
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request, uidb64, token):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        auth.reset_password(
            uidb64=uidb64,
            token=token,
            new_password=serializer.validated_data['new_password']
        )

        return Response({
            "message": "Your password has been reset successfully. You can now login with your new password."
        })


# =============================================================================
# ONBOARDING VIEWS
# =============================================================================

class OnboardingStatusView(generics.RetrieveAPIView):
    """
    Check the onboarding status of the current user.
    Returns current step and next step URL.
    """
    serializer_class = OnboardingStatusSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user = self.request.user
        return {
            "has_completed_onboarding": user.has_completed_onboarding,
            "current_step": user.onboarding_step,
            "role": user.role,
            "next_step_url": onboarding.get_next_step_url(user),
        }


class TravellerBasicProfileView(generics.UpdateAPIView):
    """
    Traveller onboarding step 1: Basic Profile.
    """
    serializer_class = TravellerBasicProfileSerializer
    permission_classes = [IsAuthenticated, IsTraveller]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        onboarding.complete_traveller_basic_profile(request.user, serializer)

        return Response({
            "message": "Basic profile updated successfully.",
            "next_step": "/api/accounts/onboarding/traveller/preferences/",
        })


class TravellerPreferencesView(generics.CreateAPIView):
    """
    Traveller onboarding step 2: Travel Preferences.
    Creates TravellerDetail and completes onboarding.
    """
    serializer_class = TravellerPreferencesSerializer
    permission_classes = [IsAuthenticated, IsTraveller]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        onboarding.complete_traveller_preferences(request.user, serializer.validated_data)

        return Response({
            "message": "Onboarding completed successfully! Welcome to ConnectNepal.",
            "redirect_to": "/dashboard/",
        })


class HostBasicProfileView(generics.UpdateAPIView):
    """
    Host onboarding step 1: Basic Profile.
    """
    serializer_class = HostBasicProfileSerializer
    permission_classes = [IsAuthenticated, IsHost]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        onboarding.complete_host_basic_profile(request.user, serializer)

        return Response({
            "message": "Basic profile updated successfully.",
            "next_step": "/api/accounts/onboarding/host/business-info/",
        })


class HostBusinessInfoView(generics.CreateAPIView):
    """
    Host onboarding step 2: Business Information.
    Creates HostDetail and completes onboarding.
    """
    serializer_class = HostBusinessInfoSerializer
    permission_classes = [IsAuthenticated, IsHost]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        host_detail = onboarding.complete_host_business_info(
            request.user, serializer.validated_data
        )

        return Response({
            "message": "Business information saved successfully!",
            "verification_status": host_detail.verification_status,
            "can_upload_documents": True,
            "next_step": "/api/accounts/onboarding/host/documents/",
            "skip_to": "/dashboard/host/",
        })


class HostDocumentUploadView(APIView):
    """
    Host document upload (optional step 3).
    Uploads verification documents and sets status to Pending.
    """
    serializer_class = HostDocumentUploadSerializer
    permission_classes = [IsAuthenticated, IsHost]

    def post(self, request):
        try:
            host_detail = HostDetail.objects.get(user=request.user)
        except HostDetail.DoesNotExist:
            return Response(
                {"detail": "Please complete business information first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = HostDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = onboarding.upload_host_documents(host_detail, serializer.validated_data)

        return Response({
            "message": f"{result['uploaded_count']} document(s) uploaded successfully.",
            "total_documents": result["total_documents"],
            "verification_status": result["verification_status"],
            "note": (
                "Your documents will be reviewed within 24-48 hours."
                if result["total_documents"] == 3
                else "Upload all 3 documents to submit for verification."
            ),
        })


# =============================================================================
# ADMIN — HOST VERIFICATION VIEWS
# =============================================================================

class AdminHostListView(generics.ListAPIView):
    """
    GET /api/accounts/admin/hosts/
    GET /api/accounts/admin/hosts/?verification_status=pending

    Lists all hosts. The optional query param 'verification_status' filters by one of: not_submitted, pending, approved, rejected.

    Only admins can access this endpoint.

    If an invalid status is passed, the service raises ValidationError - 400.
    """
    serializer_class = HostVerificationListSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        status_filter = self.request.query_params.get('verification_status', None)
        return admin_service.list_hosts(verification_status=status_filter)
    

class AdminHostDetailView(generics.RetrieveAPIView):
    """
    GET /api/accounts/admin/hosts/<id>/

    Returns full host profile including all uploaded documents.
    <id> is the host's Account PK (same as HostDetail PK).
    """
    serializer_class = HostVerificationDetailSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_object(self):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(
            HostDetail.objects
            .select_related('user', 'verified_by')
            .prefetch_related('documents'),
            pk=self.kwargs['id'],
        )


class AdminHostApproveView(APIView):
    """
    POST /api/accounts/admin/hosts/<id>/approve/

    Approves a host's verification. No request body needed.

    Returns the full HostVerificationDetailSerializer shape so the
    frontend can update state without an extra GET.

    Errors:
      400 code=already_approved  — host is already approved
      404 code=host_not_found    — no host with that id
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, id):
        host = admin_service.approve_host(
            host_detail_id=id,
            admin_user=request.user,
        )

        return Response(
            HostVerificationDetailSerializer(host).data,
            status=status.HTTP_200_OK,
        )
    

class AdminHostRejectView(APIView):
    """
    POST /api/accounts/admin/hosts/<id>/reject/

    Rejects a host's verification. Requires 'remarks' in the request body.

    Returns the full HostVerificationDetailSerializer shape.

    Request body:
      { "remarks": "Documents are expired and unreadable." }

    Errors:
      400 (serializer) — remarks missing, blank, or < 10 chars
      400 code=already_rejected — host is already rejected
      404 code=host_not_found — no host with that id
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, id):
        serializer = HostRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        host = admin_service.reject_host(
            host_detail_id=id,
            admin_user=request.user,
            remarks=serializer.validated_data['remarks'],
        )

        return Response(
            HostVerificationDetailSerializer(host).data,
            status=status.HTTP_200_OK,
        )


# =============================================================================
# ADMIN — USER MANAGEMENT VIEWS
# =============================================================================

class AdminUserListView(generics.ListAPIView):
    """
    GET /api/accounts/admin/users/
    GET /api/accounts/admin/users/?role=host&is_active=true&search=john

    Lists all users with filtering and pagination.
    """
    serializer_class = AdminUserListSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_class = AdminUserFilter
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        return admin_service.list_users()


class AdminUserDetailView(generics.RetrieveAPIView):
    """
    GET /api/accounts/admin/users/<id>/

    Returns full user profile with role-specific detail and recent status logs.
    """
    serializer_class = AdminUserDetailSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_object(self):
        return admin_service.get_user_detail(self.kwargs["id"])


class AdminBlockUserView(APIView):
    """
    POST /api/accounts/admin/users/<id>/block/

    Blocks a user (sets is_active=False). Optionally accepts 'reason'.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, id):
        serializer = AdminBlockUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = admin_service.block_user(
            user_id=id,
            admin_user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )

        return Response(
            AdminUserDetailSerializer(user).data,
            status=status.HTTP_200_OK,
        )


class AdminUnblockUserView(APIView):
    """
    POST /api/accounts/admin/users/<id>/unblock/

    Unblocks a user (sets is_active=True).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, id):
        user = admin_service.unblock_user(
            user_id=id,
            admin_user=request.user,
        )

        return Response(
            AdminUserDetailSerializer(user).data,
            status=status.HTTP_200_OK,
        )


# ── PROFILE / SETTINGS ENDPOINTS ─────────────────────────────────────────────


class HostProfileView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/accounts/host/profile/  — fetch host business profile + verification status
    PATCH /api/accounts/host/profile/  — update business info (name, address, phone, about)

    Verification fields (verification_status, verification_remarks) are read-only here.
    Works both during and after onboarding; creates HostDetail if it does not yet exist.
    """
    permission_classes = [IsAuthenticated, IsHost]
    serializer_class = HostProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        host_detail, _ = HostDetail.objects.get_or_create(user=self.request.user)
        return host_detail

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HostDocumentsView(APIView):
    """
    GET  /api/accounts/host/documents/ — list currently uploaded verification documents
    POST /api/accounts/host/documents/ — upload / replace one or more verification documents

    Requires HostDetail to exist (complete host profile first).
    Uploading all 3 documents automatically sets verification_status to PENDING.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def _get_host_detail(self, user):
        try:
            return HostDetail.objects.get(user=user)
        except HostDetail.DoesNotExist:
            return None

    def get(self, request):
        host_detail = self._get_host_detail(request.user)
        if host_detail is None:
            return Response(
                {"detail": "Host profile not found. Please complete your host profile first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        documents = host_detail.documents.all()
        serializer = HostDocumentReadSerializer(
            documents, many=True, context={'request': request}
        )
        return Response(serializer.data)

    def post(self, request):
        host_detail = self._get_host_detail(request.user)
        if host_detail is None:
            return Response(
                {"detail": "Host profile not found. Please complete your host profile first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = HostDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = onboarding.upload_host_documents(host_detail, serializer.validated_data)
        return Response({
            "message": f"{result['uploaded_count']} document(s) uploaded successfully.",
            "total_documents": result["total_documents"],
            "verification_status": result["verification_status"],
            "note": (
                "Your documents will be reviewed within 24-48 hours."
                if result["total_documents"] == 3
                else "Upload all 3 documents to submit for verification."
            ),
        })


class TravellerPreferencesSettingsView(APIView):
    """
    GET   /api/accounts/traveller/preferences/ — fetch current travel preferences
    PATCH /api/accounts/traveller/preferences/ — update travel preferences

    All fields are optional on PATCH — only the fields sent will be updated.
    Creates TravellerDetail if it does not yet exist (covers travellers who skipped onboarding).
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    def get(self, request):
        detail, _ = TravellerDetail.objects.get_or_create(user=request.user)
        serializer = TravellerPreferencesReadSerializer(detail)
        return Response(serializer.data)

    def patch(self, request):
        serializer = TravellerPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        detail, _ = TravellerDetail.objects.update_or_create(
            user=request.user,
            defaults=serializer.validated_data,
        )
        return Response(TravellerPreferencesReadSerializer(detail).data)
