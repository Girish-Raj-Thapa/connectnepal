from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from packages.filters import PackageFilter
from packages.models import Package
from packages.serializers.public_serializers import (
    PackagePublicDetailSerializer,
    PackagePublicListSerializer,
)


class PackageListView(generics.ListAPIView):
    """
    GET /api/packages/

    Publicly browsable list of active, bookable packages. Paginated at the
    project default page size.

    Filter params:
        ?tags=adventure          Substring match against the tags JSON field.
        ?price_max=30000         Packages with total_price ≤ this value.
        ?duration_days_max=5     Packages with duration_days ≤ this value.

    Search params:
        ?search=pokhara          Full-text search across title and description.

    Ordering params:
        ?ordering=total_price    Cheapest first.
        ?ordering=-total_price   Most expensive first.
        ?ordering=-created_at    Newest first (default).
        ?ordering=-booking_count Most popular first.

    ``listing_count`` is injected via a queryset annotation so the serializer
    renders it without any extra per-row queries.  ``host`` and ``host__user``
    are selected in the same query for ``host_name`` resolution.
    """

    permission_classes = [AllowAny]
    serializer_class = PackagePublicListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PackageFilter
    search_fields = ["title", "description"]
    ordering_fields = ["total_price", "created_at", "booking_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Package.objects
            .public_ready()
            .select_related("host", "host__user")
        )


class PackageDetailView(generics.RetrieveAPIView):
    """
    GET /api/packages/{id}/

    Full public detail for a single bookable package, including the ordered
    list of included listings with their thumbnails.

    ``package_listings__listing__images`` is prefetched in the queryset so
    the nested ``PackageListingPublicSerializer`` resolves all image URLs from
    the prefetch cache at zero extra queries.
    """

    permission_classes = [AllowAny]
    serializer_class = PackagePublicDetailSerializer

    def get_queryset(self):
        return (
            Package.objects
            .public_ready()
            .select_related("host", "host__user")
            .prefetch_related("package_listings__listing__images")
        )
