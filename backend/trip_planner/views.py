from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch

from accounts.permissions import IsTraveller
from .models import TripPlanner, TripPlannerItem, TripStatus
from .serializers import (
    TripPlannerCreateSerializer,
    TripPlannerUpdateSerializer,
    TripPlannerListSerializer,
    TripPlannerDetailSerializer,
    TripPlannerItemCreateSerializer,
    TripPlannerItemUpdateSerializer,
    TripPlannerItemReadSerializer,
    BulkReorderItemSerializer,
)
from .permissions import IsTripPlanOwner
from .services import trip_planner_service

# =========================
# TRIP PLAN VIEWS
# =========================

class TripPlannerListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/trip-planner/

    POST /api/trip-planner/

    List the authenticated traveller's trip plans (filterable by status).
    Create a new trip plan.

    Access: Authenticated travellers only
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TripPlannerCreateSerializer
        return TripPlannerListSerializer
    
    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        return trip_planner_service.get_user_trip_planners(
            traveller=self.request.user,
            status_filter=status_filter,
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        trip_planner = trip_planner_service.create_trip_planner(
            traveller=request.user,
            data=serializer.validated_data,
        )

        output = TripPlannerDetailSerializer(
            trip_planner,
            context={'request': request}
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )


class TripPlannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/trip-planner/{id}/

    PATCH  /api/trip-planner/{id}/

    DELETE /api/trip-planner/{id}/

    Retrieve full plan with items grouped by day.
    Update plan metadata.

    Delete (soft archive) the plan.

    Access: Authenticated traveller who owns the plan
    """

    permission_classes = [IsAuthenticated, IsTraveller, IsTripPlanOwner]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return TripPlannerUpdateSerializer
        return TripPlannerDetailSerializer
    
    def get_queryset(self):
        return TripPlanner.objects.filter(
            traveller=self.request.user
        ).prefetch_related(
            Prefetch(
                'items',
                queryset=TripPlannerItem.objects.active().select_related(
                    'listing',
                    'listing__host',
                    'listing__host__user',
                ).prefetch_related(
                    'listing__images'
                ).order_by('day_number', 'order'),
            ),
        )
    
    def retrieve(self, request, *args, **kwargs):
        trip_plan = self.get_object()
        detailed = trip_planner_service.get_trip_planner_detail(trip_plan)
        serializer = TripPlannerDetailSerializer(
            detailed,
            context={'request': request}
        )
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        trip_plan = self.get_object()

        serializer = self.get_serializer(
            trip_plan,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        updated = trip_planner_service.update_trip_planner(
            trip_planner=trip_plan,
            data=serializer.validated_data,
        )

        output = TripPlannerDetailSerializer(
            updated,
            context={'request': request}
        )

        return Response(output.data)
    
    def destroy(self, request, *args, **kwargs):
        trip_plan = self.get_object()
        trip_planner_service.archive_trip_planner(trip_plan)

        return Response(
            {"message": "Trip plan archived successfully."},
            status=status.HTTP_200_OK,
        )


# =========================
# TRIP PLAN ITEM VIEWS
# =========================

class TripPlannerItemCreateView(generics.CreateAPIView):
    """
    POST /api/trip-planner/{id}/items/

    Add a listing to a trip plan day.

    Access: Authenticated traveller who owns the plan
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    serializer_class = TripPlannerItemCreateSerializer

    def create(self, request, trip_pk, *args, **kwargs):
        trip_plan = get_object_or_404(
            TripPlanner.objects.filter(traveller=request.user),
            pk=trip_pk
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from listings.models import Listing
        listing = get_object_or_404(Listing, pk=serializer.validated_data['listing_id'])

        item = trip_planner_service.add_item(
            trip_planner=trip_plan,
            listing=listing,
            day_number=serializer.validated_data['day_number'],
            notes=serializer.validated_data.get('notes', ''),
        )
        item = (
            TripPlannerItem.objects
            .select_related('listing', 'listing__host', 'listing__host__user')
            .prefetch_related('listing__images')
            .get(pk=item.pk)
        )

        output = TripPlannerItemReadSerializer(
            item,
            context={'request': request}
        )

        return Response(output.data, status=status.HTTP_201_CREATED)


class TripPlannerItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/trip-planner/{trip_pk}/items/{item_pk}/

    PATCH  /api/trip-planner/{trip_pk}/items/{item_pk}/

    DELETE /api/trip-planner/{trip_pk}/items/{item_pk}/

    Retrieve, update or remove a trip plan item.

    Access: Authenticated traveller who owns the plan
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = TripPlannerItemReadSerializer
    lookup_url_kwarg = 'item_pk'

    def get_queryset(self):
        return (
            TripPlannerItem.objects
            .filter(
                trip_planner_id=self.kwargs['trip_pk'],
                trip_planner__traveller=self.request.user,
                removed_at__isnull=True,
            )
            .select_related('listing', 'listing__host', 'listing__host__user')
            .prefetch_related('listing__images')
        )

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return TripPlannerItemUpdateSerializer
        return TripPlannerItemReadSerializer
    
    def update(self, request, *args, **kwargs):
        item = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_item = trip_planner_service.update_item(
            item=item,
            data=serializer.validated_data,
        )
        updated_item = (
            TripPlannerItem.objects
            .select_related('listing', 'listing__host', 'listing__host__user')
            .prefetch_related('listing__images')
            .get(pk=updated_item.pk)
        )

        output = TripPlannerItemReadSerializer(
            updated_item,
            context={'request': request}
        )

        return Response(output.data)
    
    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        trip_planner_service.remove_item(item)

        return Response(
            {"message": "Item removed from trip plan."},
            status=status.HTTP_200_OK,
        )
    

class TripPlannerItemReorderView(generics.GenericAPIView):
    """
    PATCH /api/trip-planner/{trip_pk}/items/reorder/

    Bulk update day_number and order for drag-and-drop reordering.

    Access: Authenticated traveller who owns the plan
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    serializer_class = BulkReorderItemSerializer

    def patch(self, request, trip_pk):
        trip_plan = get_object_or_404(
            TripPlanner.objects.filter(traveller=request.user),
            pk=trip_pk
        )

        # Validate payload is a list
        if not isinstance(request.data, list):
            return Response(
                {
                    "detail": "Expected a list of reorder entries.",
                    "code": "invalid",
                    "status_code": status.HTTP_400_BAD_REQUEST,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each entry
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        trip_planner_service.bulk_reorder_items(
            trip_planner=trip_plan,
            reorder_data=serializer.validated_data,
        )

        return Response(
            {"message": f"{len(serializer.validated_data)} items reordered."},
            status=status.HTTP_200_OK,
        )
    
    
