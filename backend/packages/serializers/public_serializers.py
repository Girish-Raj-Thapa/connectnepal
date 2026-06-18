from rest_framework import serializers

from packages.models import Package, PackageListing


class PackageListingPublicSerializer(serializers.ModelSerializer):
    """
    Read-only listing summary shown within a public package detail response.

    Omits internal fields (listing_id, notes) that are irrelevant for
    traveller-facing display. The view must prefetch
    package_listings__listing__images to avoid N+1 queries.
    """

    id = serializers.IntegerField(source="listing.id", read_only=True)
    title = serializers.CharField(source="listing.title", read_only=True)
    category = serializers.CharField(source="listing.category", read_only=True)
    price_per_person = serializers.DecimalField(
        source="listing.price_per_person",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    duration_days = serializers.IntegerField(source="listing.duration_days", read_only=True)
    primary_image_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = PackageListing
        fields = [
            "id",
            "title",
            "category",
            "price_per_person",
            "duration_days",
            "sort_order",
            "day_number",
            "primary_image_thumbnail",
        ]
        read_only_fields = fields

    def get_primary_image_thumbnail(self, obj):
        primary = obj.listing.images.filter(is_primary=True).first()
        if not primary:
            return None
        request = self.context.get("request")
        image_file = primary.thumbnail if primary.thumbnail else primary.image
        if request and image_file:
            return request.build_absolute_uri(image_file.url)
        return image_file.url if image_file else None


class PackagePublicListSerializer(serializers.ModelSerializer):
    """
    Card-level output for GET /api/packages/ (traveller browse).

    Omits host-private fields (max_bookings, is_active, is_bookable, updated_at).
    listing_count is read from a Count('package_listings') annotation on the
    queryset. host_name falls back to the user's full name when business_name
    is not set.
    """

    listing_count = serializers.IntegerField(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    has_upcoming_slots = serializers.SerializerMethodField()
    next_available_slot = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "duration_days",
            "duration_nights",
            "total_price",
            "discount_label",
            "tags",
            "listing_count",
            "cover_image_url",
            "host_name",
            "booking_count",
            "has_upcoming_slots",
            "next_available_slot",
            "created_at",
        ]
        read_only_fields = fields

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url

    def get_host_name(self, obj):
        return obj.host.business_name or obj.host.user.get_full_name()

    def get_has_upcoming_slots(self, obj):
        from datetime import date
        return obj.slots.filter(is_active=True, start_date__gte=date.today()).exists()

    def get_next_available_slot(self, obj):
        from datetime import date
        slot = (
            obj.slots
            .filter(is_active=True, start_date__gte=date.today())
            .order_by("start_date")
            .first()
        )
        if slot is None:
            return None
        return {
            "id": slot.id,
            "start_date": slot.start_date.isoformat(),
            "end_date": slot.end_date.isoformat(),
        }


class PackagePublicDetailSerializer(serializers.ModelSerializer):
    """
    Full public detail for GET /api/packages/{id}/.

    Includes an ordered list of included listings and host identity fields.
    Omits host-private capacity and lifecycle fields. The view queryset must
    prefetch package_listings__listing__images to keep nested resolution O(1).
    """

    package_listings = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    host_id = serializers.IntegerField(source="host.id", read_only=True)
    has_upcoming_slots = serializers.SerializerMethodField()
    next_available_slot = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "duration_days",
            "duration_nights",
            "total_price",
            "discount_label",
            "max_group_size",
            "tags",
            "inclusions",
            "highlights",
            "terms_and_conditions",
            "cover_image_url",
            "valid_from",
            "valid_until",
            "host_id",
            "host_name",
            "booking_count",
            "has_upcoming_slots",
            "next_available_slot",
            "package_listings",
            "created_at",
        ]
        read_only_fields = fields

    def get_package_listings(self, obj):
        package_listings = [
            package_listing
            for package_listing in obj.package_listings.all()
            if (
                package_listing.listing.is_active
                and package_listing.listing.is_bookable
            )
        ]
        return PackageListingPublicSerializer(
            package_listings,
            many=True,
            context=self.context,
        ).data

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url

    def get_host_name(self, obj):
        return obj.host.business_name or obj.host.user.get_full_name()

    def get_has_upcoming_slots(self, obj):
        from datetime import date
        return obj.slots.filter(is_active=True, start_date__gte=date.today()).exists()

    def get_next_available_slot(self, obj):
        from datetime import date
        slot = (
            obj.slots
            .filter(is_active=True, start_date__gte=date.today())
            .order_by("start_date")
            .first()
        )
        if slot is None:
            return None
        return {
            "id": slot.id,
            "start_date": slot.start_date.isoformat(),
            "end_date": slot.end_date.isoformat(),
        }
