import django_filters

from .models import Package


class PackageFilter(django_filters.FilterSet):
    """
    FilterSet for the public package browse endpoint.

    Provides price and duration upper-bound filters plus a tag substring match.
    Search (title/description) and ordering are handled separately by
    ``SearchFilter`` and ``OrderingFilter`` backends on the view.
    """

    price_max = django_filters.NumberFilter(field_name="total_price", lookup_expr="lte")
    duration_days_max = django_filters.NumberFilter(field_name="duration_days", lookup_expr="lte")
    tags = django_filters.CharFilter(field_name="tags", lookup_expr="icontains")

    class Meta:
        model = Package
        fields = ["price_max", "duration_days_max", "tags"]
