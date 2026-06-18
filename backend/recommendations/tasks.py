import logging

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db import transaction

from recommendations.models import ListingFeatureSnapshot, RecommendationModelVersion
from recommendations.services.artifact_loader import ArtifactLoadError, artifact_loader
from recommendations.services.behavior_profile_service import build_behavior_profile
from recommendations.services.behavior_snapshot_service import (
    upsert_behavior_profile_snapshot,
)
from recommendations.services.cache_versioning_service import (
    bump_user_behavior_generation,
)
from recommendations.services.preprocessing import preprocess_listing
from recommendations.services.vectorizer import vectorize_listing
from recommendations.services.retrieval_service import get_active_model_version
from recommendations.services.recommendation_service import invalidate_listing_cache

logger = logging.getLogger('recommendations')


@shared_task(
    name='recommendations.tasks.reindex_listing_task',
    bind=True, 
    max_retries=3, 
    default_retry_delay=30,
    acks_late=True,
)
def reindex_listing_task(self, listing_id: int):
    """
    Incrementally reindex a single listing's embedding.

    Called when a listing's recommendation-relevant fields change or when a listing becomes bookable for the first time.

    Steps:
        - Get the active model version
        - Load the listing from DB
        - Preprocess → vectorize
        - Upsert the ListingFeatureSnapshot row
        - Invalidate the listing's recommendation cache
    """
    from listings.models import Listing

    model_version = get_active_model_version()
    if model_version is None:
        logger.warning(
            "Skipping reindex for listing %d: no active model version.", listing_id
        )
        return
    
    try:
        listing = Listing.objects.select_related('host', 'host__user').get(pk=listing_id)
    except Listing.DoesNotExist:
        logger.warning("Listing %d does not exist, skipping reindex.", listing_id)
        return

    # Only index visible listings; remove snapshot if not visible
    if not (listing.is_active and listing.is_bookable):
        deleted_count, _ = ListingFeatureSnapshot.objects.filter(
            listing_id=listing_id,
            model_version=model_version,
        ).delete()
        if deleted_count:
            logger.info(
                "Removed %d snapshot(s) for non-visible listing %d.",
                deleted_count, listing_id,
            )
            invalidate_listing_cache(listing_id)
        return

    try:
        preprocessed = preprocess_listing(listing)
        vector = vectorize_listing(preprocessed)
    except ArtifactLoadError as e:
        logger.error("Artifact load failed during reindex of listing %d: %s", listing_id, e)
        raise self.retry(exc=e)
    except Exception as e:
        logger.exception("Vectorization failed for listing %d: %s", listing_id, e)
        raise self.retry(exc=e)

    # Upsert: update_or_create keyed on (listing, model_version, vector_type)
    with transaction.atomic():
        ListingFeatureSnapshot.objects.update_or_create(
            listing_id=listing_id,
            model_version=model_version,
            vector_type='content',
            defaults={
                'embedding': vector.tolist(),
                'metadata': {},
            },
        )

    invalidate_listing_cache(listing_id)

    logger.info(
        "Reindexed listing %d (version=%s, dim=%d).",
        listing_id, model_version.version_label, len(vector),
    )


@shared_task(
    name='recommendations.tasks.rebuild_user_behavior_profile_snapshot_task',
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def rebuild_user_behavior_profile_snapshot_task(
    self,
    user_id: int,
    model_version_id: int | None = None,
):
    """
    Materialize one user's behavior profile for the active model version.

    Safe to run multiple times because the snapshot row is upserted on the (user, model_version) pair and cache generation only bumps after a successful snapshot write.
    """
    User = get_user_model()

    if not User.objects.filter(pk=user_id).exists():
        logger.warning(
            "Skipping behavior snapshot rebuild: user %d does not exist",
            user_id,
        )
        return {'user_id': user_id, 'error': 'user_not_found'}

    try:
        model_version = _resolve_behavior_model_version(model_version_id)
    except RecommendationModelVersion.DoesNotExist:
        logger.warning(
            "Skipping behavior snapshot rebuild: model version %s not found",
            model_version_id,
        )
        return {
            'user_id': user_id,
            'model_version_id': model_version_id,
            'error': 'model_version_not_found',
        }

    if model_version is None:
        logger.warning(
            "Skipping behavior snapshot rebuild for user %d: no active model version",
            user_id,
        )
        return {'user_id': user_id, 'error': 'no_active_model_version'}

    try:
        profile = build_behavior_profile(
            user_id=user_id,
            model_version=model_version,
        )
        with transaction.atomic():
            upsert_behavior_profile_snapshot(
                user_id=user_id,
                model_version=model_version,
                behavior_profile=profile,
            )
    except Exception as exc:
        logger.exception(
            "Behavior snapshot rebuild failed for user %d and model version %s",
            user_id,
            model_version.pk,
        )
        raise self.retry(exc=exc)

    generation = None
    active_model_version = get_active_model_version()
    if active_model_version and active_model_version.pk == model_version.pk:
        generation = bump_user_behavior_generation(user_id)
    else:
        logger.info(
            "Skipped behavior cache generation bump for non-active model version",
            extra={
                'user_id': user_id,
                'rebuilt_model_version': model_version.version_label,
                'active_model_version': (
                    active_model_version.version_label if active_model_version else None
                ),
            },
        )

    logger.info(
        "Behavior snapshot rebuilt",
        extra={
            'user_id': user_id,
            'model_version': model_version.version_label,
            'is_sparse': profile.is_sparse,
            'event_count': profile.event_count,
            'distinct_listing_count': profile.distinct_listing_count,
            'generation_bumped': generation is not None,
            'behavior_generation': generation,
        },
    )

    return {
        'user_id': user_id,
        'model_version_id': model_version.pk,
        'is_sparse': profile.is_sparse,
        'event_count': profile.event_count,
        'distinct_listing_count': profile.distinct_listing_count,
        'generation_bumped': generation is not None,
        'behavior_generation': generation,
    }


def _resolve_behavior_model_version(
    model_version_id: int | None,
) -> RecommendationModelVersion | None:
    if model_version_id is not None:
        return RecommendationModelVersion.objects.get(pk=model_version_id)
    return get_active_model_version()
