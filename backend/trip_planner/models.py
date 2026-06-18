from django.db import models
from decimal import Decimal

# =========================
# ENUMS
# =========================

class TripStatus(models.TextChoices):
    """
    Status lifecycle for a trip plan.

    planning → partially_booked → booked → completed

    Any state → archived (soft delete)
    """
    PLANNING = "planning", "Planning"
    PARTIALLY_BOOKED = "partially_booked", "Partially Booked"
    BOOKED = "booked", "Booked"
    COMPLETED = "completed", "Completed"
    ARCHIVED = "archived", "Archived"


class TripPlannerItemRemovalReason(models.TextChoices):
    HOST_DELETED_LISTING = "host_deleted_listing", "Host Deleted Listing"
    ADMIN_DEACTIVATED_LISTING = "admin_deactivated_listing", "Admin Deactivated Listing"


class TripPlannerItemQuerySet(models.QuerySet):
    def active(self):
        return self.filter(removed_at__isnull=True)

    def removed(self):
        return self.filter(removed_at__isnull=False)


# =========================
# MODELS
# =========================

class TripPlanner(models.Model):
    """
    A multi-day travel plan created by a traveller.
    Organizes Listings into a day-by-day timeline.

    Relationships:
    - belongs to an Account (traveller)
    - has many TripPlanItems
    """

    # realtionship with traveller
    traveller = models.ForeignKey(
        'accounts.Account',
        on_delete=models.CASCADE,
        related_name='trip_plans',
        help_text="The traveller who owns this plan",
    )

    # Basic info
    title = models.CharField(
        max_length=255,
        help_text="Plan title, e.g. 'Annapurna Discovery'"
    )

    status = models.CharField(
        max_length=20,
        choices=TripStatus.choices,
        default=TripStatus.PLANNING,
        db_index=True
    )


    # Dates (optional)
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Optional planned start date"
    )

    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Optional planned end date"
    )

    # Plan parameters
    total_days = models.PositiveIntegerField(
        default=1,
        help_text="Number of days in the plan (>= 1)"
    )

    travellers_count = models.PositiveIntegerField(
        default=1,
        help_text="Number of travellers (>= 1)"
    )


    # Cached cost — recalculated via service layer
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Cached: sum(price_snapshot) * travellers_count"
    )


    # Optional cover image URL (derived from first item or set manually)
    cover_image = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional cover image URL"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['traveller', 'status']),
            models.Index(fields=['updated_at']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.traveller.email})"
    

class TripPlannerItem(models.Model):
    objects = TripPlannerItemQuerySet.as_manager()
    """
    A single listing placed into a specific day of a trip plan.
    Captures price and duration snapshots at add time.

    Relationships:
    - belongs to a TripPlanner
    - references a Listing (snapshot data stored locally)
    """

    # parent plan
    trip_planner = models.ForeignKey(
        TripPlanner,
        on_delete=models.CASCADE,
        related_name='items'
    )

    # referenced listings
    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.CASCADE,
        related_name='trip_plan_items'
    )

    # Position in the timeline
    day_number = models.PositiveIntegerField(
        help_text="Day within the plan (1-based, 1..total_days)"
    )

    order = models.PositiveIntegerField(
        default=0,
        help_text="Sort order within the day (lower = first)"
    )

    # Snapshots — frozen at add time
    price_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Listing price_per_person captured at add time"
    )

    duration_type_snapshot = models.CharField(
        max_length=20,
        help_text="Listing duration_type captured at add time"
    )

    duration_days_snapshot = models.PositiveIntegerField(
        default=1,
        help_text="Listing duration_days captured at add time"
    )

    duration_nights_snapshot = models.PositiveIntegerField(
        default=0,
        help_text="Listing duration_nights captured at add time"
    )

    duration_hours_snapshot = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Listing average_duration_hours captured at add time"
    )

    # traveller notes
    notes = models.TextField(
        blank=True,
        help_text="Optional notes from the traveller"
    )

    # Set when a BookingItem for this plan item is confirmed.
    # Intentionally not a FK to bookings.BookingItem to avoid circular dependency.
    booked_at = models.DateTimeField(
        null=True, blank=True,
        db_index=True,
        help_text="Set when the corresponding booking is confirmed."
    )

    removed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Set when the item is system-removed from the active trip planner UI.",
    )

    removal_reason = models.CharField(
        max_length=40,
        choices=TripPlannerItemRemovalReason.choices,
        blank=True,
        default="",
        help_text="Why the item was system-removed from the active trip planner UI.",
    )

    # timestamp
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['day_number', 'order']
        indexes = [
            models.Index(fields=['trip_planner', 'day_number']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['trip_planner', 'day_number', 'order'],
                name='unique_trip_item_order_per_day'
            )
        ]

    
    @property
    def is_booked(self) -> bool:
        return self.booked_at is not None

    @property
    def is_removed(self) -> bool:
        return self.removed_at is not None

    def __str__(self):
        return f"Day {self.day_number} #{self.order} - {self.listing.title}"
