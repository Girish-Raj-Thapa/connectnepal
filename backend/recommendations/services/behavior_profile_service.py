import logging
from dataclasses import dataclass, field
from datetime import timedelta

import numpy as np
from django.conf import settings
from django.utils import timezone

from recommendations.models import (
    ListingFeatureSnapshot,
    ListingInteractionEvent,
    RecommendationEvent,
    RecommendationModelVersion,
)

logger = logging.getLogger('recommendations')

QUALIFYING_EVENT_TYPES = ['click', 'detail_open']

# Default multiplier for unknown surfaces (should not happen in practice).
_DEFAULT_SOURCE_MULTIPLIER = 0.5


def _get_event_type_weights() -> dict[str, float]:
    return {
        'click': settings.RECOMMENDATION_BEHAVIOR_CLICK_WEIGHT,
        'detail_open': settings.RECOMMENDATION_BEHAVIOR_DETAIL_OPEN_WEIGHT,
    }


def _get_source_surface_multipliers() -> dict[str, float]:
    return {
        'similar': settings.RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_SIMILAR,
        'for_you': settings.RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_FOR_YOU,
        'search_results': settings.RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_SEARCH,
        'listing_detail': settings.RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_LISTING_DETAIL,
        'catalog': settings.RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_CATALOG,
    }


@dataclass(frozen=True)
class BehaviorProfile:
    """
    Result of behavior profile aggregation for a single user.

    Aggregates qualifying events from both RecommendationEvent (recommendation- attributed interactions) and ListingInteractionEvent (broader browsing interactions) into a single behavior vector.

    If is_sparse is True, behavior_vector is None and the caller should skip behavior blending entirely.
    """
    behavior_vector: np.ndarray | None
    is_sparse: bool
    event_count: int
    distinct_listing_count: int
    top_listing_ids: list[int] = field(default_factory=list)
    recommendation_event_count: int = 0
    interaction_event_count: int = 0


_SPARSE_PROFILE = BehaviorProfile(
    behavior_vector=None,
    is_sparse=True,
    event_count=0,
    distinct_listing_count=0,
    top_listing_ids=[],
    recommendation_event_count=0,
    interaction_event_count=0,
)


def build_behavior_profile(
    *,
    user_id: int,
    model_version: RecommendationModelVersion,
) -> BehaviorProfile:
    """
    Aggregate a user's interaction history into a unified behavior profile vector.

    Reads qualifying click/detail_open events from two sources:
        1. RecommendationEvent — recommendation-attributed interactions
        2. ListingInteractionEvent — broader browsing interactions

    Normalizes both streams into a unified signal shape, scores them with event-type weights, source-surface multipliers, and recency windows, then computes a weighted-average L2-normalized behavior vector from the top-K interacted listings' content embeddings.

    Returns a sparse profile if the user has fewer than RECOMMENDATION_BEHAVIOR_MIN_LISTINGS distinct listings with both qualifying events and live content snapshots.
    """
    if model_version is None:
        raise ValueError(
            "build_behavior_profile requires a valid RecommendationModelVersion."
        )

    now = timezone.now()
    max_age = now - timedelta(days=settings.RECOMMENDATION_BEHAVIOR_MAX_DAYS)
    recent_cutoff = now - timedelta(days=settings.RECOMMENDATION_BEHAVIOR_RECENT_DAYS)

    # - Fetch qualifying events from both streams.
    reco_events = _fetch_recommendation_events(user_id, max_age)
    interaction_events = _fetch_interaction_events(user_id, max_age)

    reco_count = len(reco_events)
    interaction_count = len(interaction_events)

    # - Normalize into unified signal shape.
    unified_signals = (
        _normalize_recommendation_events(reco_events)
        + _normalize_interaction_events(interaction_events)
    )

    if not unified_signals:
        logger.debug(
            "Behavior profile: no qualifying events for user %d", user_id,
        )
        return _SPARSE_PROFILE

    # - Score signals and accumulate per-listing.
    listing_scores = _score_unified_signals(unified_signals, recent_cutoff)

    # - Select top-K listings.
    top_k = settings.RECOMMENDATION_BEHAVIOR_TOP_K
    top_listing_ids = _select_top_k(listing_scores, top_k)

    # - Fetch embeddings.
    embeddings_map = _fetch_embeddings(top_listing_ids, model_version)

    matched_ids = [lid for lid in top_listing_ids if lid in embeddings_map]
    distinct_count = len(matched_ids)
    total_event_count = reco_count + interaction_count

    # - Sparse threshold check.
    min_listings = settings.RECOMMENDATION_BEHAVIOR_MIN_LISTINGS
    if distinct_count < min_listings:
        logger.info(
            "Behavior profile: sparse for user %d "
            "(distinct_with_snapshots=%d, threshold=%d, total_events=%d, "
            "reco_events=%d, interaction_events=%d)",
            user_id, distinct_count, min_listings, total_event_count,
            reco_count, interaction_count,
        )
        return BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=total_event_count,
            distinct_listing_count=distinct_count,
            top_listing_ids=matched_ids,
            recommendation_event_count=reco_count,
            interaction_event_count=interaction_count,
        )

    # - Compute weighted-average vector.
    behavior_vector = _compute_weighted_vector(matched_ids, listing_scores, embeddings_map)

    if behavior_vector is None:
        logger.warning(
            "Behavior profile: zero-norm vector for user %d", user_id,
        )
        return BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=total_event_count,
            distinct_listing_count=distinct_count,
            top_listing_ids=matched_ids,
            recommendation_event_count=reco_count,
            interaction_event_count=interaction_count,
        )

    logger.info(
        "Behavior profile built for user %d "
        "(events=%d, reco_events=%d, interaction_events=%d, "
        "distinct_listings=%d, top_k_used=%d)",
        user_id, total_event_count, reco_count, interaction_count,
        distinct_count, len(matched_ids),
    )

    return BehaviorProfile(
        behavior_vector=behavior_vector,
        is_sparse=False,
        event_count=total_event_count,
        distinct_listing_count=distinct_count,
        top_listing_ids=matched_ids,
        recommendation_event_count=reco_count,
        interaction_event_count=interaction_count,
    )


# Event fetching

def _fetch_recommendation_events(user_id: int, max_age) -> list[dict]:
    """
    Return qualifying RecommendationEvent rows as dicts.
    """
    return list(
        RecommendationEvent.objects.filter(
            user_id=user_id,
            event_type__in=QUALIFYING_EVENT_TYPES,
            listing_id__isnull=False,
            created_at__gte=max_age,
        )
        .values('listing_id', 'event_type', 'surface', 'created_at')
    )


def _fetch_interaction_events(user_id: int, max_age) -> list[dict]:
    """
    Return qualifying ListingInteractionEvent rows as dicts.
    """
    return list(
        ListingInteractionEvent.objects.filter(
            user_id=user_id,
            event_type__in=QUALIFYING_EVENT_TYPES,
            listing_id__isnull=False,
            created_at__gte=max_age,
        )
        .values('listing_id', 'event_type', 'surface', 'created_at')
    )


# Normalization

def _normalize_recommendation_events(events: list[dict]) -> list[dict]:
    """
    Normalize RecommendationEvent rows into unified signal dicts.
    """
    return [
        {
            'listing_id': evt['listing_id'],
            'event_type': evt['event_type'],
            'source': 'recommendation',
            'surface': evt['surface'],
            'created_at': evt['created_at'],
        }
        for evt in events
    ]


def _normalize_interaction_events(events: list[dict]) -> list[dict]:
    """
    Normalize ListingInteractionEvent rows into unified signal dicts.
    """
    return [
        {
            'listing_id': evt['listing_id'],
            'event_type': evt['event_type'],
            'source': 'browsing',
            'surface': evt['surface'],
            'created_at': evt['created_at'],
        }
        for evt in events
    ]


# Scoring

def _score_unified_signals(
    signals: list[dict],
    recent_cutoff,
) -> dict[int, float]:
    """
    Score each listing by summing across all unified signals:

        signal_score = event_type_weight × source_surface_multiplier × recency_multiplier

    Accumulates per-listing.
    """
    listing_scores: dict[int, float] = {}
    event_type_weights = _get_event_type_weights()
    source_surface_multipliers = _get_source_surface_multipliers()
    recent_multiplier = settings.RECOMMENDATION_BEHAVIOR_RECENT_MULTIPLIER
    long_term_multiplier = 1.0

    for signal in signals:
        listing_id = signal['listing_id']
        event_type = signal['event_type']
        surface = signal['surface']
        created_at = signal['created_at']

        type_weight = event_type_weights.get(event_type, 0.0)
        if type_weight == 0.0:
            continue

        source_multiplier = source_surface_multipliers.get(
            surface, _DEFAULT_SOURCE_MULTIPLIER,
        )

        window_multiplier = (
            recent_multiplier if created_at >= recent_cutoff
            else long_term_multiplier
        )

        listing_scores[listing_id] = (
            listing_scores.get(listing_id, 0.0)
            + type_weight * source_multiplier * window_multiplier
        )

    return listing_scores


# Top-K selection

def _select_top_k(listing_scores: dict[int, float], k: int) -> list[int]:
    """
    Return the top-K listing IDs by descending score.
    """
    sorted_items = sorted(
        listing_scores.items(), key=lambda item: item[1], reverse=True,
    )
    return [listing_id for listing_id, _ in sorted_items[:k]]


# Embedding resolution

def _fetch_embeddings(
    listing_ids: list[int],
    model_version: RecommendationModelVersion,
) -> dict[int, np.ndarray]:
    """
    Batch-load content embeddings for the given listing IDs under the specified model version.

    Returns a dict mapping listing_id -> embedding numpy array.
    
    Listings without a snapshot are silently omitted.
    """
    if not listing_ids:
        return {}

    snapshots = ListingFeatureSnapshot.objects.filter(
        listing_id__in=listing_ids,
        model_version=model_version,
        vector_type='content',
    ).values_list('listing_id', 'embedding')

    return {
        listing_id: np.array(embedding, dtype=np.float32)
        for listing_id, embedding in snapshots
    }


# Weighted-average vector computation

def _compute_weighted_vector(
    listing_ids: list[int],
    listing_scores: dict[int, float],
    embeddings_map: dict[int, np.ndarray],
) -> np.ndarray | None:
    """
    Compute the weighted-average vector from listing embeddings and scores, then L2-normalize.

    Returns None if the resulting vector has zero norm.
    """
    total_weight = 0.0
    accumulated = None

    for listing_id in listing_ids:
        embedding = embeddings_map.get(listing_id)
        if embedding is None:
            continue

        score = listing_scores.get(listing_id, 0.0)
        if score <= 0.0:
            continue

        if accumulated is None:
            accumulated = np.zeros_like(embedding)

        accumulated += score * embedding
        total_weight += score

    if accumulated is None or total_weight == 0.0:
        return None

    averaged = accumulated / total_weight

    norm = np.linalg.norm(averaged)
    if norm < 1e-10:
        return None

    return averaged / norm
