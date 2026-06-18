from django.urls import path

from .views import (RegisterView, ActivateAccountView, LoginView, TokenRefreshView, LogoutView, CurrentUserView, OnboardingStatusView, TravellerBasicProfileView, TravellerPreferencesView, HostBasicProfileView, HostBusinessInfoView, HostDocumentUploadView, PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView, AdminHostApproveView, AdminHostDetailView, AdminHostListView, AdminHostRejectView, AdminUserListView, AdminUserDetailView, AdminBlockUserView, AdminUnblockUserView, HostProfileView, HostDocumentsView, TravellerPreferencesSettingsView)

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path("activate/<uidb64>/<token>/", ActivateAccountView.as_view(), name="activate-account"),
    path('login/', LoginView.as_view(), name='login'),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path('password-reset/', PasswordResetRequestView.as_view(), name="password-reset-request"),
    path('password-reset/confirm/<uidb64>/<token>/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path("me/password/", PasswordChangeView.as_view(), name="password-change"),

    # Onboarding
    path("onboarding/status/", OnboardingStatusView.as_view(), name="onboarding-status"),

    # Traveller Onboarding
    path("onboarding/traveller/basic-profile/", TravellerBasicProfileView.as_view(), name="traveller-basic-profile"),
    path("onboarding/traveller/preferences/", TravellerPreferencesView.as_view(), name="traveller-preferences"),

    # Host Onboarding
    path("onboarding/host/basic-profile/", HostBasicProfileView.as_view(), name="host-basic-profile"),
    path("onboarding/host/business-info/", HostBusinessInfoView.as_view(), name="host-business-info"),
    path("onboarding/host/documents/", HostDocumentUploadView.as_view(), name="host-documents"),

    # Profile / Settings (post-onboarding)
    path("host/profile/", HostProfileView.as_view(), name="host-profile"),
    path("host/documents/", HostDocumentsView.as_view(), name="host-documents-settings"),
    path("traveller/preferences/", TravellerPreferencesSettingsView.as_view(), name="traveller-preferences-settings"),

    # Admin - Host Verification
    path('admin/hosts/', AdminHostListView.as_view(),    name='admin-host-list'),
    path('admin/hosts/<int:id>/', AdminHostDetailView.as_view(), name='admin-host-detail'),
    path('admin/hosts/<int:id>/approve/', AdminHostApproveView.as_view(), name='admin-host-approve'),
    path('admin/hosts/<int:id>/reject/', AdminHostRejectView.as_view(),  name='admin-host-reject'),

    # Admin - User Management
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:id>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:id>/block/', AdminBlockUserView.as_view(), name='admin-user-block'),
    path('admin/users/<int:id>/unblock/', AdminUnblockUserView.as_view(), name='admin-user-unblock'),
]