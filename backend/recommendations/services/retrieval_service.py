import logging

import numpy as np
from django.conf import settings
from pgvector.django import CosineDistance

from recommendations.models import ListingFeatureSnapshot, RecommendationModelVersion

logger = logging.getLogger('recommendations')


def get_active_model_version() -> RecommendationModelVersion | None:
    """
    Return the currently active RecommendationModelVersion, or None if no version is active.
    """
    return RecommendationModelVersion.objects.filter(is_active=True).first()


def retrieve_similar(
    query_vector: np.ndarray,
    model_version: RecommendationModelVersion,
    limit: int | None = None,
    exclude_listing_ids: list[int] | None = None,
    vector_type: str = 'content',
) -> list[dict]:
    """
    perform pgvector nearest-neighbor search to find listings with embeddings most similar to the query vector.

    Returns a list of dicts with keys: listing_id, distance, snapshot_id. 
    Ordered by ascending distance (most similar first).
    """
    if limit is None:
        limit = settings.RECOMMENDATION_SIMILAR_CANDIDATES
    
    qs = ListingFeatureSnapshot.objects.filter(
        model_version=model_version,
        vector_type=vector_type,
    )

    if exclude_listing_ids:
        qs = qs.exclude(listing_id__in=exclude_listing_ids)
    
    # Annotate with cosine distance and order by it
    qs = (
        qs.annotate(distance=CosineDistance('embedding', query_vector.tolist()))
        .order_by('distance')
        .values('listing_id', 'distance', 'id')[:limit]
    )

    results = []
    for row in qs:
        results.append({
            'listing_id': row['listing_id'],
            'distance': float(row['distance']),
            'snapshot_id': row['id'],
        })

    logger.debug(
        "Retrieved %d candidates (version=%s, type=%s, limit=%d)",
        len(results), model_version.version_label, vector_type, limit,
    )

    return results


def retrieve_for_you(
    query_vector: np.ndarray,
    model_version: RecommendationModelVersion,
    limit: int | None = None,
    vector_type: str = 'content',
) -> list[dict]:
    """
    Perform pgvector nearest-neighbor search for "for you" recommendations.

    Similar to retrieve_similar but without excluding any specific listing.
    """
    if limit is None:
        limit = settings.RECOMMENDATION_FOR_YOU_CANDIDATES
    
    qs = (
        ListingFeatureSnapshot.objects.filter(
            model_version=model_version,
            vector_type=vector_type,
        )
        .annotate(distance=CosineDistance('embedding', query_vector.tolist()))
        .order_by('distance')
        .values('listing_id', 'distance', 'id')[:limit]
    )

    results = list(qs)
    results = [
        {
            'listing_id': row['listing_id'],
            'distance': float(row['distance']),
            'snapshot_id': row['id'],
        }
        for row in results
    ]

    logger.debug(
        "Retrieved %d for-you candidates (version=%s)",
        len(results), model_version.version_label,
    )

    return results
