from django.urls import path

from packages.views.host_views import (
    HostPackageCoverImageView,
    HostPackageDetailView,
    HostPackageListCreateView,
    HostPackageListingsView,
)
from packages.views.host_slot_views import (
    HostPackageSlotListCreateView,
    HostPackageSlotDetailView,
    HostPackageScheduleListCreateView,
    HostPackageScheduleDetailView,
    HostPackageExceptionListCreateView,
    HostPackageExceptionDetailView,
    HostPackageGenerateSlotsView,
)
from packages.views.public_views import PackageDetailView, PackageListView
from packages.views.public_slot_views import PackageSlotListView, PackageAvailabilityView
from packages.views.admin_views import AdminPackageDeactivateView, AdminPackageActivateView
from reviews.views import PackageReviewsView

app_name = "packages"

urlpatterns = [
    # Host — package management
    path("host/packages/", HostPackageListCreateView.as_view(), name="host-package-list-create"),
    path("host/packages/<int:pk>/", HostPackageDetailView.as_view(), name="host-package-detail"),
    path("host/packages/<int:pk>/listings/", HostPackageListingsView.as_view(), name="host-package-listings"),
    path("host/packages/<int:pk>/cover-image/", HostPackageCoverImageView.as_view(), name="host-package-cover-image"),

    # Host — slot management
    path("host/packages/<int:pk>/slots/", HostPackageSlotListCreateView.as_view(), name="host-package-slot-list-create"),
    path("host/packages/<int:pk>/slots/<int:slot_id>/", HostPackageSlotDetailView.as_view(), name="host-package-slot-detail"),

    # Host — schedule management
    path("host/packages/<int:pk>/schedules/", HostPackageScheduleListCreateView.as_view(), name="host-package-schedule-list-create"),
    path("host/packages/<int:pk>/schedules/<int:schedule_id>/", HostPackageScheduleDetailView.as_view(), name="host-package-schedule-detail"),

    # Host — exception management
    path("host/packages/<int:pk>/exceptions/", HostPackageExceptionListCreateView.as_view(), name="host-package-exception-list-create"),
    path("host/packages/<int:pk>/exceptions/<int:exception_id>/", HostPackageExceptionDetailView.as_view(), name="host-package-exception-detail"),

    # Host — manual slot generation trigger
    path("host/packages/<int:pk>/generate-slots/", HostPackageGenerateSlotsView.as_view(), name="host-package-generate-slots"),

    # Public — traveller browse
    path("packages/", PackageListView.as_view(), name="package-list"),
    path("packages/<int:pk>/", PackageDetailView.as_view(), name="package-detail"),

    # Public — slot availability
    path("packages/<int:pk>/slots/", PackageSlotListView.as_view(), name="package-slot-list"),
    path("packages/<int:pk>/availability/", PackageAvailabilityView.as_view(), name="package-availability"),

    # Review
    path('packages/<int:package_pk>/reviews/', PackageReviewsView.as_view(), name='package-reviews'),

    # Admin
    path("packages/admin/<int:pk>/deactivate/", AdminPackageDeactivateView.as_view(), name="admin-package-deactivate"),
    path("packages/admin/<int:pk>/activate/", AdminPackageActivateView.as_view(), name="admin-package-activate"),
]
