import logging
from dataclasses import dataclass

import numpy as np
from django.conf import settings

from recommendations.services.behavior_profile_service import BehaviorProfile
from recommendations.services.preprocessing import preprocess_traveller_query
from recommendations.services.vectorizer import vectorize_query

logger = logging.getLogger('recommendations')


# Signal source classification

def _classify_signal_source(
    recommendation_event_count: int,
    interaction_event_count: int,
) -> str:
    """
    Classify the origin of behavior signals in the profile.

    Returns one of:
        'none' — no qualifying events from either stream
        'recommendation_only' — all events from RecommendationEvent
        'browsing_only' — all events from ListingInteractionEvent
        'mixed' — events from both streams
    """
    if recommendation_event_count == 0 and interaction_event_count == 0:
        return 'none'
    if interaction_event_count == 0:
        return 'recommendation_only'
    if recommendation_event_count == 0:
        return 'browsing_only'
    return 'mixed'


# Result dataclass

@dataclass(frozen=True)
class BehaviorQueryResult:
    """
    Result of the behavior query builder.

    Contains the final query vector for /for-you/ retrieval, along with metadata about how it was produced (whether behavior was blended, the alpha used, event counts, signal source, etc.).

    The preference_vector field always contains the pure onboarding-derived vector before any blending, for diagnostics and future A/B comparisons.
    """
    query_vector: np.ndarray
    preference_vector: np.ndarray
    preprocessed_payload: dict
    strategy: str
    behavior_used: bool
    alpha_applied: float
    behavior_event_count: int
    behavior_listing_count: int
    recommendation_event_count: int
    interaction_event_count: int
    behavior_signal_source: str


# Builder

def build_behavior_query(
    *,
    user,
    behavior_profile: BehaviorProfile,
    preprocessed_payload: dict | None = None,
    preference_vector: np.ndarray | None = None,
) -> BehaviorQueryResult:
    """
    Build the final query vector for /for-you/ by optionally blending the user's onboarding preference vector with their behavior profile vector.

        - Preprocesses the user's onboarding preferences into the canonical artifact-aligned payload.
        - Vectorizes that payload to produce the preference_vector.
        - Classifies the behavior signal source (recommendation-only, browsing-only, mixed, or none).
        - If the behavior profile is non-sparse, blends the preference_vector with the behavior_vector using alpha weighting and L2-normalizes.
        - Returns a BehaviorQueryResult with the final query_vector, strategy label, signal source classification, and diagnostic metadata.

    Raises ArtifactLoadError if the artifact bundle cannot be loaded during preprocessing or vectorization. The caller is responsible for catching this and falling back.
    """
    preprocessed = (
        preprocessed_payload
        if preprocessed_payload is not None
        else preprocess_traveller_query(user)
    )
    preference_vector = (
        preference_vector
        if preference_vector is not None
        else vectorize_query(preprocessed)
    )

    signal_source = _classify_signal_source(
        behavior_profile.recommendation_event_count,
        behavior_profile.interaction_event_count,
    )

    if behavior_profile.is_sparse or behavior_profile.behavior_vector is None:
        logger.debug(
            "Behavior query builder: sparse profile for user %s "
            "(source=%s, reco_events=%d, interaction_events=%d), "
            "using preference-only vector",
            getattr(user, 'pk', '?'),
            signal_source,
            behavior_profile.recommendation_event_count,
            behavior_profile.interaction_event_count,
        )
        return BehaviorQueryResult(
            query_vector=preference_vector,
            preference_vector=preference_vector,
            preprocessed_payload=preprocessed,
            strategy='preference_based',
            behavior_used=False,
            alpha_applied=0.0,
            behavior_event_count=behavior_profile.event_count,
            behavior_listing_count=behavior_profile.distinct_listing_count,
            recommendation_event_count=behavior_profile.recommendation_event_count,
            interaction_event_count=behavior_profile.interaction_event_count,
            behavior_signal_source=signal_source,
        )

    alpha = settings.RECOMMENDATION_BEHAVIOR_ALPHA
    blended = _blend_vectors(preference_vector, behavior_profile.behavior_vector, alpha)

    if blended is None:
        logger.warning(
            "Behavior query builder: zero-norm blended vector for user %s "
            "(source=%s), falling back to preference-only",
            getattr(user, 'pk', '?'),
            signal_source,
        )
        return BehaviorQueryResult(
            query_vector=preference_vector,
            preference_vector=preference_vector,
            preprocessed_payload=preprocessed,
            strategy='preference_based',
            behavior_used=False,
            alpha_applied=0.0,
            behavior_event_count=behavior_profile.event_count,
            behavior_listing_count=behavior_profile.distinct_listing_count,
            recommendation_event_count=behavior_profile.recommendation_event_count,
            interaction_event_count=behavior_profile.interaction_event_count,
            behavior_signal_source=signal_source,
        )

    logger.info(
        "Behavior query builder: blended vector for user %s "
        "(alpha=%.2f, events=%d, listings=%d, source=%s, "
        "reco_events=%d, interaction_events=%d)",
        getattr(user, 'pk', '?'),
        alpha,
        behavior_profile.event_count,
        behavior_profile.distinct_listing_count,
        signal_source,
        behavior_profile.recommendation_event_count,
        behavior_profile.interaction_event_count,
    )

    return BehaviorQueryResult(
        query_vector=blended,
        preference_vector=preference_vector,
        preprocessed_payload=preprocessed,
        strategy='behavior_enhanced',
        behavior_used=True,
        alpha_applied=alpha,
        behavior_event_count=behavior_profile.event_count,
        behavior_listing_count=behavior_profile.distinct_listing_count,
        recommendation_event_count=behavior_profile.recommendation_event_count,
        interaction_event_count=behavior_profile.interaction_event_count,
        behavior_signal_source=signal_source,
    )


# Vector blending

def _blend_vectors(
    preference_vector: np.ndarray,
    behavior_vector: np.ndarray,
    alpha: float,
) -> np.ndarray | None:
    """
    Compute the alpha-weighted blend of preference and behavior vectors, then L2-normalize.

    Returns None if the resulting vector has near-zero norm (degenerate cancellation).
    """
    blended = alpha * behavior_vector + (1.0 - alpha) * preference_vector

    norm = np.linalg.norm(blended)
    if norm < 1e-10:
        return None

    return (blended / norm).astype(np.float32)
