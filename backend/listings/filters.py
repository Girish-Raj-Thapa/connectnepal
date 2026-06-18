import django_filters
from .models import Listing, Category, ActivityType, DifficultyLevel, IdealFor, BestSeason


class ListingFilter(django_filters.FilterSet):
    """
    Comprehensive filter set for Listing queries.

    Filter Types:
    - Exact match: category, activity_type, difficulty_level
    - Range: min_price/max_price, min_days/max_days
    - Contains: destination (case-insensitive)
    - Custom: host_verified, tag, best_season
    """

    # CHOICE FILTERS: has exact match from dropdown/select
    
    category = django_filters.ChoiceFilter(
        choices=Category.choices,
        help_text="Filter by category (exact match)"
    )

    activity_type = django_filters.ChoiceFilter(
        choices=ActivityType.choices,
        help_text="Filter by activity type"
    )

    difficulty_level = django_filters.ChoiceFilter(
        choices=DifficultyLevel.choices,
        help_text="Filter by difficulty level"
    )

    ideal_for = django_filters.CharFilter(
        method='filter_ideal_for',
        help_text="Filter by target audience (matches if listing includes this value)"
    )


    # BOOLEAN FILTERS
    is_bookable = django_filters.BooleanFilter(
        help_text="Filter by bookable status (true/false)"
    )

    instant_booking = django_filters.BooleanFilter(
        help_text="Filter by instant booking availability"
    )


    # TEXT SEARCH FILTER
    destination = django_filters.CharFilter(
        field_name='destination',
        lookup_expr='icontains',  # Case-insensitive contains
        help_text="Search destination (case-insensitive, partial match)"
    )

    # RANGE FILTER: Price
    min_price = django_filters.NumberFilter(
        field_name='price_per_person',
        lookup_expr='gte',  # Greater than or equal
        help_text="Minimum price (inclusive)"
    )

    max_price = django_filters.NumberFilter(
        field_name='price_per_person',
        lookup_expr='lte',  # Less than or equal
        help_text="Maximum price (inclusive)"
    )


    # RANGE FILTER: Duration
    min_duration = django_filters.NumberFilter(
        field_name='average_duration_hours',
        lookup_expr='gte',
        help_text="Minimum duration in hours"
    )

    max_duration = django_filters.NumberFilter(
        field_name='average_duration_hours',
        lookup_expr='lte',
        help_text="Maximum duration in hours"
    )

    min_days = django_filters.NumberFilter(
        field_name='duration_days',
        lookup_expr='gte',
        help_text="Minimum duration in days"
    )

    max_days = django_filters.NumberFilter(
        field_name='duration_days',
        lookup_expr='lte',
        help_text="Maximum duration in days"
    )

    has_nights = django_filters.BooleanFilter(
        method='filter_has_nights',
        help_text="Filter for multi-day experiences with overnight stays"
    )


    # RANGER FILTER: Rating
    min_rating = django_filters.NumberFilter(
        field_name='rating_average',
        lookup_expr='gte',
        help_text="Minimum rating (0-5)"
    )


    # CUSTOM FILTERS: done using method implementation
    host_verified = django_filters.BooleanFilter(
        method='filter_host_verified',
        help_text="Only show listings from verified hosts"
    )

    tag = django_filters.CharFilter(
        method='filter_by_tag',
        help_text="Filter by tag (exact match within tags array)"
    )

    best_season = django_filters.CharFilter(
        method='filter_best_season',
        help_text="Filter by optimal season"
    )

    class Meta:
        model = Listing
        fields = [
            'category',
            'activity_type',
            'difficulty_level',
            'ideal_for',
            'is_bookable',
            'instant_booking',
        ]


    # CUSTOM FILTER METHODS
    def filter_host_verified(self, queryset, name, value):
        """
        Filter by host verification status.
        """
        if value is True:
            return queryset.filter(host__verification_status='approved')
        elif value is False:
            return queryset.exclude(host__verification_status='approved')
        return queryset   
    
    def filter_by_tag(self, queryset, name, value):
        """
        Filter listings that contain a specific tag.
        """
        if value:
            return queryset.filter(tags__contains=[value.lower()])
        return queryset
    
    def filter_ideal_for(self, queryset, name, value):
        """
        Filter for ideal_for JSONField.
        """
        if value:
            return queryset.filter(ideal_for__contains=[value.lower()])
        return queryset
    
    def filter_has_nights(self, queryset, name, value):
        """
        Filter for multi-day experiences with overnight stays.
        """
        if value is True:
            return queryset.filter(duration_nights__gt=0)
        elif value is False:
            return queryset.filter(duration_nights=0)
        return queryset
    
    def filter_best_season(self, queryset, name, value):
        """
        Filter by best season (JSONField contains).
        """
        if value:
            return queryset.filter(best_seasons__contains=[value.lower()])
        return queryset
