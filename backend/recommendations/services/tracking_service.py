import logging

from django.db import transaction

from recommendations.models import (
    ListingInteractionEvent,
    RecommendationEvent,
    RecommendationModelVersion,
    ServedRecommendationSet,
)
from recommendations.services.behavior_profile_service import QUALIFYING_EVENT_TYPES
from recommendations.constants import QUALIFYING_INTERACTION_EVENT_TYPES
from recommendations.services.behavior_rebuild_scheduler_service import (
    queue_behavior_profile_rebuild,
)

logger = logging.getLogger('recommendations')


def create_served_slate(
    *,
    user=None,
    session_id: str = '',
    surface: str,
    strategy: str,
    model_version: RecommendationModelVersion | None,
    seed_listing_id: int | None = None,
    results: list[dict],
    serving_metadata: dict | None = None,
) -> ServedRecommendationSet:
    """
    Create a ServedRecommendationSet row recording what was served.

    Args:
        user: Authenticated user or None.
        session_id: Frontend session UUID for anonymous users.
        surface: Recommendation surface, e.g. 'similar' or 'for_you'.
        strategy: Strategy used to produce the results.
        model_version: Active RecommendationModelVersion or None for fallback.
        seed_listing_id: Source listing PK for 'similar' surface, None otherwise.
        results: Ordered list of dicts from the recommendation pipeline. Each dict must include 'listing_id' and may include 'distance'.
        serving_metadata: Optional serve-time metadata to persist alongside the slate for monitoring/reporting.
    """
    persisted_user = user if user and user.is_authenticated else None

    results_json = []
    for i, item in enumerate(results, start=1):
        entry = {
            'listing_id': item['listing_id'],
            'position': i,
        }
        if 'distance' in item:
            entry['distance'] = item['distance']
        results_json.append(entry)

    served_set = ServedRecommendationSet.objects.create(
        user=persisted_user,
        session_id=session_id or '',
        surface=surface,
        strategy=strategy,
        model_version=model_version,
        seed_listing_id=seed_listing_id,
        result_count=len(results_json),
        results_json=results_json,
        serving_metadata=serving_metadata or {},
    )

    logger.info(
        "Served slate created",
        extra={
            'request_id': str(served_set.request_id),
            'surface': surface,
            'strategy': strategy,
            'result_count': len(results_json),
            'model_version': model_version.version_label if model_version else None,
            'user_id': persisted_user.pk if persisted_user else None,
            'serving_metadata_keys': sorted((serving_metadata or {}).keys()),
        },
    )

    return served_set


def persist_events(
    *,
    validated_events: list[dict],
    user=None,
) -> dict:
    """
    Persist a batch of validated recommendation events.

    For each event:
        - Resolve ServedRecommendationSet from request_id if available.
        - Attach user context when authenticated.
        - Queue RecommendationEvent rows for bulk_create.

    After persistence, queues a debounced background behavior snapshot rebuild if any qualifying events (click, detail_open) were ingested for an authenticated user.

    Returns:
        {'accepted': int, 'rejected': int, 'errors': list[dict]}
    """
    persisted_user = user if user and user.is_authenticated else None

    accepted = 0
    rejected = 0
    errors = []

    request_ids = list({evt['request_id'] for evt in validated_events})
    served_sets_map = {}
    if request_ids:
        served_sets_map = {
            served_set.request_id: served_set
            for served_set in ServedRecommendationSet.objects.filter(
                request_id__in=request_ids
            ).only('pk', 'request_id')
        }

    events_to_create = []
    has_qualifying_event = False
    for i, evt in enumerate(validated_events):
        try:
            request_id = evt['request_id']
            served_set = served_sets_map.get(request_id)

            if served_set is None:
                logger.warning(
                    "Event references unknown request_id",
                    extra={
                        'request_id': str(request_id),
                        'event_type': evt.get('event_type'),
                        'index': i,
                    },
                )

            event_type = evt['event_type']
            events_to_create.append(
                RecommendationEvent(
                    served_set=served_set,
                    request_id=request_id,
                    user=persisted_user,
                    session_id=evt.get('session_id', ''),
                    listing_id=evt.get('listing_id'),
                    event_type=event_type,
                    surface=evt['surface'],
                    strategy=evt['strategy'],
                    model_version_label=evt.get('model_version', ''),
                    position=evt.get('position'),
                    metadata=evt.get('metadata', {}),
                )
            )
            if event_type in QUALIFYING_EVENT_TYPES:
                has_qualifying_event = True
            accepted += 1

        except Exception as e:
            logger.exception("Failed to process event at index %d: %s", i, e)
            errors.append({'index': i, 'detail': str(e)})
            rejected += 1

    if events_to_create:
        RecommendationEvent.objects.bulk_create(events_to_create)
        logger.info(
            "Events persisted",
            extra={
                'accepted': accepted,
                'rejected': rejected,
                'user_id': persisted_user.pk if persisted_user else None,
            },
        )

    if has_qualifying_event and persisted_user is not None:
        transaction.on_commit(
            lambda user_id=persisted_user.pk: queue_behavior_profile_rebuild(
                user_id=user_id
            )
        )

    return {
        'accepted': accepted,
        'rejected': rejected,
        'errors': errors,
    }


def persist_listing_interactions(
    *,
    validated_events: list[dict],
    user,    
) -> dict:
    """
    Persist a batch of validated general listing interaction events.

    For each event:
        - Attach the authenticated user.
        - Queue ListingInteractionEvent rows for bulk_create.

    After persistence, queues a debounced background behavior snapshot rebuild if any qualifying events (click, detail_open) were ingested.

    Returns:
        {'accepted': int, 'rejected': int, 'errors': list[dict]}
    """
    accepted = 0
    rejected = 0
    errors = []

    events_to_create = []
    has_qualifying_event = False

    for i, evt in enumerate(validated_events):
        try:
            event_type = evt['event_type']
            events_to_create.append(
                ListingInteractionEvent(
                    user=user,
                    listing_id=evt['listing_id'],
                    event_type=event_type,
                    surface=evt['surface'],
                    position=evt.get('position'),
                    metadata=evt.get('metadata', {}),
                )
            )
            if event_type in QUALIFYING_INTERACTION_EVENT_TYPES:
                has_qualifying_event = True
            accepted += 1

        except Exception as e:
            logger.exception(
                "Failed to process listing interaction at index %d: %s", i, e,
            )
            errors.append({'index': i, 'detail': str(e)})
            rejected += 1
    
    if events_to_create:
        ListingInteractionEvent.objects.bulk_create(events_to_create)
        logger.info(
            "Listing interactions persisted",
            extra={
                'accepted': accepted,
                'rejected': rejected,
                'user_id': user.pk,
            },
        )

    if has_qualifying_event:
        transaction.on_commit(
            lambda user_id=user.pk: queue_behavior_profile_rebuild(
                user_id=user_id
            )
        )

    return {
        'accepted': accepted,
        'rejected': rejected,
        'errors': errors,
    }
