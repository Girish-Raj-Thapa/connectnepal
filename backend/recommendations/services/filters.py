import logging
from decimal import Decimal

from django.db.models import Case, IntegerField, Value, When

from listings.models import Listing

logger = logging.getLogger('recommendations')


def filter_eligible_listings(
    listing_ids: list[int],
    exclude_listing_ids: list[int] | None = None,
    max_price: Decimal | None = None,
) -> set[int]:
    """
    Given a list of candidate listing IDs from retrieval, return the subset that are currently eligible to be recommended.

    Eligibility criteria (Phase 1):
        - is_active = True (not soft-deleted)
        - is_bookable = True (published and accepting bookings)
        - host is active (host__user__is_active = True)

    Optional:
        - exclude_listing_ids: listings to exclude (e.g. the source listing)
        - max_price: budget cap filter
    """
    if not listing_ids:
        return set()

    qs = Listing.objects.filter(
        pk__in=listing_ids,
        is_active=True,
        is_bookable=True,
        host__user__is_active=True,
    )

    if exclude_listing_ids:
        qs = qs.exclude(pk__in=exclude_listing_ids)

    if max_price is not None:
        qs = qs.filter(price_per_person__lte=max_price)

    eligible_ids = set(qs.values_list('pk', flat=True))

    filtered_count = len(listing_ids) - len(eligible_ids)
    if filtered_count > 0:
        logger.debug(
            "Filtered out %d ineligible listings from %d candidates",
            filtered_count, len(listing_ids),
        )

    return eligible_ids


def light_rerank(candidates: list[dict], eligible_ids: set[int], limit: int) -> list[int]:
    """
    Apply light reranking to the eligible candidate set and return final ordered listing IDs.

    Phase 1 reranking is simple:
        - Keep only eligible candidates
        - Preserve the vector-similarity ordering (already sorted by distance)
        - Truncate to `limit`

    Future phases can add boosting by:
        - rating_average (popularity signal)
        - recency (newer listings boosted)
        - host verification status
        - seasonal relevance
    """
    # Filter to eligible only, preserving retrieval order
    ranked = [
        c for c in candidates
        if c['listing_id'] in eligible_ids
    ]

    # Truncate to limit
    ranked = ranked[:limit]

    return [c['listing_id'] for c in ranked]


def budget_aware_rerank(
    candidates: list[dict],
    eligible_ids: set[int],
    listing_prices: dict[int, Decimal],
    limit: int,
    min_price: Decimal | None = None,
) -> list[int]:
    """
    Rerank for traveller recommendations using a hybrid budget policy.
        - Listings above max budget are already removed by `filter_eligible_listings`.
        - Listings inside the user's budget window are preferred.
        - Listings below the user's minimum budget are still allowed, but ranked after in-range results while preserving similarity ordering within each bucket.
    """
    if min_price is None:
        return light_rerank(candidates, eligible_ids, limit)

    in_range = []
    below_min = []
    for candidate in candidates:
        listing_id = candidate['listing_id']
        if listing_id not in eligible_ids:
            continue

        price = listing_prices.get(listing_id)
        if price is None or price >= min_price:
            in_range.append(listing_id)
        else:
            below_min.append(listing_id)

    return (in_range + below_min)[:limit]


def get_popular_fallback_ids(
    limit: int = 20,
    exclude_ids: list[int] | None = None,
    max_price: Decimal | None = None,
    min_price: Decimal | None = None,
) -> list[int]:
    """
    Fallback: return the most popular active, bookable listings when recommendation data is unavailable (no preferences, no model version, sparse results).

    Ordered by: rating_average desc, booking_count desc, created_at desc.
    """
    qs = Listing.objects.filter(
        is_active=True,
        is_bookable=True,
        host__user__is_active=True,
    )

    if exclude_ids:
        qs = qs.exclude(pk__in=exclude_ids)

    if max_price is not None:
        qs = qs.filter(price_per_person__lte=max_price)

    if min_price is not None:
        qs = qs.annotate(
            budget_bucket=Case(
                When(price_per_person__gte=min_price, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        ).order_by(
            'budget_bucket',
            '-rating_average',
            '-booking_count',
            '-created_at',
        )
    else:
        qs = qs.order_by('-rating_average', '-booking_count', '-created_at')

    return list(
        qs.values_list('pk', flat=True)[:limit]
    )
