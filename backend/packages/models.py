from django.db import models


class PackageQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def public(self):
        return self.filter(
            is_active=True,
            is_bookable=True,
            host__user__is_active=True,
        )

    def with_public_listing_count(self):
        public_listing_filter = models.Q(
            package_listings__listing__is_active=True,
            package_listings__listing__is_bookable=True,
            package_listings__listing__host__user__is_active=True,
        )
        return self.annotate(
            listing_count=models.Count(
                "package_listings",
                filter=public_listing_filter,
                distinct=True,
            )
        )

    def public_ready(self, min_listings=2):
        return self.public().with_public_listing_count().filter(
            listing_count__gte=min_listings
        )


class Package(models.Model):
    objects = PackageQuerySet.as_manager()

    # Ownership
    host = models.ForeignKey(
        "accounts.HostDetail", on_delete=models.CASCADE, related_name="packages"
    )

    # Identity
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, editable=False, db_index=True)
    description = models.TextField()

    # Duration (denormalised; no slot needed)
    duration_days = models.PositiveIntegerField()
    duration_nights = models.PositiveIntegerField()

    # Pricing  (per-person final price; see §5.3 for booking formula)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_label = models.CharField(max_length=20, blank=True)  # e.g. "15% OFF"

    # Capacity
    max_group_size = models.PositiveIntegerField() # per-booking traveller cap
    max_bookings = models.PositiveIntegerField(null=True, blank=True)  # optional total cap

    # Rich content (mirrors Listing)
    tags = models.JSONField(default=list, blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    highlights = models.TextField(blank=True)
    terms_and_conditions = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="packages/covers/", null=True, blank=True)

    # Validity window (optional)
    valid_from  = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)

    # Lifecycle (mirrors Listing)
    is_bookable = models.BooleanField(default=False)   # host toggle: Active/Inactive
    is_active = models.BooleanField(default=True)    # soft-delete; once False, never True again

    # Denormalised stats (maintained by service)
    booking_count = models.PositiveIntegerField(default=0, editable=False)

    # Denormalised review stats
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["host"]),
            models.Index(fields=["is_active", "is_bookable"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return self.title


class PackageListing(models.Model):
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="package_listings")
    listing  = models.ForeignKey("listings.Listing", on_delete=models.PROTECT, related_name="package_listings")
    sort_order = models.PositiveIntegerField(default=0)
    day_number = models.PositiveIntegerField(null=True, blank=True) # future itinerary
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("package", "listing")]
        ordering = ["sort_order"]
        indexes = [models.Index(fields=["package", "sort_order"])]


class PackageSlot(models.Model):
    """
    A specific departure window for a package.

    Hosts create slots manually or via PackageSchedule auto-generation.
    BookingItems consume capacity from slots at booking time using
    select_for_update to prevent race conditions.

    unique_together on (package, start_date) prevents duplicate departure
    dates — one departure per calendar date per package.
    """
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="slots",
    )

    start_date = models.DateField(
        help_text="Departure date of this package run.",
    )

    end_date = models.DateField(
        help_text="Return date (start_date + duration_days - 1).",
    )

    capacity = models.PositiveIntegerField(
        help_text="Maximum travellers across all bookings on this slot.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Inactive slots cannot be booked.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_date"]
        unique_together = [("package", "start_date")]
        indexes = [
            models.Index(fields=["package", "is_active", "start_date"]),
            models.Index(fields=["package", "start_date", "end_date"]),
        ]

    def __str__(self):
        return f"PackageSlot #{self.pk} - {self.package.title} [{self.start_date} -> {self.end_date}]"
    

class PackageSchedule(models.Model):
    """
    Recurring schedule template that drives automatic PackageSlot generation.

    The nightly management command (and manual POST .../generate-slots/) walks
    every active PackageSchedule and calls get_or_create for each qualifying
    day up to advance_days ahead.

    days_of_week examples:
        [0, 1, 2, 3, 4, 5, 6]  — every day (default for migration)
        [5, 6]                  — weekends only
        [0]                     — Mondays only
    """

    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    days_of_week = models.JSONField(
        help_text="List of weekday ints (0=Monday … 6=Sunday). E.g. [0,2,4].",
    )

    capacity = models.PositiveIntegerField(
        help_text="Default capacity for each generated PackageSlot.",
    )

    advance_days = models.PositiveIntegerField(
        default=90,
        help_text="How many days ahead to pre-fill slots.",
    )

    valid_from = models.DateField(
        null=True, blank=True,
        help_text="Start of schedule window (inclusive). Defaults to today if blank.",
    )

    valid_until = models.DateField(
        null=True, blank=True,
        help_text="End of schedule window (inclusive). No end if blank.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Inactive schedules are skipped during generation.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["package", "is_active"]),
        ]
    
    def __str__(self):
        return (
            f"PackageSchedule #{self.pk} - {self.package.title} "
            f"(days={self.days_of_week}, cap={self.capacity})"
        )


class PackageSlotException(models.Model):
    """
    One-off override for a specific departure date on a package.

    Use cases:
      - is_closed=True : holiday / bad weather / sold-out date
      - capacity_override=N: special capacity adjustment for one date
    unique_together ensures only one exception per (package, date).
    """
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="exceptions",
    )

    date = models.DateField(
        help_text="The specific departure date this exception applies to.",
    )

    is_closed = models.BooleanField(
        default=True,
        help_text="If True, no slot will be generated or offered on this date.",
    )

    capacity_override = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Override the schedule's default capacity for this date only.",
    )

    note = models.CharField(
        max_length=255, blank=True,
        help_text="Internal note (e.g. 'Festival closure', 'Private group').",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("package", "date")]
        indexes = [
            models.Index(fields=["package", "date"]),
        ]
    
    def __str__(self):
        kind = "CLOSED" if self.is_closed else f"cap={self.capacity_override}"
        return f"PackageSlotException - {self.package.title} on {self.date} [{kind}]"
    
