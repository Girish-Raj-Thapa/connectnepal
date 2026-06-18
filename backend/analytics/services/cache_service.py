import logging

from django.conf import settings
from django.core.cache import caches

from analytics.services.admin_services import get_admin_overview
from analytics.services.host_services import get_host_overview
from analytics.services.traveller_services import get_traveller_overview

logger = logging.getLogger("analytics")
cache = caches['dashboards']


def _traveller_overview_key(user_id: int) -> str:
    return f"analytics:traveller_overview:u{user_id}"


def _host_overview_key(user_id: int) -> str:
    return f"analytics:host_overview:u{user_id}"


def _admin_overview_key() -> str:
    return "analytics:admin_overview"


def _safe_cache_get(key: str):
    try:
        return cache.get(key)
    except Exception:
        logger.exception(
            "Dashboard cache read failed",
            extra={"cache_key": key},
        )
        return None


def _safe_cache_set(key: str, payload: dict, timeout: int) -> None:
    try:
        cache.set(key, payload, timeout=timeout)
    except Exception:
        logger.exception(
            "Dashboard cache write failed",
            extra={"cache_key": key},
        )


def get_cached_traveller_overview(user) -> dict:
    key = _traveller_overview_key(user.pk)
    payload = _safe_cache_get(key)
    if payload is not None:
        return payload

    payload = get_traveller_overview(user)
    _safe_cache_set(
        key,
        payload,
        settings.ANALYTICS_CACHE_TTL_TRAVELLER_OVERVIEW,
    )
    return payload


def get_cached_host_overview(user) -> dict:
    key = _host_overview_key(user.pk)
    payload = _safe_cache_get(key)
    if payload is not None:
        return payload

    payload = get_host_overview(user)
    _safe_cache_set(
        key,
        payload,
        settings.ANALYTICS_CACHE_TTL_HOST_OVERVIEW,
    )
    return payload


def get_cached_admin_overview() -> dict:
    key = _admin_overview_key()
    payload = _safe_cache_get(key)
    if payload is not None:
        return payload

    payload = get_admin_overview()
    _safe_cache_set(
        key,
        payload,
        settings.ANALYTICS_CACHE_TTL_ADMIN_OVERVIEW,
    )
    return payload
