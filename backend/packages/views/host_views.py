from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from accounts.permissions import IsHost
from packages.filters import PackageFilter
from packages.models import Package
from packages.permissions import IsPackageOwner
from packages.serializers.host_serializers import (
    PackageCoverImageSerializer,
    PackageCreateSerializer,
    PackageDetailSerializer,
    PackageListSerializer,
    PackageListingsSetSerializer,
    PackageUpdateSerializer,
)
from packages.services import package_service


class HostPackageListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/host/packages/         — Paginated list of the host's active packages.
    POST /api/host/packages/         — Create a new package with optional listings.

    Filter params:
        ?is_bookable=true   Active (published) packages only.
        ?is_bookable=false  Inactive (draft) packages only.

    The queryset is annotated with ``listing_count`` so the list serializer can
    render it without any extra per-row queries.  ``package_listings__listing``
    is prefetched so ``included_listing_names`` also costs zero extra queries.

    POST creates the ``Package`` row and bulk-creates ``PackageListing`` rows in
    a single atomic transaction via the service layer, then returns the full
    detail shape (same as GET /{id}/) with HTTP 201.
    """

    permission_classes = [IsAuthenticated, IsHost]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["is_bookable"]

    def get_queryset(self):
        return (
            Package.objects
            .filter(host=self.request.user.host_detail, is_active=True)
            .annotate(listing_count=Count("package_listings"))
            .prefetch_related("package_listings__listing", "package_listings__listing__host__user")
        )

    def get_serializer_class(self):
        return PackageCreateSerializer if self.request.method == "POST" else PackageListSerializer

    def create(self, request, *args, **kwargs):
        serializer = PackageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        package = package_service.create_package_with_listings(
            host=request.user.host_detail,
            data=serializer.validated_data,
        )
        return Response(
            PackageDetailSerializer(package, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class HostPackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/host/packages/{id}/  — Full package detail for edit form pre-fill.
    PATCH  /api/host/packages/{id}/  — Partial update of scalar fields.
    DELETE /api/host/packages/{id}/  — Soft-delete (sets is_active + is_bookable to False).

    ``IsPackageOwner`` is evaluated at the object level, so a host who guesses
    another host's package PK receives HTTP 403 rather than the package data.

    PATCH notes:
        - ``is_active=true`` is rejected by the serializer (cannot re-activate).
        - ``is_bookable=true`` is rejected by the service when fewer than 2
          listings are attached.
        - ``listing_ids`` changes must use the dedicated PUT /listings/ endpoint.

    DELETE notes:
        - Blocked by the service when active or confirmed bookings exist.
        - Returns HTTP 204 on success; no body.
    """

    permission_classes = [IsAuthenticated, IsHost, IsPackageOwner]

    def get_queryset(self):
        return (
            Package.objects
            .filter(host=self.request.user.host_detail, is_active=True)
            .prefetch_related(
                "package_listings__listing__images",
                "package_listings__listing__host__user",
            )
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return PackageUpdateSerializer
        return PackageDetailSerializer

    def perform_update(self, serializer):
        package_service.update_package(self.get_object(), serializer.validated_data)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        package = package_service.update_package(self.get_object(), serializer.validated_data)
        return Response(PackageDetailSerializer(package, context={"request": request}).data)

    def perform_destroy(self, instance):
        package_service.soft_delete_package(instance)


class HostPackageListingsView(APIView):
    """
    PUT /api/host/packages/{id}/listings/

    Bulk-replaces the complete ordered set of listings attached to a package.
    The client sends the full desired list of listing PKs; the service deletes
    all existing ``PackageListing`` rows and inserts the new set in one atomic
    transaction.  The index in the submitted array becomes ``sort_order``.

    Returns the full package detail (same shape as GET /{id}/) on success.
    """

    permission_classes = [IsAuthenticated, IsHost, IsPackageOwner]

    def get_object(self, pk):
        package = get_object_or_404(Package, pk=pk, is_active=True)
        self.check_object_permissions(self.request, package)
        return package

    def put(self, request, pk):
        package = self.get_object(pk)
        serializer = PackageListingsSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = package_service.set_package_listings(
            package=package,
            listing_ids=serializer.validated_data["listing_ids"],
            host=request.user.host_detail,
        )
        return Response(PackageDetailSerializer(updated, context={"request": request}).data)


class HostPackageCoverImageView(APIView):
    """
    POST   /api/host/packages/<pk>/cover-image/  — Upload or replace the cover image.
    DELETE /api/host/packages/<pk>/cover-image/  — Remove the cover image.
    """
    permission_classes = [IsAuthenticated, IsHost, IsPackageOwner]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self, pk):
        package = get_object_or_404(Package, pk=pk, is_active=True)
        self.check_object_permissions(self.request, package)
        return package

    def post(self, request, pk):
        package = self.get_object(pk)
        serializer = PackageCoverImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        package = package_service.set_cover_image(package, serializer.validated_data["cover_image"])
        return Response(
            PackageDetailSerializer(package, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        package = self.get_object(pk)
        package_service.remove_cover_image(package)
        return Response({"detail": "Cover image removed."}, status=status.HTTP_200_OK)
