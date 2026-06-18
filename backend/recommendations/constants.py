# Listing fields that, when changed, should trigger a reindex of that listing's
# embedding. Other fields (title changes for SEO, image uploads, etc.) do not affect the recommendation vector.
REINDEX_TRIGGER_FIELDS = frozenset({
    'title',
    'description',
    'destination',
    'category',
    'activity_type',
    'difficulty_level',
    'duration_type',
    'duration_days',
    'duration_nights',
    'average_duration_hours',
    'tags',
    'ideal_for',
    'best_seasons',
    'languages_offered',
    'max_group_size',
    'instant_booking',
    'is_bookable',
    'is_active',
})


# Tracking

# Allowed event types for the event ingestion endpoint.
ALLOWED_EVENT_TYPES = frozenset({
    'impression',
    'click',
    'detail_open',
})

# Allowed recommendation surfaces.
ALLOWED_SURFACES = frozenset({
    'similar',
    'for_you',
})

# Known recommendation strategies.
# Used for validation at ingestion and stored on served slates.
ALLOWED_STRATEGIES = frozenset({
    'content_based',        # Phase 1 similar: content vector similarity
    'preference_based',     # Phase 1 for-you: traveller preferences → query vector
    'behavior_enhanced',    # Phase 2.5 for-you: behavior-blended query vector
    'popular_fallback',     # Fallback: popular listings when model/preferences unavailable
})


# Browsing Interaction Tracking

# Allowed surfaces for the general listing interaction endpoint.
# These are non-recommendation browsing surfaces.
ALLOWED_INTERACTION_SURFACES = frozenset({
    'catalog',
    'search_results',
    'listing_detail',
})

# Allowed event types for the general listing interaction endpoint.
ALLOWED_INTERACTION_EVENT_TYPES = frozenset({
    'click',
    'detail_open',
})

# Event types from listing interactions that qualify for behavior profiling.
# Used by the tracking service to decide whether to bump user_behavior_generation.
QUALIFYING_INTERACTION_EVENT_TYPES = frozenset({
    'click',
    'detail_open',
})


# Frontend traveller preference normalization
#
# The traveller UI uses a compact, human-facing taxonomy. The recommendation artifacts were trained on listing-native tags and activity labels, so we map frontend selections into the closest artifact-aligned signals here.
FRONTEND_ACTIVITY_SIGNAL_MAP = {
    'hiking': {
        'activity_type': 'HIKING',
        'category': 'adventure',
        'tags': ['hiking', 'ridge hiking'],
        'description': ['hiking', 'ridge hiking', 'outdoor day'],
    },
    'cultural tours': {
        'activity_type': 'CITY_TOUR',
        'category': 'cultural',
        'tags': ['cultural route', 'cultural visit', 'local culture'],
        'description': ['cultural tours', 'local culture', 'heritage walk'],
    },
    'nature walks': {
        'activity_type': 'HIKING',
        'category': 'nature',
        'tags': ['nature walks', 'nature day', 'easy walking'],
        'description': ['nature walks', 'nature', 'easy walking'],
    },
    'adventure sports': {
        'activity_type': '',
        'category': 'adventure',
        'tags': ['adventure', 'outdoor adventure', 'adventure day'],
        'description': ['adventure sports', 'adventure', 'outdoor adventure'],
    },
    'photography': {
        'activity_type': 'CITY_TOUR',
        'category': 'photography',
        'tags': ['photography', 'photo walk', 'photography walk'],
        'description': ['photography', 'photo walk', 'heritage photography'],
    },
    'food & local experiences': {
        'activity_type': 'COOKING_CLASS',
        'category': 'food tours',
        'tags': ['food tour', 'local food experience', 'local culture'],
        'description': ['food', 'local food', 'local culture', 'food tour', 'cooking class'],
    },
}

FRONTEND_TRAVEL_STYLE_SIGNAL_MAP = {
    'solo': {
        'ideal_for': [],
        'description': ['solo travelers'],
    },
    'couple': {
        'ideal_for': [],
        'description': ['couples'],
    },
    'family': {
        'ideal_for': ['family travel'],
        'description': ['family travel'],
    },
    'group': {
        'ideal_for': ['group trips'],
        'description': ['group trips', 'groups and friends'],
    },
    'luxury': {
        'ideal_for': [],
        'description': ['luxury travel', 'comfort-focused stays'],
    },
    'budget traveler': {
        'ideal_for': [],
        'description': ['budget travel', 'value-focused travel'],
    },
}
