from decimal import Decimal

from django.db import models

# Business assumption constants used in Listing.save() duration computation
ACTIVE_HOURS_PER_DAY = 8   # productive/activity hours assumed per full day
HOURS_PER_NIGHT = 16       # hours assumed per overnight stay (includes rest time)


#=========================
# ENUMS
#=========================

class Category(models.TextChoices):
    """
    Main categories for travel experiences.
    These are broad classifications that help users browse.
    """
    ADVENTURE = "adventure", "Adventure"
    CULTURAL = "cultural", "Cultural"
    NATURE = "nature", "Nature & Wildlife"
    FOOD_TOURS = "food_tours", "Food Tours"
    WELLNESS = "wellness", "Wellness & Spiritual"
    PHOTOGRAPHY = "photography", "Photography Tours"
    TREKKING = "trekking", "Trekking & Hiking"
    HERITAGE = "heritage", "Heritage Tours"
    VILLAGE = "village", "Village Experiences"
    FESTIVAL = "festival", "Festival & Events"


class ActivityType(models.TextChoices):
    """
    Specific activity types within categories
    More granular than Category - helps with precise filtering.

    Example: Category=ADVENTURE could have ActivityType=RAFTING or PARAGLIDING
    """
    HIKING = "hiking", "Hiking"
    TREKKING = "trekking", "Trekking"
    RAFTING = "rafting", "Rafting"
    PARAGLIDING = "paragliding", "Paragliding"
    BUNGEE = "bungee", "Bungee Jumping"
    CYCLING = "cycling", "Cycling"
    TEMPLE_VISIT = "temple_visit", "Temple Visit"
    COOKING_CLASS = "cooking_class", "Cooking Class"
    MEDITATION = "meditation", "Meditation"
    YOGA = "yoga", "Yoga Retreat"
    WILDLIFE_SAFARI = "wildlife_safari", "Wildlife Safari"
    BIRD_WATCHING = "bird_watching", "Bird Watching"
    CITY_TOUR = "city_tour", "City Tour"
    HOMESTAY = "homestay", "Homestay Experience"
    MOUNTAIN_FLIGHT = "mountain_flight", "Mountain Flight"


class DifficultyLevel(models.TextChoices):
    """
    Physical difficulty level.
    Helps travellers choose appropriate experiences for their fitness level.
    """
    EASY = "easy", "Easy"
    MODERATE = "moderate", "Moderate"
    CHALLENGING = "challenging", "Challenging"
    DIFFICULT = "difficult", "Difficult"
    EXPERT = "expert", "Expert Only"


class DurationType(models.TextChoices):
    """
    Duration intent for scheduling/planning.
    """
    HOURLY = "hourly", "Hourly"
    FULL_DAY = "full_day", "Full Day"
    MULTI_DAY = "multi_day", "Multi Day"


class IdealFor(models.TextChoices):
    """
    Target audience for this experience.
    Helps travellers find experiences suited to their travel style.

    SENIOR DEV NOTE: This is kept as TextChoices for validation,
    but the field itself is JSONField (see below) to allow MULTIPLE selections.
    A trek can be ideal for BOTH 'solo' AND 'couples' AND 'groups'.
    """
    SOLO = "solo", "Solo Travelers"
    COUPLES = "couples", "Couples"
    FAMILIES = "families", "Families"
    GROUPS = "groups", "Groups"
    SENIORS = "seniors", "Seniors"
    ADVENTURE_SEEKERS = "adventure_seekers", "Adventure Seekers"


class CancellationPolicy(models.TextChoices):
    """
    Cancellation policies for bookings.
    Important for user expectations and legal clarity.
    """
    FLEXIBLE = "flexible", "Free cancellation up to 24 hours before"
    MODERATE = "moderate", "Free cancellation up to 3 days before"
    STRICT = "strict", "50% refund up to 7 days before"
    NON_REFUNDABLE = "non_refundable", "No refunds"


class BestSeason(models.TextChoices):
    """
    Optimal seasons for this experience.
    Nepal has distinct seasons that affect activity viability.
    """
    SPRING = "spring", "Spring (Mar-May)"
    SUMMER = "summer", "Summer/Monsoon (Jun-Aug)"
    AUTUMN = "autumn", "Autumn (Sep-Nov)"
    WINTER = "winter", "Winter (Dec-Feb)"
    YEAR_ROUND = "year_round", "Year Round"



#=========================
# QUERYSETS
#=========================

class ListingQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def public(self):
        return self.filter(
            is_active=True,
            is_bookable=True,
            host__user__is_active=True,
        )


#=========================
# MODELS
#=========================

class Listing(models.Model):
    objects = ListingQuerySet.as_manager()
    """
    A travel experience/activity offered by a host.
    Represents what hostsare selling and what travellers are browsing/booking.

    Relationships:
    - belongs to a HostDetail (the owner)
    - has many ListingImages (gallery)
    - will have many Bookings (future module)
    - will have many Reviews (future module)
    """

    # relationshitp with host 
    host = models.ForeignKey(
        'accounts.HostDetail',
        on_delete=models.CASCADE,
        related_name='listings'
    )


    # baisc info 

    title = models.CharField(
        max_length=255,
        help_text="Descriptive title for the experience"
    )

    description = models.TextField(
        help_text="Detailed description including what's included, what to expect, etc."
    )

    destination = models.CharField(
        max_length=255,
        help_text="City or region (e.g., 'Kathmandu', 'Pokhara', 'Chitwan')"
    )

    location = models.CharField(
        max_length=500,
        help_text="Specific meeting point or area details"
    )

    
    # classification 
    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        db_index=True
    )

    activity_type = models.CharField(
        max_length=50,
        choices=ActivityType.choices,
        db_index=True
    )

    difficulty_level = models.CharField(
        max_length=20,
        choices=DifficultyLevel.choices,
        default=DifficultyLevel.EASY
    )

    ideal_for = models.JSONField(
        default=list,
        blank=True,
        help_text="List of target audiences, e.g., ['solo', 'couples', 'groups']"
    )

    
    # pricing and durations

    price_per_person = models.DecimalField(
        max_digits=10,      # Up to 99,999,999.99
        decimal_places=2,
        help_text="Price in NPR per person"
    )

    # Duration fields - separate days and nights for multi-day experiences
    duration_type = models.CharField(
        max_length=20,
        choices=DurationType.choices,
        default=DurationType.FULL_DAY,
        db_index=True,
        help_text="Scheduling intent (hourly, full day, multi day)"
    )

    duration_days = models.PositiveIntegerField(
        default=1,
        help_text="Number of full days for the experience"
    )

    duration_nights = models.PositiveIntegerField(
        default=0,
        help_text="Number of nights (for multi-day experiences with overnight stays)"
    )

    # Computed field for filtering/sorting - auto-calculated on save
    average_duration_hours = models.DecimalField(
        max_digits=6,       # Supports very long experiences
        decimal_places=1,
        default=0,
        editable=False,     # Computed, not user-editable
        help_text="Auto-calculated from days/nights. Used for filtering."
    )

    # meta data 
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Flexible tags like ['scenic', 'sunrise', 'beginner-friendly']"
    )
    
    slug = models.SlugField(
        max_length=280,
        unique=True,
        blank=True,
        help_text="SEO-friendly URL slug, auto-generated from title if not provided"
    )

    # practical information
    what_to_bring = models.TextField(
        blank=True,
        help_text="Items guests should bring, e.g., 'Comfortable shoes, water, sunscreen'"
    )

    requirements = models.TextField(
        blank=True,
        help_text="Mandatory requirements for guests. E.g., 'Minimum age 18', 'Valid passport required', 'Good physical fitness'"
    )

    inclusions = models.JSONField(
        default=list,
        blank=True,
        help_text="What's included in the price, e.g., ['Guide', 'Transportation', 'Lunch']"
    )

    exclusions = models.JSONField(
        default=list,
        blank=True,
        help_text="What's NOT included, e.g., ['Personal expenses', 'Travel insurance']"
    )

    cancellation_policy = models.CharField(
        max_length=20,
        choices=CancellationPolicy.choices,
        default=CancellationPolicy.MODERATE,
        help_text="Refund policy for cancelled bookings"
    )

    languages_offered = models.JSONField(
        default=list,
        blank=True,
        help_text="Languages the guide can communicate in, e.g., ['english', 'nepali', 'hindi']"
    )

    # ratings 
    rating_average = models.DecimalField(
        max_digits=3,       # Up to 9.99 (we use 0-5 scale)
        decimal_places=2,
        default=0.00
    )

    rating_count = models.PositiveIntegerField(default=0)

    booking_count = models.PositiveIntegerField(default=0, editable=False)

    # Seasonal recommendations
    best_seasons = models.JSONField(
        default=list,
        blank=True,
        help_text="List of optimal seasons, e.g., ['autumn', 'spring']. Validated against BestSeason choices."
    )

    is_bookable = models.BooleanField(
        default=False,
        help_text="Controls public visibility and booking ability"
    )

    max_group_size = models.PositiveIntegerField(
        default=10,
        help_text="Maximum participants per booking"
    )

    min_group_size = models.PositiveIntegerField(
        default=1,
        help_text="Minimum participants required"
    )

    instant_booking = models.BooleanField(
        default=False,
        help_text="If True, guests can book without host approval"
    )

    # soft delete 
    is_active = models.BooleanField(default=True)

    # timestamps 
    created_at = models.DateTimeField(auto_now_add=True)  # Set once on creation
    updated_at = models.DateTimeField(auto_now=True)      # Updated on every save

    class Meta:
        ordering = ['-created_at']  # Newest first by default

        # Database indexes for common queries
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['destination']),
            models.Index(fields=['price_per_person']),
            models.Index(fields=['-rating_average']),  # For "top rated" queries
            models.Index(fields=['instant_booking']),  # Instant booking filter
        ]

    def __str__(self):
        return f"{self.title} - {self.destination}"

    def save(self, *args, **kwargs):
        # Auto-compute average_duration_hours from days/nights
        # Assumption: 8 active hours per day, 16 hours per night (includes rest time)
        if self.duration_type == DurationType.HOURLY:
            if not self.average_duration_hours or self.average_duration_hours <= 0:
                if self.duration_days > 0 or self.duration_nights > 0:
                    self.average_duration_hours = Decimal(
                        str((self.duration_days * ACTIVE_HOURS_PER_DAY) + (self.duration_nights * HOURS_PER_NIGHT))
                    )
        else:
            if self.duration_days > 0 or self.duration_nights > 0:
                self.average_duration_hours = Decimal(
                    str((self.duration_days * ACTIVE_HOURS_PER_DAY) + (self.duration_nights * HOURS_PER_NIGHT))
                )

        # Auto-generate slug if not provided
        if not self.slug:
            from django.utils.text import slugify
            import uuid
            base_slug = slugify(self.title)[:250]
            self.slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        super().save(*args, **kwargs)

    # computed properties

    @property
    def is_visible(self) -> bool:
        """Listing is visible to guests when active and bookable."""
        return self.is_active and self.is_bookable

    @property
    def host_name(self) -> str:
        """Get displayable host name."""
        return self.host.business_name or self.host.user.full_name

    @property
    def duration_display(self) -> str:
        """Human-readable duration string combining days and nights."""
        if self.duration_type == DurationType.HOURLY:
            hours = float(self.average_duration_hours or 0)
            if hours < 1:
                return f"{int(hours * 60)} minutes"
            elif hours == int(hours):
                return f"{int(hours)} hour{'s' if hours > 1 else ''}"
            else:
                return f"{hours} hours"

        if self.duration_type == DurationType.FULL_DAY:
            return "Full day"

        days = self.duration_days or 0
        nights = self.duration_nights or 0

        if days and nights:
            return f"{days} days / {nights} nights"
        if nights and not days:
            return f"{nights + 1} days / {nights} nights"
        if days:
            return f"{days} day{'s' if days > 1 else ''}"

        # Fallback
        return "0 days"

    @property
    def primary_image(self):
        """Get the primary image for this listing."""
        return self.images.filter(is_primary=True).first()


class ActivitySlot(models.Model):
    """
    A specific departure/date instance of an activity with a fixed capacity.

    Hosts create slots for their listings. Bookings consume capacity from slots.
    Supports all three duration types:
      - HOURLY:    start_date = end_date, start_time + end_time set
      - FULL_DAY:  start_date = end_date, no times
      - MULTI_DAY: start_date < end_date, no times
    """
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name="slots",
    )

    start_date = models.DateField()

    end_date = models.DateField()

    start_time = models.TimeField(
        null=True, blank=True,
        help_text="Only for HOURLY slots",
    )

    end_time = models.TimeField(
        null=True, blank=True,
        help_text="Only for HOURLY slots",
    )

    capacity = models.PositiveIntegerField(
        help_text="Total seats/spots available for this slot",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Inactive slots cannot be booked",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["listing", "start_date", "is_active"]),
            models.Index(fields=["listing", "start_date", "end_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "start_date", "end_date", "start_time"],
                name="unique_slot_per_listing_schedule",
            )
        ]

    def __str__(self):
        time_part = f" {self.start_time}–{self.end_time}" if self.start_time else ""
        return f"Slot #{self.pk} — {self.listing.title} [{self.start_date}→{self.end_date}{time_part}]"


class ListingSchedule(models.Model):
    """
    Recurring schedule template that drives automatic ActivitySlot generation.

    The nightly Celery task (and manual management command) walks every active
    ListingSchedule and calls get_or_create for each qualifying day up to
    `advance_days` ahead.

    days_of_week examples:
        [0, 1, 2, 3, 4, 5, 6]  — every day
        [0, 2, 4]               — Mon / Wed / Fri
        [5, 6]                  — weekends only

    time_slots (HOURLY listings only):
        [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "17:00"}]
        FULL_DAY / MULTI_DAY listings must leave this as []
    """
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    days_of_week = models.JSONField(
        help_text="List of weekday ints (0=Monday … 6=Sunday), e.g. [0,2,4]",
    )

    time_slots = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'HOURLY only: [{"start":"09:00","end":"12:00"}]. '
            'Must be [] for FULL_DAY / MULTI_DAY listings.'
        ),
    )

    capacity = models.PositiveIntegerField(
        help_text="Default capacity for each generated slot",
    )

    advance_days = models.PositiveIntegerField(
        default=90,
        help_text="How many days ahead to pre-fill slots",
    )

    valid_from = models.DateField(
        null=True, blank=True,
        help_text="Start of the schedule window (inclusive). Defaults to today if blank.",
    )

    valid_until = models.DateField(
        null=True, blank=True,
        help_text="End of the schedule window (inclusive). No end if blank.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Inactive schedules are skipped during generation.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["listing", "is_active"]),
        ]

    def __str__(self):
        days = self.days_of_week
        return f"Schedule #{self.pk} — {self.listing.title} (days={days}, cap={self.capacity})"


class SlotException(models.Model):
    """
    One-off override for a specific date on a listing.

    Use cases:
      - is_closed=True          → holiday / bad weather closure
      - capacity_override=N     → special large-group day or reduced capacity
    Exactly one of the two should be set per exception.
    """
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name="slot_exceptions",
    )

    date = models.DateField(
        help_text="The specific date this exception applies to",
    )

    is_closed = models.BooleanField(
        default=False,
        help_text="If True, no slots will be generated or offered on this date",
    )

    capacity_override = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Override the schedule's default capacity for this date only",
    )

    note = models.CharField(
        max_length=255, blank=True,
        help_text="Internal note (e.g. 'Dashain holiday', 'Private group booking')",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("listing", "date")]
        indexes = [
            models.Index(fields=["listing", "date"]),
        ]

    def __str__(self):
        kind = "CLOSED" if self.is_closed else f"cap={self.capacity_override}"
        return f"Exception — {self.listing.title} on {self.date} [{kind}]"


class ListingImage(models.Model):
    """
    Images for Listing 
    """
    
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='images' # listing.images.all()
    )

    image = models.ImageField(
        upload_to="listings/images/",
        help_text="Full-size image for detail view (auto-compressed to 1920px)"
    )

    thumbnail = models.ImageField(
        upload_to='listings/thumbnails/',
        blank=True,
        help_text="Auto-generated 400x300 thumbnail for list/card views"
    )

    is_primary = models.BooleanField(
        default=False,
        help_text="Primary image shown in listing cards"
    )

    caption = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional description for this image"
    )

    alt_text = models.CharField(
        max_length=255,
        blank=True,
        help_text="Alt text for accessibility (SEO + screen readers)"
    )

    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order in gallery (lower = first)"
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', '-is_primary', '-uploaded_at']

        constraints = [
            models.UniqueConstraint(
                fields=['listing'],
                condition=models.Q(is_primary=True),
                name='unique_primary_image_per_listing'
            )
        ]


    def __str__(self):
        return f"Image for {self.listing.title} ({'Primary' if self.is_primary else 'Gallery'})"

    def save(self, *args, **kwargs):
        if not self.alt_text and self.caption:
            self.alt_text = self.caption
        elif not self.alt_text:
            self.alt_text = f"{self.listing.title} - Image"
        super().save(*args, **kwargs)            
        
