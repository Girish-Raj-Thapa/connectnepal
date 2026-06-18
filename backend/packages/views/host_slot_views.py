from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHost
from packages.models import Package, PackageSlot, PackageSchedule, PackageSlotException
from packages.permissions import IsPackageOwner
from packages.serializers.slot_serializers import (
    PackageSlotSerializer,
    PackageSlotCreateSerializer,
    PackageSlotUpdateSerializer,
    PackageScheduleSerializer,
    PackageScheduleCreateSerializer,
    PackageScheduleUpdateSerializer,
    PackageSlotExceptionSerializer,
    PackageSlotExceptionCreateSerializer,
    PackageSlotExceptionUpdateSerializer,
)
from packages.services import package_slot_service, package_schedule_service



# SLOT VIEWS

class HostPackageSlotListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/host/packages/{pk}/slots/   — List all slots for the package.
    POST /api/host/packages/{pk}/slots/   — Manually create a slot.

    GET query params:
        ?is_active=true/false      — filter by active state
        ?date_from=YYYY-MM-DD      — only slots with start_date >= date_from
    """
    permission_classes = [IsAuthenticated, IsHost]
    pagination_class = None  # Disable pagination for slot listing (respects advance_days)

    def get_package(self):
        """
        Fetch the parent Package scoped to the authenticated host.
        Using host= in the filter is the ownership check — identical to how
        HostPackageListCreateView works (no IsPackageOwner needed here).
        """
        if not hasattr(self, "_package"):
            self._package = get_object_or_404(
                Package,
                pk=self.kwargs["pk"],
                is_active=True,
                host=self.request.user.host_detail,
            )
        return self._package

    def get_queryset(self):
        qs = PackageSlot.objects.filter(package=self.get_package()).order_by("start_date")

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(start_date__gte=date_from)

        return qs

    def get_serializer_class(self):
        return PackageSlotCreateSerializer if self.request.method == "POST" else PackageSlotSerializer

    def create(self, request, *args, **kwargs):
        serializer = PackageSlotCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot = package_slot_service.create_slot(self.get_package(), serializer.validated_data)
        return Response(PackageSlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class HostPackageSlotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/host/packages/{pk}/slots/{slot_id}/  — Retrieve a slot.
    PATCH  /api/host/packages/{pk}/slots/{slot_id}/  — Update a slot.
    DELETE /api/host/packages/{pk}/slots/{slot_id}/  — Delete a slot.
    """
    permission_classes = [IsAuthenticated, IsHost]
    # PUT is disabled — slots are PATCH-only (partial update)
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        # Scopes all lookups to slots that belong to this host's package.
        # Mirrors HostPackageDetailView's get_queryset(host=...) pattern.
        return PackageSlot.objects.filter(
            package__pk=self.kwargs["pk"],
            package__host=self.request.user.host_detail,
            package__is_active=True,
        )

    def get_object(self):
        # URL uses slot_id not pk — override to look up by the correct kwarg.
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["slot_id"])
        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_class(self):
        return PackageSlotUpdateSerializer if self.request.method == "PATCH" else PackageSlotSerializer

    def update(self, request, *_args, **_kwargs):
        slot = self.get_object()
        serializer = PackageSlotUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = package_slot_service.update_slot(slot, serializer.validated_data)
        return Response(PackageSlotSerializer(updated).data)

    def perform_destroy(self, instance):
        package_slot_service.delete_slot(instance)



# SCHEDULE VIEWS

class HostPackageScheduleListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/host/packages/{pk}/schedules/   — List all schedules.
    POST /api/host/packages/{pk}/schedules/   — Create a new schedule.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get_package(self):
        if not hasattr(self, "_package"):
            self._package = get_object_or_404(
                Package,
                pk=self.kwargs["pk"],
                is_active=True,
                host=self.request.user.host_detail,
            )
        return self._package

    def get_queryset(self):
        return PackageSchedule.objects.filter(package=self.get_package()).order_by("id")

    def get_serializer_class(self):
        return PackageScheduleCreateSerializer if self.request.method == "POST" else PackageScheduleSerializer

    def create(self, request, *args, **kwargs):
        serializer = PackageScheduleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule = package_schedule_service.create_schedule(self.get_package(), serializer.validated_data)
        return Response(PackageScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class HostPackageScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/host/packages/{pk}/schedules/{schedule_id}/
    PATCH  /api/host/packages/{pk}/schedules/{schedule_id}/
    DELETE /api/host/packages/{pk}/schedules/{schedule_id}/
    """
    permission_classes = [IsAuthenticated, IsHost]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return PackageSchedule.objects.filter(
            package__pk=self.kwargs["pk"],
            package__host=self.request.user.host_detail,
            package__is_active=True,
        )

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["schedule_id"])
        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_class(self):
        return PackageScheduleUpdateSerializer if self.request.method == "PATCH" else PackageScheduleSerializer

    def update(self, request, *_args, **_kwargs):
        schedule = self.get_object()
        serializer = PackageScheduleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = package_schedule_service.update_schedule(schedule, serializer.validated_data)
        return Response(PackageScheduleSerializer(updated).data)

    def perform_destroy(self, instance):
        package_schedule_service.delete_schedule(instance)


# EXCEPTION VIEWS

class HostPackageExceptionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/host/packages/{pk}/exceptions/
    POST /api/host/packages/{pk}/exceptions/
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get_package(self):
        if not hasattr(self, "_package"):
            self._package = get_object_or_404(
                Package,
                pk=self.kwargs["pk"],
                is_active=True,
                host=self.request.user.host_detail,
            )
        return self._package

    def get_queryset(self):
        return PackageSlotException.objects.filter(package=self.get_package()).order_by("date")

    def get_serializer_class(self):
        return PackageSlotExceptionCreateSerializer if self.request.method == "POST" else PackageSlotExceptionSerializer

    def create(self, request, *args, **kwargs):
        serializer = PackageSlotExceptionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exc = package_schedule_service.create_exception(self.get_package(), serializer.validated_data)
        return Response(PackageSlotExceptionSerializer(exc).data, status=status.HTTP_201_CREATED)


class HostPackageExceptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/host/packages/{pk}/exceptions/{exception_id}/
    PATCH  /api/host/packages/{pk}/exceptions/{exception_id}/
    DELETE /api/host/packages/{pk}/exceptions/{exception_id}/
    """
    permission_classes = [IsAuthenticated, IsHost]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return PackageSlotException.objects.filter(
            package__pk=self.kwargs["pk"],
            package__host=self.request.user.host_detail,
            package__is_active=True,
        )

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["exception_id"])
        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_class(self):
        return PackageSlotExceptionUpdateSerializer if self.request.method == "PATCH" else PackageSlotExceptionSerializer

    def update(self, request, *args, **kwargs):
        exc = self.get_object()
        serializer = PackageSlotExceptionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = package_schedule_service.update_exception(exc, serializer.validated_data)
        return Response(PackageSlotExceptionSerializer(updated).data)

    def perform_destroy(self, instance):
        package_schedule_service.delete_exception(instance)


# GENERATE SLOTS TRIGGER

class HostPackageGenerateSlotsView(APIView):
    """
    POST /api/host/packages/{pk}/generate-slots/

    Manually queue slot generation for all active schedules of this package.
    Returns a task acknowledgement payload.

    Kept as APIView because this is an action endpoint (not a resource), so
    there is no model to retrieve and generics do not add value here.

    IsPackageOwner fires correctly via the explicit get_object() + check call,
    mirroring HostPackageListingsView in host_views.py.

    Example response:
        {
            "detail": "Package slot generation queued.",
            "package_id": 12,
            "task_id": "2f5e8d7e-6d8b-44d4-a6e4-3d3f4af8de54"
        }
    """
    permission_classes = [IsAuthenticated, IsHost, IsPackageOwner]

    def get_object(self):
        package = get_object_or_404(Package, pk=self.kwargs["pk"], is_active=True)
        self.check_object_permissions(self.request, package)
        return package

    def post(self, request, pk):
        package = self.get_object()

        from packages.tasks import generate_slots_for_package_task

        task = generate_slots_for_package_task.delay(package.pk)

        return Response(
            {
                "detail": "Package slot generation queued.",
                "package_id": package.pk,
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )
