import logging

from django.conf import settings

from recommendations.services import cache_versioning_service

logger = logging.getLogger('recommendations')

_REBUILD_DEBOUNCE_KEY = 'reco:behavior_rebuild_pending:u{user_id}'


def queue_behavior_profile_rebuild(
    *,
    user_id: int,
    model_version_id: int | None = None,
) -> bool:
    if not _claim_rebuild_slot(user_id):
        logger.debug(
            "Skipped behavior snapshot rebuild queue due to debounce",
            extra={'user_id': user_id},
        )
        return False

    try:
        from recommendations.tasks import rebuild_user_behavior_profile_snapshot_task

        rebuild_user_behavior_profile_snapshot_task.delay(
            user_id=user_id,
            model_version_id=model_version_id,
        )
    except Exception:
        _clear_rebuild_slot(user_id)
        logger.exception(
            "Failed to queue behavior snapshot rebuild",
            extra={'user_id': user_id, 'model_version_id': model_version_id},
        )
        return False

    logger.info(
        "Queued behavior snapshot rebuild",
        extra={'user_id': user_id, 'model_version_id': model_version_id},
    )
    return True


def _claim_rebuild_slot(user_id: int) -> bool:
    debounce_seconds = getattr(
        settings,
        'RECOMMENDATION_BEHAVIOR_REBUILD_DEBOUNCE_SECONDS',
        30,
    )
    if debounce_seconds <= 0:
        return True

    cache = cache_versioning_service._get_cache()
    key = _debounce_key(user_id)
    try:
        return bool(cache.add(key, 1, timeout=debounce_seconds))
    except Exception:
        logger.exception(
            "Failed to claim behavior snapshot rebuild debounce slot",
            extra={'user_id': user_id},
        )
        return True


def _clear_rebuild_slot(user_id: int):
    cache = cache_versioning_service._get_cache()
    try:
        cache.delete(_debounce_key(user_id))
    except Exception:
        logger.exception(
            "Failed to clear behavior snapshot rebuild debounce slot",
            extra={'user_id': user_id},
        )


def _debounce_key(user_id: int) -> str:
    return _REBUILD_DEBOUNCE_KEY.format(user_id=user_id)
