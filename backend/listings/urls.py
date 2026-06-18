from django.urls import path
from .views import (
    # Public views
    ListingListView,
    ListingDetailView,
    ListingBySlugView,

    # Host CRUD views
    ListingCreateView,
    HostListingDetailView,
    ListingDeleteView,
    HostListingsView,
    HostLimitsView,

    # Image views
    ListingImageUploadView,
    ListingImageDeleteView,
    ListingImageSetPrimaryView,

    # Slot views
    PublicSlotListView,
    HostSlotListCreateView,
    HostSlotDetailView,

    # Availability calendar
    ListingAvailabilityView,

    # Schedule views
    HostScheduleListCreateView,
    HostScheduleDetailView,
    HostGenerateSlotsView,

    # Slot exception views
    HostSlotExceptionListCreateView,
    HostSlotExceptionDetailView,

    # Admin views
    AdminListingDeactivateView,
    AdminListingActivateView,
)
from reviews.views import ListingReviewsView

app_name = 'listings'

urlpatterns = [

    # ── PUBLIC ENDPOINTS (no auth) ──────────────────────────────────

    # List all public listings
    path('', ListingListView.as_view(), name='listing-list'),

    # Detail by Slug (SEO-friendly URLs)
    path('by-slug/<slug:slug>/', ListingBySlugView.as_view(), name='listing-by-slug'),

    # Detail by ID
    path('<int:pk>/', ListingDetailView.as_view(), name='listing-detail'),

    # Available slots for a listing (traveller-facing)
    path('<int:pk>/slots/', PublicSlotListView.as_view(), name='listing-slots'),

    # Availability calendar — per-day status for a given month
    path('<int:pk>/availability/', ListingAvailabilityView.as_view(), name='listing-availability'),


    # ── HOST ENDPOINTS (auth + IsHost) ──────────────────────────────

    # List host's own listings / Create new listing
    path('host/', HostListingsView.as_view(), name='host-listings'),
    path('host/create/', ListingCreateView.as_view(), name='host-listing-create'),

    # Check listing creation limits
    path('host/limits/', HostLimitsView.as_view(), name='host-limits'),

    # Retrieve / Update / Delete
    path('host/<int:pk>/', HostListingDetailView.as_view(), name='host-listing-detail'),
    path('host/<int:pk>/delete/', ListingDeleteView.as_view(), name='host-listing-delete'),

    # Image management
    path('host/<int:pk>/images/', ListingImageUploadView.as_view(), name='host-listing-image-upload'),
    path('host/<int:listing_pk>/images/<int:image_pk>/', ListingImageDeleteView.as_view(), name='host-listing-image-delete'),
    path('host/<int:listing_pk>/images/<int:image_pk>/set-primary/', ListingImageSetPrimaryView.as_view(), name='host-listing-image-set-primary'),

    # Slot management (host)
    path('host/<int:pk>/slots/', HostSlotListCreateView.as_view(), name='host-listing-slots'),
    path('host/<int:pk>/slots/<int:slot_id>/', HostSlotDetailView.as_view(), name='host-listing-slot-detail'),

    # Schedule management (host — set once, slots auto-generated nightly)
    path('host/<int:pk>/schedules/', HostScheduleListCreateView.as_view(), name='host-listing-schedules'),
    path('host/<int:pk>/schedules/<int:schedule_id>/', HostScheduleDetailView.as_view(), name='host-listing-schedule-detail'),

    # Trigger slot generation immediately (no need to wait for nightly job)
    path('host/<int:pk>/generate-slots/', HostGenerateSlotsView.as_view(), name='host-listing-generate-slots'),

    # Slot exception management (host — closures, capacity overrides per date)
    path('host/<int:pk>/exceptions/', HostSlotExceptionListCreateView.as_view(), name='host-listing-exceptions'),
    path('host/<int:pk>/exceptions/<int:exception_id>/', HostSlotExceptionDetailView.as_view(), name='host-listing-exception-detail'),

    # Review
    path('<int:listing_pk>/reviews/', ListingReviewsView.as_view(), name='listing-reviews'),

    # ── ADMIN ENDPOINTS ─────────────────────────────────────────────
    path('admin/<int:pk>/deactivate/', AdminListingDeactivateView.as_view(), name='admin-listing-deactivate'),
    path('admin/<int:pk>/activate/', AdminListingActivateView.as_view(), name='admin-listing-activate'),
]
