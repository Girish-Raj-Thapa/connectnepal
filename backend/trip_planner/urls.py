from django.urls import path
from .views import (
    TripPlannerListCreateView,
    TripPlannerDetailView,
    TripPlannerItemCreateView,
    TripPlannerItemDetailView,
    TripPlannerItemReorderView,
)

app_name = 'trip_planner'

urlpatterns = [
    
     # ── TRIP PLAN ENDPOINTS ──────────────────────────────────────────

    # List all plans / Create new plan
    path('', TripPlannerListCreateView.as_view(), name='trip-list-create'),

    # Retrieve / Update / Archive a plan
    path('<int:pk>/', TripPlannerDetailView.as_view(), name='trip-detail'),


    # ── TRIP PLAN ITEM ENDPOINTS ─────────────────────────────────────

    # Add item to a plan
    path('<int:trip_pk>/items/', TripPlannerItemCreateView.as_view(), name='trip-item-create'),

    # Update / Remove an item
    path('<int:trip_pk>/items/<int:item_pk>/', TripPlannerItemDetailView.as_view(), name='trip-item-detail'),

    # Bulk reorder items (drag and drop)
    path('<int:trip_pk>/items/reorder/', TripPlannerItemReorderView.as_view(), name='trip-item-reorder'),
]