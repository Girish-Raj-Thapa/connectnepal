from rest_framework import serializers

class MonthCountPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    count = serializers.IntegerField()


class MonthAmountPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class TravellerOverviewSummarySerializer(serializers.Serializer):
    active_trip_plans = serializers.IntegerField()
    upcoming_bookings = serializers.IntegerField()
    completed_trips = serializers.IntegerField()
    reviews_written = serializers.IntegerField()


class TravellerUpcomingBookingPreviewSerializer(serializers.Serializer):
    booking_item_id = serializers.IntegerField()
    booking_id = serializers.IntegerField()
    booking_reference = serializers.CharField()
    target_type = serializers.ChoiceField(choices=['listing', 'package'])
    target_id = serializers.IntegerField()
    title = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    status = serializers.CharField()
    quoted_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()


class TravellerTripPlanPreviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    estimated_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    updated_at = serializers.DateTimeField()


class TravellerOverviewPreviewsSerializer(serializers.Serializer):
    upcoming_bookings = TravellerUpcomingBookingPreviewSerializer(many=True)
    trip_plans = TravellerTripPlanPreviewSerializer(many=True)


class TravellerOverviewSerializer(serializers.Serializer):
    summary = TravellerOverviewSummarySerializer()
    previews = TravellerOverviewPreviewsSerializer()


class HostOverviewSummarySerializer(serializers.Serializer):
    active_listings = serializers.IntegerField()
    total_bookings = serializers.IntegerField()
    this_month_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    review_count = serializers.IntegerField()


class HostRecentBookingPreviewSerializer(serializers.Serializer):
    booking_item_id = serializers.IntegerField()
    booking_id = serializers.IntegerField()
    booking_reference = serializers.CharField()
    target_type = serializers.ChoiceField(choices=['listing', 'package'])
    target_id = serializers.IntegerField()
    title = serializers.CharField()
    traveller_name = serializers.CharField(allow_null=True)
    traveller_email = serializers.EmailField(allow_null=True)
    status = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    quoted_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()
    created_at = serializers.DateTimeField()


class HostTopPerformingListingSerializer(serializers.Serializer):
    listing_id = serializers.IntegerField()
    title = serializers.CharField()
    category = serializers.CharField()
    destination = serializers.CharField()
    booking_count = serializers.IntegerField()
    rating_average = serializers.DecimalField(max_digits=3, decimal_places=2)
    rating_count = serializers.IntegerField()
    is_active = serializers.BooleanField()
    is_bookable = serializers.BooleanField()


class HostOverviewTrendsSerializer(serializers.Serializer):
    monthly_earnings = MonthAmountPointSerializer(many=True)
    monthly_bookings = MonthCountPointSerializer(many=True)


class HostOverviewPreviewsSerializer(serializers.Serializer):
    recent_bookings = HostRecentBookingPreviewSerializer(many=True)
    top_performing_listings = HostTopPerformingListingSerializer(many=True)


class HostOverviewSerializer(serializers.Serializer):
    summary = HostOverviewSummarySerializer()
    trends = HostOverviewTrendsSerializer()
    previews = HostOverviewPreviewsSerializer()


class AdminOverviewSummarySerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    active_hosts = serializers.IntegerField()
    total_listings = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_bookings = serializers.IntegerField()
    active_packages = serializers.IntegerField()
    total_reviews = serializers.IntegerField()
    average_platform_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    open_complaints = serializers.IntegerField(allow_null=True)


class ListingsByCategorySerializer(serializers.Serializer):
    category = serializers.CharField()
    category_display = serializers.CharField()
    count = serializers.IntegerField()


class RecentActivityItemSerializer(serializers.Serializer):
    source = serializers.CharField()
    occurred_at = serializers.DateTimeField()
    actor_name = serializers.CharField()
    actor_role = serializers.CharField()
    action = serializers.CharField()
    entity_type = serializers.CharField()
    entity_id = serializers.IntegerField()
    label = serializers.CharField()
    description = serializers.CharField()


class AdminTopListingSerializer(serializers.Serializer):
    listing_id = serializers.IntegerField()
    title = serializers.CharField()
    host_id = serializers.IntegerField()
    host_name = serializers.CharField()
    booking_count = serializers.IntegerField()
    rating_average = serializers.DecimalField(max_digits=3, decimal_places=2)
    rating_count = serializers.IntegerField()


class AdminTopHostSerializer(serializers.Serializer):
    host_id = serializers.IntegerField()
    host_name = serializers.CharField()
    business_name = serializers.CharField(allow_null=True)
    booking_count = serializers.IntegerField()
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    review_count = serializers.IntegerField()
    verification_status = serializers.CharField()


class AdminOverviewTrendsSerializer(serializers.Serializer):
    monthly_revenue = MonthAmountPointSerializer(many=True)
    monthly_bookings = MonthCountPointSerializer(many=True)


class AdminOverviewDistributionsSerializer(serializers.Serializer):
    listings_by_category = ListingsByCategorySerializer(many=True)


class AdminOverviewPreviewsSerializer(serializers.Serializer):
    recent_activity = RecentActivityItemSerializer(many=True)


class AdminTopPerformanceSerializer(serializers.Serializer):
    listings = AdminTopListingSerializer(many=True)
    hosts = AdminTopHostSerializer(many=True)


class AdminOverviewSerializer(serializers.Serializer):
    summary = AdminOverviewSummarySerializer()
    trends = AdminOverviewTrendsSerializer()
    distributions = AdminOverviewDistributionsSerializer()
    previews = AdminOverviewPreviewsSerializer()
    top_performance = AdminTopPerformanceSerializer()
