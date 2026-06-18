from rest_framework import serializers

from packages.models import Package, PackageListing


def _listing_availability_message(listing):
    if not listing.host.user.is_active:
        return "Host account is inactive."
    if not listing.is_active:
        return "Listing was removed by the host."
    if not listing.is_bookable:
        return "Listing is not currently bookable."
    return None


class PackageListingNestedSerializer(serializers.ModelSerializer):
    """
    Read-only representation of a PackageListing row for host detail responses.

    Exposes listing fields via source traversal and a thumbnail URL for the
    listing's primary image. The view must prefetch package_listings__listing__images
    to avoid N+1 queries.
    """

    title = serializers.CharField(source="listing.title", read_only=True)
    category = serializers.CharField(source="listing.category", read_only=True)
    price_per_person = serializers.DecimalField(
        source="listing.price_per_person",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    duration_days = serializers.IntegerField(source="listing.duration_days", read_only=True)
    is_active = serializers.BooleanField(source="listing.is_active", read_only=True)
    is_bookable = serializers.BooleanField(source="listing.is_bookable", read_only=True)
    is_available_for_package = serializers.SerializerMethodField()
    availability_message = serializers.SerializerMethodField()
    primary_image_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = PackageListing
        fields = [
            "id",
            "listing_id",
            "title",
            "category",
            "price_per_person",
            "duration_days",
            "is_active",
            "is_bookable",
            "is_available_for_package",
            "availability_message",
            "sort_order",
            "day_number",
            "notes",
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

    def get_is_available_for_package(self, obj):
        return _listing_availability_message(obj.listing) is None

    def get_availability_message(self, obj):
        return _listing_availability_message(obj.listing)


class PackageCreateSerializer(serializers.Serializer):
    """
    Input serializer for creating a new package.

    Uses Serializer rather than ModelSerializer because listing_ids is not a
    Package model field — it is consumed by the service to create PackageListing
    rows and must not be written to the Package table directly. Ownership and
    active-status checks for listing_ids are delegated to the service layer.
    """

    title = serializers.CharField(max_length=200)
    description = serializers.CharField()
    duration_days = serializers.IntegerField(min_value=1)
    duration_nights = serializers.IntegerField(min_value=0)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_label = serializers.CharField(max_length=20, required=False, default="", allow_blank=True)
    max_group_size = serializers.IntegerField(min_value=1)
    max_bookings = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list,
    )
    inclusions = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list,
    )
    highlights = serializers.CharField(required=False, default="", allow_blank=True)
    terms_and_conditions = serializers.CharField(required=False, default="", allow_blank=True)
    cover_image = serializers.ImageField(required=False, allow_null=True)
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    is_bookable = serializers.BooleanField(required=False, default=False)
    listing_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) < 20:
            raise serializers.ValidationError("Description must be at least 20 characters.")
        return value

    def validate_total_price(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Package price must be greater than zero.", code="invalid_price"
            )
        return value

    def validate_tags(self, value):
        if len(value) > 15:
            raise serializers.ValidationError("Maximum 15 tags allowed.")
        return [tag.lower().strip() for tag in value if tag.strip()]

    def validate_inclusions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("inclusions must be a list.")
        if len(value) > 20:
            raise serializers.ValidationError("Maximum 20 inclusions allowed.")
        return value

    def validate(self, attrs):
        valid_from = attrs.get("valid_from")
        valid_until = attrs.get("valid_until")
        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError(
                {"valid_until": "valid_until must be after valid_from."}
            )
        return attrs


class PackageUpdateSerializer(serializers.Serializer):
    """
    Input serializer for partial updates to an existing package.

    All fields are optional (PATCH semantics). Rejects is_active=True since
    soft-delete is irreversible via the API. Does not accept listing_ids;
    use the dedicated PUT /listings/ endpoint to replace the listing set.
    """

    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False)
    duration_days = serializers.IntegerField(min_value=1, required=False)
    duration_nights = serializers.IntegerField(min_value=0, required=False)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    discount_label = serializers.CharField(max_length=20, required=False, allow_blank=True)
    max_group_size = serializers.IntegerField(min_value=1, required=False)
    max_bookings = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    inclusions = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
    )
    highlights = serializers.CharField(required=False, allow_blank=True)
    terms_and_conditions = serializers.CharField(required=False, allow_blank=True)
    cover_image = serializers.ImageField(required=False, allow_null=True)
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    is_bookable = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_is_active(self, value):
        if value is True:
            raise serializers.ValidationError(
                "Reactivation of a deleted package is not supported.",
                code="cannot_reactivate",
            )
        return value

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return value

    def validate_total_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Package price must be greater than zero.")
        return value

    def validate_tags(self, value):
        if len(value) > 15:
            raise serializers.ValidationError("Maximum 15 tags allowed.")
        return [tag.lower().strip() for tag in value if tag.strip()]

    def validate_inclusions(self, value):
        if len(value) > 20:
            raise serializers.ValidationError("Maximum 20 inclusions allowed.")
        return value

    def validate(self, attrs):
        valid_from = attrs.get("valid_from")
        valid_until = attrs.get("valid_until")
        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError(
                {"valid_until": "valid_until must be after valid_from."}
            )
        return attrs


class PackageListSerializer(serializers.ModelSerializer):
    """
    Lightweight output for the host Manage Packages table.

    listing_count is read from a Count('package_listings') annotation added by
    the view queryset. included_listing_names is resolved from a prefetch_related
    cache (package_listings__listing) — no additional queries are issued.
    """

    listing_count = serializers.IntegerField(read_only=True)
    included_listing_names = serializers.SerializerMethodField()
    active_listing_count = serializers.SerializerMethodField()
    has_unavailable_listings = serializers.SerializerMethodField()
    publish_issue = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            "id",
            "title",
            "slug",
            "listing_count",
            "active_listing_count",
            "has_unavailable_listings",
            "publish_issue",
            "included_listing_names",
            "duration_days",
            "duration_nights",
            "total_price",
            "discount_label",
            "booking_count",
            "is_bookable",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_included_listing_names(self, obj):
        return [pl.listing.title for pl in obj.package_listings.all()]

    def get_active_listing_count(self, obj):
        return sum(
            1
            for package_listing in obj.package_listings.all()
            if _listing_availability_message(package_listing.listing) is None
        )

    def get_has_unavailable_listings(self, obj):
        return self.get_active_listing_count(obj) != obj.package_listings.count()

    def get_publish_issue(self, obj):
        active_listing_count = self.get_active_listing_count(obj)
        if active_listing_count < 2:
            return "At least 2 active and bookable listings are required."
        if self.get_has_unavailable_listings(obj):
            return "One or more included listings are unavailable."
        return None


class PackageDetailSerializer(serializers.ModelSerializer):
    """
    Full host-facing package detail.

    Returned for POST (201 created), GET /host/packages/{id}/, and PATCH so
    the frontend always receives the same shape regardless of the request method.
    The view queryset must prefetch package_listings__listing__images to keep
    nested serializer resolution O(1).
    """

    package_listings = PackageListingNestedSerializer(many=True, read_only=True)
    listing_count = serializers.SerializerMethodField()
    active_listing_count = serializers.SerializerMethodField()
    has_unavailable_listings = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()
    publish_issue = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

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
            "max_bookings",
            "tags",
            "inclusions",
            "highlights",
            "terms_and_conditions",
            "cover_image_url",
            "valid_from",
            "valid_until",
            "is_bookable",
            "is_active",
            "booking_count",
            "listing_count",
            "active_listing_count",
            "has_unavailable_listings",
            "can_publish",
            "publish_issue",
            "package_listings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_listing_count(self, obj):
        return obj.package_listings.count()

    def get_active_listing_count(self, obj):
        return sum(
            1
            for package_listing in obj.package_listings.all()
            if _listing_availability_message(package_listing.listing) is None
        )

    def get_has_unavailable_listings(self, obj):
        return self.get_active_listing_count(obj) != obj.package_listings.count()

    def get_can_publish(self, obj):
        return self.get_active_listing_count(obj) >= 2 and not self.get_has_unavailable_listings(obj)

    def get_publish_issue(self, obj):
        active_listing_count = self.get_active_listing_count(obj)
        if active_listing_count < 2:
            return "At least 2 active and bookable listings are required."
        if self.get_has_unavailable_listings(obj):
            return "One or more included listings are unavailable."
        return None

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url


class PackageCoverImageSerializer(serializers.Serializer):
    cover_image = serializers.ImageField()


class PackageListingsSetSerializer(serializers.Serializer):
    """
    Input for PUT /host/packages/{id}/listings/.

    Validates the full ordered set of listing PKs for a package. The position
    of each ID in the array becomes its sort_order (0-based). Ownership and
    active-status checks are delegated to the service layer.
    """

    listing_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=2,
        error_messages={"min_length": "A package must include at least 2 listings."},
    )

    def validate_listing_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError(
                "Duplicate listing IDs are not allowed.", code="duplicate_listing"
            )
        return value
