import logging

from django.core.cache import caches

logger = logging.getLogger('recommendations')

CATALOG_GENERATION_KEY = 'reco:version:catalog_generation'
USER_PREFERENCE_GENERATION_KEY = 'reco:version:user_pref_generation:u{user_id}'
USER_BEHAVIOR_GENERATION_KEY = 'reco:version:user_behavior_generation:u{user_id}'


def get_catalog_generation() -> int:
    return _get_generation(CATALOG_GENERATION_KEY)


def bump_catalog_generation() -> int:
    return _bump_generation(
        CATALOG_GENERATION_KEY,
        scope='catalog',
    )


def get_user_preference_generation(user_id: int) -> int:
    return _get_generation(_user_preference_generation_key(user_id))


def bump_user_preference_generation(user_id: int) -> int:
    return _bump_generation(
        _user_preference_generation_key(user_id),
        scope='user_preferences',
        user_id=user_id,
    )


def get_user_behavior_generation(user_id: int) -> int:
    return _get_generation(_user_behavior_generation_key(user_id))


def bump_user_behavior_generation(user_id: int) -> int:
    return _bump_generation(
        _user_behavior_generation_key(user_id),
        scope='user_behavior',
        user_id=user_id,
    )


def _user_preference_generation_key(user_id: int) -> str:
    return USER_PREFERENCE_GENERATION_KEY.format(user_id=user_id)


def _user_behavior_generation_key(user_id: int) -> str:
    return USER_BEHAVIOR_GENERATION_KEY.format(user_id=user_id)


def _get_generation(key: str) -> int:
    cache = _get_cache()
    try:
        value = cache.get(key)
        if value is None:
            cache.add(key, 1, timeout=None)
            value = cache.get(key)
        return int(value or 1)
    except Exception:
        logger.exception(
            "Failed to read recommendation cache generation",
            extra={'cache_generation_key': key},
        )
        return 1


def _bump_generation(key: str, *, scope: str, user_id: int | None = None) -> int:
    cache = _get_cache()
    try:
        if cache.add(key, 1, timeout=None):
            value = 1
        else:
            try:
                value = cache.incr(key)
            except ValueError:
                cache.set(key, 1, timeout=None)
                value = 1

        logger.info(
            "Recommendation cache generation bumped",
            extra={
                'scope': scope,
                'generation': int(value),
                'user_id': user_id,
            },
        )
        return int(value)
    except Exception:
        logger.exception(
            "Failed to bump recommendation cache generation",
            extra={
                'scope': scope,
                'cache_generation_key': key,
                'user_id': user_id,
            },
        )
        return 1


def _get_cache():
    return caches['recommendations']
