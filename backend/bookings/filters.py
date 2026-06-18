import django_filters
from django.db.models import Q

from .models import Booking, BookingItem, BookingStatus, BookingItemStatus, PaymentStatus


class BookingFilter(django_filters.FilterSet):
    """
    FilterSet for the Booking model.

    Provides filtering by the overall booking status, the source of the booking 
    (e.g., direct or via trip plan), and date ranges based on when the 
    booking was created.
    """
    status = django_filters.ChoiceFilter(choices=BookingStatus.choices)
    source = django_filters.CharFilter(field_name="source", lookup_expr="exact")

    # Use field_name + lookup_expr separately — "created_at__date__gte" style is
    # unreliable across DB backends. This form is the correct django-filter idiom.
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Booking
        fields = ["status", "source", "date_from", "date_to"]
    

class HostBookingItemFilter(django_filters.FilterSet):
    """
    FilterSet for BookingItems, tailored for host-side management.

    Allows hosts to filter specific itinerary items by their status, 
    associated listing ID, duration type (daily/nightly), and 
    the scheduled start date of the activity or stay.
    """
    status = django_filters.ChoiceFilter(choices=BookingItemStatus.choices)
    listing_id = django_filters.NumberFilter(field_name="listing_id")
    package_id = django_filters.NumberFilter(field_name="package_id")
    date_from = django_filters.DateFilter(field_name="start_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="start_date", lookup_expr="lte")
    duration_type = django_filters.CharFilter(field_name="duration_type", lookup_expr="exact")

    class Meta:
        model = BookingItem
        fields = ["status", "listing_id", "package_id", "date_from", "date_to", "duration_type"]


class AdminBookingFilter(django_filters.FilterSet):
    """
    FilterSet for admin booking oversight.

    Extends filtering with traveller search and payment_status.
    """
    status = django_filters.ChoiceFilter(choices=BookingStatus.choices)
    source = django_filters.CharFilter(field_name="source", lookup_expr="exact")
    payment_status = django_filters.ChoiceFilter(choices=PaymentStatus.choices)
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Booking
        fields = ["status", "source", "payment_status", "date_from", "date_to"]

    def filter_search(self, queryset, name, value):
        """Search by traveller email/name or booking reference."""
        if not value:
            return queryset
        value = value.strip()
        return queryset.filter(
            Q(traveller__email__icontains=value)
            | Q(traveller__first_name__icontains=value)
            | Q(traveller__last_name__icontains=value)
            | Q(reference__icontains=value)
        )
