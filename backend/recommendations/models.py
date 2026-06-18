from django.db import models
from django.conf import settings
from pgvector.django import VectorField
import uuid


class RecommendationModelVersion(models.Model):
    """
    Tracks which artifact bundle version is active.

    Each time a new artifact bundle is deployed, a new row is created.

    Only one version is active at a time (is_active=True).
    
    The active version's PK is embedded in cache keys and used to decide which ListingFeatureSnapshot rows are current.
    """

    version_label = models.CharField(
        max_length=100,
        unique=True,
        help_text="Human-readable version label, e.g. 'v1.0.0-2026-03-20'",
    )

    artifact_hash = models.CharField(
        max_length=128,
        help_text="SHA-256 hash of production_transform_bundle.pkl for integrity verification",
    )

    sklearn_version = models.CharField(
        max_length=30,
        help_text="scikit-learn version used to export the bundle, e.g. '1.4.2'",
    )

    vector_dimension = models.PositiveIntegerField(
        help_text="Dimensionality of the output vector from the transform bundle",
    )

    notes = models.TextField(
        blank=True,
        help_text="Optional notes about this version (training details, performance, etc.)",
    )

    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Only one version should be active at a time",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Recommendation Model Version'
        verbose_name_plural = 'Recommendation Model Versions'
    
    def __str__(self):
        active = " [ACTIVE]" if self.is_active else ""
        return f"{self.version_label}{active}"


class ListingFeatureSnapshot(models.Model):
    """
    Stores the dense vector embedding for a single listing under a specific model version.

    One row per (listing, model_version) pair. When a new model version is deployed, a full reindex creates new rows; old rows for the previous version can be cleaned up later.

    The `embedding` field uses pgvector's vector type for efficient nearest-neighbor search via IVFFlat or HNSW indexes.
    """

    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.CASCADE,
        related_name='feature_snapshots',
    )

    model_version = models.ForeignKey(
        RecommendationModelVersion,
        on_delete=models.CASCADE,
        related_name='snapshots',
    )

    embedding = VectorField(
        dimensions=settings.RECOMMENDATION_VECTOR_DIMENSION,
        help_text="Dense vector embedding produced by the artifact transform bundle",
    )

    vector_type = models.CharField(
        max_length=30,
        default='content',
        db_index=True,
        help_text=(
            "Type of vector stored. Phase 1 only uses 'content'. "
            "Future phases may add 'collaborative', 'hybrid', etc."
        ),
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional metadata (e.g. preprocessing warnings, feature stats)",
    )

    indexed_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['listing', 'model_version', 'vector_type'],
                name='unique_listing_version_vector_type',
            ),
        ]
        indexes = [
            models.Index(
                fields=['model_version', 'vector_type'],
                name='idx_snapshot_version_type',
            ),
        ]
        verbose_name = 'Listing Feature Snapshot'
        verbose_name_plural = 'Listing Feature Snapshots'
    
    def __str__(self):
        return f"Snapshot listing={self.listing_id} v={self.model_version_id} type={self.vector_type}"


class UserBehaviorProfileSnapshot(models.Model):
    """
    Stores a materialized behavior profile for one user under one model version.

    This moves expensive behavior aggregation off the /for-you/ request path while keeping the same profile shape that the synchronous builder already returns.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='behavior_profile_snapshots',
    )

    model_version = models.ForeignKey(
        RecommendationModelVersion,
        on_delete=models.CASCADE,
        related_name='behavior_profile_snapshots',
    )

    behavior_vector = models.JSONField(
        null=True,
        blank=True,
        help_text=(
            "Serialized behavior vector as a JSON list. Null for sparse "
            "profiles where behavior blending should be skipped."
        ),
    )

    is_sparse = models.BooleanField(
        default=True,
        help_text="Whether this profile should skip behavior blending.",
    )

    event_count = models.PositiveIntegerField(default=0)
    distinct_listing_count = models.PositiveIntegerField(default=0)
    top_listing_ids = models.JSONField(default=list, blank=True)
    recommendation_event_count = models.PositiveIntegerField(default=0)
    interaction_event_count = models.PositiveIntegerField(default=0)
    rebuilt_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rebuilt_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'model_version'],
                name='unique_behavior_snapshot_user_version',
            ),
        ]
        indexes = [
            models.Index(
                fields=['user', 'rebuilt_at'],
                name='idx_beh_snap_user_rebuilt',
            ),
            models.Index(
                fields=['model_version', 'rebuilt_at'],
                name='idx_beh_snap_ver_rebuilt',
            ),
        ]
        verbose_name = 'User Behavior Profile Snapshot'
        verbose_name_plural = 'User Behavior Profile Snapshots'

    def __str__(self):
        return (
            f"BehaviorSnapshot user={self.user_id} "
            f"v={self.model_version_id} sparse={self.is_sparse}"
        )


class ServedRecommendationSet(models.Model):
    """
    Records a recommendation slate served to a user.

    Every recommendation API response creates one row here, storing:

        - what results were returned and in what order
        - which strategy and model version produced them
        - the seed context (source listing for similar, user for for-you)
        - a request_id that the frontend uses to report events back

    The results_json field stores the full ordered slate as JSON, avoiding premature normalization. This is write-heavy, read-light data — JSON is the right choice until analytics requires relational queries on individual result positions.
    """

    request_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Unique identifier for this recommendation request. Returned to frontend for event correlation.",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='served_recommendation_sets',
        help_text="Authenticated user who received these recommendations. Null for anonymous.",
    )

    session_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
        help_text="Frontend-generated session UUID for anonymous tracking. Empty if authenticated.",
    )

    surface = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Which recommendation surface served this: 'similar' or 'for_you'.",
    )

    strategy = models.CharField(
        max_length=50,
        help_text="Strategy used: 'content_based', 'preference_based', 'popular_fallback'.",
    )

    model_version = models.ForeignKey(
        'recommendations.RecommendationModelVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='served_sets',
        help_text="Model version active when recommendations were generated. Null for fallback.",
    )

    seed_listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Source listing for 'similar' surface. Null for 'for_you'.",
    )

    result_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of results in the slate. Denormalized for fast aggregation.",
    )

    results_json = models.JSONField(
        default=list,
        help_text=(
            "Ordered list of result entries. Each entry: "
            "{'listing_id': int, 'position': int, 'distance': float|null}. "
            "Position is 1-indexed."
        ),
    )

    serving_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Additional serve-time metadata for observability, such as "
            "behavior signal source and behavior event counters."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='idx_served_user_created'),
            models.Index(fields=['surface', 'created_at'], name='idx_served_surface_created'),
            models.Index(fields=['strategy', 'created_at'], name='idx_served_strategy_created'),
        ]
        verbose_name = 'Served Recommendation Set'
        verbose_name_plural = 'Served Recommendation Sets'

    def __str__(self):
        return f"ServedSet {self.request_id} ({self.surface}/{self.strategy}, {self.result_count} results)"


class RecommendationEvent(models.Model):
    """
    Records a frontend interaction event tied to a recommendation slate.

    Events flow:
        - Backend serves recommendations → create ServedRecommendationSet → returns request_id
        - Frontend renders results → sends impression events
        - User clicks a card → frontend sends click event
        - User opens detail page → frontend sends detail_open event

    Each event references the served set via request_id (and optionally via FK).

    Both request_id and served_set FK are stored because:
        - request_id allows fast ingestion without FK lookup
        - served_set FK allows efficient JOINs in analytics
        - the FK is resolved at ingestion time if the served set exists
    """
    served_set = models.ForeignKey(
        ServedRecommendationSet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events',
        help_text="Resolved FK to the served slate. Null if request_id didn't match.",
    )

    request_id = models.UUIDField(
        db_index=True,
        help_text="The request_id from the recommendation response. Always present.",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendation_events',
        help_text="Authenticated user. Null for anonymous.",
    )

    session_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
        help_text="Frontend session UUID. Empty if authenticated user is present.",
    )

    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="The listing this event is about. Null only if event is slate-level.",
    )

    event_type = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Event type: 'impression', 'click', 'detail_open'.",
    )

    surface = models.CharField(
        max_length=30,
        help_text="Recommendation surface: 'similar' or 'for_you'.",
    )

    strategy = models.CharField(
        max_length=50,
        help_text="Strategy that produced the recommendation: 'content_based', 'preference_based', 'popular_fallback'.",
    )

    model_version_label = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Snapshot of model version label at event time. Empty for fallback.",
    )

    position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="1-indexed rank position of the listing in the served slate.",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional frontend context: source_component, viewport info, etc.",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', 'created_at'], name='idx_event_type_created'),
            models.Index(fields=['user', 'created_at'], name='idx_event_user_created'),
            models.Index(fields=['listing', 'event_type'], name='idx_event_listing_type'),
            models.Index(fields=['surface', 'event_type', 'created_at'], name='idx_event_surface_type_created'),
        ]
        verbose_name = 'Recommendation Event'
        verbose_name_plural = 'Recommendation Events'

    def __str__(self):
        return f"Event {self.event_type} listing={self.listing_id} request={self.request_id}"


class ListingInteractionEvent(models.Model):
    """
    Records a general listing browsing interaction from the frontend.

    This model captures non-recommendation listing interactions — catalog browsing, search result clicks, and direct listing-detail opens — that are useful for behavior personalization.

    Separate from RecommendationEvent, which is recommendation-attribution specific and tied to served slates via request_id.

    Events flow:
        - User browses catalog, search results, or listing detail pages
        - Frontend sends click/detail_open events here
        - Part 3 will read these events to build a unified behavior profile
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listing_interaction_events',
        help_text="Authenticated user. Null only if user account is deleted.",
    )

    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="The listing this interaction is about.",
    )

    event_type = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Interaction type: 'click' or 'detail_open'.",
    )

    surface = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Browsing surface: 'catalog', 'search_results', or 'listing_detail'.",
    )

    position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="1-indexed position of the listing in the source list. Null when not applicable.",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional frontend context: search query, active filters, referrer path, etc.",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['user', 'created_at'],
                name='idx_li_event_user_created',
            ),
            models.Index(
                fields=['event_type', 'created_at'],
                name='idx_li_event_type_created',
            ),
            models.Index(
                fields=['surface', 'created_at'],
                name='idx_li_event_surf_created',
            ),
            models.Index(
                fields=['listing', 'event_type'],
                name='idx_li_event_listing_type',
            ),
        ]
        verbose_name = 'Listing Interaction Event'
        verbose_name_plural = 'Listing Interaction Events'
    
    def __str__(self):
        return f"Interaction {self.event_type} listing={self.listing_id} surface={self.surface}"
