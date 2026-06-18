from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from accounts.models import Account, TravellerDetail
from listings.models import Listing
from recommendations.constants import QUALIFYING_INTERACTION_EVENT_TYPES
from recommendations.models import (
    ListingInteractionEvent,
    RecommendationEvent,
    ServedRecommendationSet,
)
from recommendations.services.artifact_loader import artifact_loader
from recommendations.services.behavior_profile_service import QUALIFYING_EVENT_TYPES
from recommendations.services.preprocessing import _build_preference_payload
from recommendations.services.retrieval_service import get_active_model_version

BEHAVIOR_SIGNAL_SOURCE_VALUES = (
    'none',
    'recommendation_only',
    'browsing_only',
    'mixed',
)


def get_quality_summary(days: int | None = None) -> dict:
    """
    Return a queryable summary of recommendation quality and serving behavior.

    Includes Phase 2.5 metrics: behavior-enhanced breakdown, mixed-fallback analysis, CTR by strategy, and orphan-event visibility.
    """
    since = None
    if days is not None:
        since = timezone.now() - timedelta(days=days)

    served_qs = ServedRecommendationSet.objects.all()
    events_qs = RecommendationEvent.objects.all()

    if since is not None:
        served_qs = served_qs.filter(created_at__gte=since)
        events_qs = events_qs.filter(created_at__gte=since)

    active_model = get_active_model_version()

    total_served = served_qs.count()
    pure_fallback_count = served_qs.filter(strategy='popular_fallback').count()
    empty_count = served_qs.filter(result_count=0).count()

    served_by_surface = {
        row['surface']: row['total']
        for row in served_qs.values('surface').annotate(total=Count('id'))
    }
    served_by_strategy = {
        row['strategy']: row['total']
        for row in served_qs.values('strategy').annotate(total=Count('id'))
    }

    fallback_mix = _classify_fallback_mix(served_qs)
    for_you_breakdown = _for_you_strategy_breakdown(served_qs)
    for_you_signal_source_breakdown = _compute_signal_source_breakdown(served_qs)
    behavior_enhanced_signal_source_breakdown = _compute_signal_source_breakdown(
        served_qs,
        strategy='behavior_enhanced',
    )
    behavior_input_aggregates = _compute_behavior_input_aggregates(served_qs)
    broader_browsing_sparse_context = _compute_broader_browsing_sparse_context(
        served_qs,
    )
    mixed_fallback_by_signal_source = _compute_mixed_fallback_by_signal_source(
        served_qs,
    )

    events_by_type = {
        row['event_type']: row['total']
        for row in events_qs.values('event_type').annotate(total=Count('id'))
    }

    impressions_by_surface = _group_event_counts(events_qs, 'surface', 'impression')
    clicks_by_surface = _group_event_counts(events_qs, 'surface', 'click')
    ctr_by_surface = []
    for surface in sorted(set(impressions_by_surface) | set(clicks_by_surface)):
        impressions = impressions_by_surface.get(surface, 0)
        clicks = clicks_by_surface.get(surface, 0)
        ctr_by_surface.append({
            'surface': surface,
            'impressions': impressions,
            'clicks': clicks,
            'ctr': round(clicks / impressions, 4) if impressions else None,
        })

    impressions_by_position = _group_event_counts(
        events_qs.exclude(position__isnull=True),
        'position',
        'impression',
    )
    clicks_by_position = _group_event_counts(
        events_qs.exclude(position__isnull=True),
        'position',
        'click',
    )
    ctr_by_position = []
    for position in sorted(set(impressions_by_position) | set(clicks_by_position)):
        impressions = impressions_by_position.get(position, 0)
        clicks = clicks_by_position.get(position, 0)
        ctr_by_position.append({
            'position': position,
            'impressions': impressions,
            'clicks': clicks,
            'ctr': round(clicks / impressions, 4) if impressions else None,
        })

    impressions_by_strategy = _group_event_counts(events_qs, 'strategy', 'impression')
    clicks_by_strategy = _group_event_counts(events_qs, 'strategy', 'click')
    ctr_by_strategy = []
    for strategy in sorted(set(impressions_by_strategy) | set(clicks_by_strategy)):
        impressions = impressions_by_strategy.get(strategy, 0)
        clicks = clicks_by_strategy.get(strategy, 0)
        ctr_by_strategy.append({
            'strategy': strategy,
            'impressions': impressions,
            'clicks': clicks,
            'ctr': round(clicks / impressions, 4) if impressions else None,
        })

    ctr_by_surface_strategy = _compute_ctr_by_surface_strategy(events_qs)
    ctr_by_signal_source = _compute_ctr_by_signal_source(events_qs)
    ctr_by_strategy_signal_source = _compute_ctr_by_strategy_signal_source(events_qs)

    total_events = events_qs.count()
    orphan_event_count = events_qs.filter(served_set__isnull=True).count()

    top_clicked_categories = list(
        events_qs.filter(event_type='click', listing__isnull=False)
        .values('listing__category')
        .annotate(clicks=Count('id'))
        .order_by('-clicks', 'listing__category')[:10]
    )
    top_clicked_activity_types = list(
        events_qs.filter(event_type='click', listing__isnull=False)
        .values('listing__activity_type')
        .annotate(clicks=Count('id'))
        .order_by('-clicks', 'listing__activity_type')[:10]
    )
    top_clicked_destinations = list(
        events_qs.filter(event_type='click', listing__isnull=False)
        .values('listing__destination')
        .annotate(clicks=Count('id'))
        .order_by('-clicks', 'listing__destination')[:10]
    )

    return {
        'window_days': days,
        'window_start': since.isoformat() if since else None,
        'active_model_version': active_model.version_label if active_model else None,
        'total_served': total_served,
        'served_by_surface': served_by_surface,
        'served_by_strategy': served_by_strategy,
        'fallback_count': pure_fallback_count,
        'fallback_rate': round(
            pure_fallback_count / total_served, 4
        ) if total_served else None,
        'served_sets': {
            'total': total_served,
            'by_surface': served_by_surface,
            'by_strategy': served_by_strategy,
            'fallback_count': pure_fallback_count,
            'fallback_rate': round(
                pure_fallback_count / total_served, 4
            ) if total_served else None,
            'empty_count': empty_count,
            'empty_rate': round(empty_count / total_served, 4) if total_served else None,
            'pure_fallback_count': fallback_mix['pure_fallback_count'],
            'pure_fallback_rate': fallback_mix['pure_fallback_rate'],
            'mixed_fallback_count': fallback_mix['mixed_fallback_count'],
            'mixed_fallback_rate': fallback_mix['mixed_fallback_rate'],
            'pure_personalized_count': fallback_mix['pure_personalized_count'],
            'pure_personalized_rate': fallback_mix['pure_personalized_rate'],
            'any_fallback_count': fallback_mix['any_fallback_count'],
            'any_fallback_rate': fallback_mix['any_fallback_rate'],
        },
        'for_you_breakdown': for_you_breakdown,
        'for_you_strategy_breakdown': {
            'total': for_you_breakdown['total'],
            'behavior_enhanced': for_you_breakdown['behavior_enhanced_count'],
            'preference_based': for_you_breakdown['preference_based_count'],
            'popular_fallback': for_you_breakdown['popular_fallback_count'],
        },
        'fallback_analysis': {
            'pure_count': fallback_mix['pure_fallback_count'],
            'pure_rate': fallback_mix['pure_fallback_rate'],
            'mixed_count': fallback_mix['mixed_fallback_count'],
            'mixed_rate': fallback_mix['mixed_fallback_rate'],
            'pure_personalized_count': fallback_mix['pure_personalized_count'],
            'pure_personalized_rate': fallback_mix['pure_personalized_rate'],
            'total_any_fallback': fallback_mix['any_fallback_count'],
            'total_any_fallback_rate': fallback_mix['any_fallback_rate'],
        },
        'for_you_signal_source_breakdown': for_you_signal_source_breakdown,
        'behavior_enhanced_signal_source_breakdown': (
            behavior_enhanced_signal_source_breakdown
        ),
        'behavior_input_aggregates': behavior_input_aggregates,
        'broader_browsing_sparse_context': broader_browsing_sparse_context,
        'mixed_fallback_by_signal_source': mixed_fallback_by_signal_source,
        'ctr_by_surface_strategy': ctr_by_surface_strategy,
        'orphan_events': {
            'count': orphan_event_count,
            'rate': round(
                orphan_event_count / total_events, 4
            ) if total_events else None,
        },
        'events': {
            'total': total_events,
            'by_type': events_by_type,
            'impressions_by_surface': impressions_by_surface,
            'clicks_by_surface': clicks_by_surface,
            'ctr_by_surface': ctr_by_surface,
            'ctr_by_position': ctr_by_position,
            'ctr_by_strategy': ctr_by_strategy,
            'ctr_by_surface_strategy': ctr_by_surface_strategy,
            'ctr_by_signal_source': ctr_by_signal_source,
            'ctr_by_strategy_signal_source': ctr_by_strategy_signal_source,
            'orphan_event_count': orphan_event_count,
            'orphan_event_rate': round(
                orphan_event_count / total_events, 4
            ) if total_events else None,
        },
        'top_clicked': {
            'categories': top_clicked_categories,
            'activity_types': top_clicked_activity_types,
            'destinations': top_clicked_destinations,
        },
    }


def get_behavior_coverage_summary(days: int | None = None) -> dict:
    """
    Summarize behavior readiness across authenticated travellers.

    Returns:
        - Total active travellers who have completed onboarding
        - Count/rate with any qualifying events (click, detail_open)
        - Count/rate with >= RECOMMENDATION_BEHAVIOR_MIN_LISTINGS distinct listings
        - Event count distribution bands
        - Distinct listing count distribution bands
    """
    min_listings = settings.RECOMMENDATION_BEHAVIOR_MIN_LISTINGS

    since = None
    if days is not None:
        since = timezone.now() - timedelta(days=days)

    total_travellers = Account.objects.filter(
        role=Account.Role.TRAVELLER,
        is_active=True,
        has_completed_onboarding=True,
    )
    traveller_ids = list(total_travellers.values_list('id', flat=True))
    total_traveller_count = len(traveller_ids)

    user_stats = _build_user_behavior_stats(traveller_ids, since)

    with_any_events = len(user_stats)
    with_any_recommendation_events = sum(
        1
        for stats in user_stats.values()
        if stats['recommendation_event_count'] > 0
    )
    with_any_interaction_events = sum(
        1
        for stats in user_stats.values()
        if stats['interaction_event_count'] > 0
    )
    recommendation_only_users = sum(
        1
        for stats in user_stats.values()
        if stats['recommendation_event_count'] > 0
        and stats['interaction_event_count'] == 0
    )
    interaction_only_users = sum(
        1
        for stats in user_stats.values()
        if stats['recommendation_event_count'] == 0
        and stats['interaction_event_count'] > 0
    )
    mixed_source_users = sum(
        1
        for stats in user_stats.values()
        if stats['recommendation_event_count'] > 0
        and stats['interaction_event_count'] > 0
    )
    with_sufficient_listings = sum(
        1
        for stats in user_stats.values()
        if stats['distinct_listing_count'] >= min_listings
    )
    with_any_events_but_sparse = sum(
        1
        for stats in user_stats.values()
        if 0 < stats['distinct_listing_count'] < min_listings
    )

    event_count_bands = _compute_bands(
        values=[stats['event_count'] for stats in user_stats.values()],
        band_edges=[0, 1, 3, 10, 30],
        band_labels=['0', '1-2', '3-9', '10-29', '30+'],
        total_population=total_traveller_count,
    )
    listing_count_bands = _compute_bands(
        values=[stats['distinct_listing_count'] for stats in user_stats.values()],
        band_edges=[0, 1, 3, 6, 11],
        band_labels=['0', '1-2', '3-5', '6-10', '11+'],
        total_population=total_traveller_count,
    )

    total_recommendation_events = sum(
        stats['recommendation_event_count']
        for stats in user_stats.values()
    )
    total_interaction_events = sum(
        stats['interaction_event_count']
        for stats in user_stats.values()
    )

    return {
        'total_travellers': total_traveller_count,
        'with_any_events': with_any_events,
        'with_any_events_rate': round(
            with_any_events / total_traveller_count, 4
        ) if total_traveller_count else None,
        'with_any_recommendation_events': with_any_recommendation_events,
        'with_any_recommendation_events_rate': round(
            with_any_recommendation_events / total_traveller_count, 4
        ) if total_traveller_count else None,
        'with_any_interaction_events': with_any_interaction_events,
        'with_any_interaction_events_rate': round(
            with_any_interaction_events / total_traveller_count, 4
        ) if total_traveller_count else None,
        'recommendation_only_users': recommendation_only_users,
        'recommendation_only_users_rate': round(
            recommendation_only_users / total_traveller_count, 4
        ) if total_traveller_count else None,
        'interaction_only_users': interaction_only_users,
        'interaction_only_users_rate': round(
            interaction_only_users / total_traveller_count, 4
        ) if total_traveller_count else None,
        'mixed_source_users': mixed_source_users,
        'mixed_source_users_rate': round(
            mixed_source_users / total_traveller_count, 4
        ) if total_traveller_count else None,
        'with_sufficient_listings': with_sufficient_listings,
        'with_sufficient_listings_rate': round(
            with_sufficient_listings / total_traveller_count, 4
        ) if total_traveller_count else None,
        'with_any_events_but_sparse': with_any_events_but_sparse,
        'with_any_events_but_sparse_rate': round(
            with_any_events_but_sparse / total_traveller_count, 4
        ) if total_traveller_count else None,
        'min_listings_threshold': min_listings,
        'aggregate_events': {
            'recommendation_event_count': total_recommendation_events,
            'interaction_event_count': total_interaction_events,
            'combined_event_count': (
                total_recommendation_events + total_interaction_events
            ),
        },
        'source_mix': {
            'none_users': total_traveller_count - with_any_events,
            'none_users_rate': round(
                (total_traveller_count - with_any_events) / total_traveller_count,
                4,
            ) if total_traveller_count else None,
            'recommendation_only_users': recommendation_only_users,
            'recommendation_only_users_rate': round(
                recommendation_only_users / total_traveller_count,
                4,
            ) if total_traveller_count else None,
            'interaction_only_users': interaction_only_users,
            'interaction_only_users_rate': round(
                interaction_only_users / total_traveller_count,
                4,
            ) if total_traveller_count else None,
            'mixed_source_users': mixed_source_users,
            'mixed_source_users_rate': round(
                mixed_source_users / total_traveller_count,
                4,
            ) if total_traveller_count else None,
        },
        'event_count_bands': event_count_bands,
        'listing_count_bands': listing_count_bands,
        'with_qualifying_events': with_any_events,
        'with_qualifying_events_rate': round(
            with_any_events / total_traveller_count, 4
        ) if total_traveller_count else None,
        'meeting_sparse_threshold': with_sufficient_listings,
        'meeting_sparse_threshold_rate': round(
            with_sufficient_listings / total_traveller_count, 4
        ) if total_traveller_count else None,
        'distribution_bands': {
            'event_count_bands': event_count_bands,
            'listing_count_bands': listing_count_bands,
        },
    }


def get_vocab_drift_summary(limit_per_field: int = 10) -> dict:
    """
    Compare live listing/traveller values against the artifact multi-label vocab.
    """
    bundle = artifact_loader.get_bundle()
    fields = []

    field_specs = [
        (
            'listing.tags',
            'tags_list',
            Listing.objects.values_list('tags', flat=True).iterator(),
        ),
        (
            'listing.ideal_for',
            'ideal_for_list',
            Listing.objects.values_list('ideal_for', flat=True).iterator(),
        ),
        (
            'listing.best_seasons',
            'best_seasons_list',
            Listing.objects.values_list('best_seasons', flat=True).iterator(),
        ),
        (
            'listing.languages_offered',
            'languages_offered_list',
            Listing.objects.values_list('languages_offered', flat=True).iterator(),
        ),
    ]

    for source_name, vector_field, raw_iter in field_specs:
        fields.append(
            _summarize_unknown_values(
                source_name=source_name,
                vector_field=vector_field,
                known_values=set(bundle.multilabel_binarizers[vector_field].classes_),
                raw_iter=raw_iter,
                limit_per_field=limit_per_field,
            )
        )

    traveller_tag_counter = Counter()
    traveller_ideal_counter = Counter()
    traveller_records = 0

    known_tag_values = set(bundle.multilabel_binarizers['tags_list'].classes_)
    known_ideal_values = set(bundle.multilabel_binarizers['ideal_for_list'].classes_)

    for prefs in TravellerDetail.objects.select_related('user').iterator():
        traveller_records += 1
        payload = _build_preference_payload(prefs, prefs.user)
        for item in _coerce_iterable(payload.get('tags')):
            if item not in known_tag_values:
                traveller_tag_counter[item] += 1
        for item in _coerce_iterable(payload.get('ideal_for')):
            if item not in known_ideal_values:
                traveller_ideal_counter[item] += 1

    fields.append(_counter_summary(
        source_name='traveller.preferences.tags',
        vector_field='tags_list',
        counter=traveller_tag_counter,
        records_scanned=traveller_records,
        limit_per_field=limit_per_field,
    ))
    fields.append(_counter_summary(
        source_name='traveller.preferences.ideal_for',
        vector_field='ideal_for_list',
        counter=traveller_ideal_counter,
        records_scanned=traveller_records,
        limit_per_field=limit_per_field,
    ))

    fields.sort(key=lambda item: (-item['unknown_count'], item['source']))

    return {
        'artifact_version': bundle.version_label,
        'fields': fields,
    }


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def _avg(total: int, count: int) -> float | None:
    return round(total / count, 4) if count else None


def _extract_serving_behavior_fields(served_set) -> dict:
    metadata = getattr(served_set, 'serving_metadata', None)
    if not isinstance(metadata, dict):
        metadata = {}

    signal_source = metadata.get('behavior_signal_source') or 'none'
    if signal_source not in BEHAVIOR_SIGNAL_SOURCE_VALUES:
        signal_source = 'none'

    recommendation_event_count = _safe_int(
        metadata.get('recommendation_event_count')
    )
    interaction_event_count = _safe_int(
        metadata.get('interaction_event_count')
    )
    behavior_event_count = metadata.get('behavior_event_count')
    if behavior_event_count is None:
        behavior_event_count = (
            recommendation_event_count + interaction_event_count
        )
    behavior_listing_count = _safe_int(metadata.get('behavior_listing_count'))

    return {
        'behavior_signal_source': signal_source,
        'recommendation_event_count': recommendation_event_count,
        'interaction_event_count': interaction_event_count,
        'behavior_event_count': _safe_int(behavior_event_count),
        'behavior_listing_count': behavior_listing_count,
    }


def _has_behavior_input(fields: dict) -> bool:
    return (
        fields['behavior_event_count'] > 0
        or fields['recommendation_event_count'] > 0
        or fields['interaction_event_count'] > 0
        or fields['behavior_signal_source'] != 'none'
    )


def _classify_single_slate_fallback_mix(
    *,
    strategy: str,
    results_json: list[dict] | None,
) -> str:
    if strategy == 'popular_fallback':
        return 'pure_fallback'

    results = results_json or []
    if not results:
        return 'pure_fallback'

    has_personalized = any(item.get('distance') is not None for item in results)
    has_fallback = any(item.get('distance') is None for item in results)

    if has_personalized and has_fallback:
        return 'mixed_fallback'
    if has_fallback:
        return 'pure_fallback'
    return 'pure_personalized'


def _classify_fallback_mix(served_qs) -> dict:
    """
    Classify served slates into pure_personalized, mixed_fallback,
    and pure_fallback categories by examining results_json.

    A slate is:
      - pure_fallback: strategy='popular_fallback', or all items lack distance,
        or the slate is empty
      - mixed_fallback: non-popular_fallback strategy with at least one item
        with distance and at least one without
      - pure_personalized: all items have distance, strategy is not popular_fallback
    """
    pure_fallback = 0
    mixed_fallback = 0
    pure_personalized = 0

    for slate in served_qs.values('strategy', 'results_json'):
        fallback_type = _classify_single_slate_fallback_mix(
            strategy=slate['strategy'],
            results_json=slate['results_json'],
        )
        if fallback_type == 'mixed_fallback':
            mixed_fallback += 1
        elif fallback_type == 'pure_fallback':
            pure_fallback += 1
        else:
            pure_personalized += 1

    total = pure_fallback + mixed_fallback + pure_personalized
    return {
        'pure_fallback_count': pure_fallback,
        'pure_fallback_rate': round(pure_fallback / total, 4) if total else None,
        'mixed_fallback_count': mixed_fallback,
        'mixed_fallback_rate': round(mixed_fallback / total, 4) if total else None,
        'pure_personalized_count': pure_personalized,
        'pure_personalized_rate': round(
            pure_personalized / total, 4
        ) if total else None,
        'any_fallback_count': pure_fallback + mixed_fallback,
        'any_fallback_rate': round(
            (pure_fallback + mixed_fallback) / total, 4
        ) if total else None,
    }


def _for_you_strategy_breakdown(served_qs) -> dict:
    """
    Break down /for-you/ served slates by strategy.
    """
    fy_qs = served_qs.filter(surface='for_you')
    total = fy_qs.count()

    by_strategy = {
        row['strategy']: row['total']
        for row in fy_qs.values('strategy').annotate(total=Count('id'))
    }

    behavior_enhanced = by_strategy.get('behavior_enhanced', 0)
    preference_based = by_strategy.get('preference_based', 0)
    popular_fallback = by_strategy.get('popular_fallback', 0)

    return {
        'total': total,
        'behavior_enhanced_count': behavior_enhanced,
        'behavior_enhanced_rate': round(
            behavior_enhanced / total, 4
        ) if total else None,
        'preference_based_count': preference_based,
        'preference_based_rate': round(
            preference_based / total, 4
        ) if total else None,
        'popular_fallback_count': popular_fallback,
        'popular_fallback_rate': round(
            popular_fallback / total, 4
        ) if total else None,
    }


def _compute_signal_source_breakdown(served_qs, *, strategy: str | None = None) -> dict:
    fy_qs = served_qs.filter(surface='for_you')
    if strategy is not None:
        fy_qs = fy_qs.filter(strategy=strategy)

    total = fy_qs.count()
    counts = Counter()

    for slate in fy_qs.only('serving_metadata'):
        fields = _extract_serving_behavior_fields(slate)
        counts[fields['behavior_signal_source']] += 1

    return {
        'total': total,
        'by_source': {
            source: counts.get(source, 0)
            for source in BEHAVIOR_SIGNAL_SOURCE_VALUES
        },
        'none_count': counts.get('none', 0),
        'none_rate': _rate(counts.get('none', 0), total),
        'recommendation_only_count': counts.get('recommendation_only', 0),
        'recommendation_only_rate': _rate(
            counts.get('recommendation_only', 0),
            total,
        ),
        'browsing_only_count': counts.get('browsing_only', 0),
        'browsing_only_rate': _rate(counts.get('browsing_only', 0), total),
        'mixed_count': counts.get('mixed', 0),
        'mixed_rate': _rate(counts.get('mixed', 0), total),
    }


def _compute_behavior_input_aggregates(served_qs) -> dict:
    fy_qs = served_qs.filter(surface='for_you')
    total = fy_qs.count()

    slates_with_metadata_count = 0
    recommendation_event_count_sum = 0
    interaction_event_count_sum = 0
    behavior_event_count_sum = 0
    behavior_listing_count_sum = 0

    for slate in fy_qs.only('serving_metadata'):
        if slate.serving_metadata:
            slates_with_metadata_count += 1
        fields = _extract_serving_behavior_fields(slate)
        recommendation_event_count_sum += fields['recommendation_event_count']
        interaction_event_count_sum += fields['interaction_event_count']
        behavior_event_count_sum += fields['behavior_event_count']
        behavior_listing_count_sum += fields['behavior_listing_count']

    return {
        'total_for_you_slates': total,
        'slates_with_metadata_count': slates_with_metadata_count,
        'recommendation_event_count_sum': recommendation_event_count_sum,
        'interaction_event_count_sum': interaction_event_count_sum,
        'behavior_event_count_sum': behavior_event_count_sum,
        'behavior_listing_count_sum': behavior_listing_count_sum,
        'recommendation_event_count_avg': _avg(recommendation_event_count_sum, total),
        'interaction_event_count_avg': _avg(interaction_event_count_sum, total),
        'behavior_event_count_avg': _avg(behavior_event_count_sum, total),
        'behavior_listing_count_avg': _avg(behavior_listing_count_sum, total),
    }


def _compute_broader_browsing_sparse_context(served_qs) -> dict:
    fy_qs = served_qs.filter(surface='for_you')
    total = fy_qs.count()

    with_any_behavior_count = 0
    behavior_enhanced_count = 0
    preference_based_with_behavior_count = 0
    popular_fallback_with_behavior_count = 0

    for slate in fy_qs.only('strategy', 'serving_metadata'):
        fields = _extract_serving_behavior_fields(slate)
        if not _has_behavior_input(fields):
            continue

        with_any_behavior_count += 1
        if slate.strategy == 'behavior_enhanced':
            behavior_enhanced_count += 1
        elif slate.strategy == 'preference_based':
            preference_based_with_behavior_count += 1
        elif slate.strategy == 'popular_fallback':
            popular_fallback_with_behavior_count += 1

    return {
        'total_for_you_slates': total,
        'with_any_behavior_count': with_any_behavior_count,
        'with_any_behavior_rate': _rate(with_any_behavior_count, total),
        'behavior_enhanced_count': behavior_enhanced_count,
        'behavior_enhanced_rate_within_behavior_present': _rate(
            behavior_enhanced_count,
            with_any_behavior_count,
        ),
        'preference_based_with_behavior_count': (
            preference_based_with_behavior_count
        ),
        'preference_based_with_behavior_rate': _rate(
            preference_based_with_behavior_count,
            with_any_behavior_count,
        ),
        'popular_fallback_with_behavior_count': (
            popular_fallback_with_behavior_count
        ),
        'popular_fallback_with_behavior_rate': _rate(
            popular_fallback_with_behavior_count,
            with_any_behavior_count,
        ),
        'sparse_proxy_count': preference_based_with_behavior_count,
        'sparse_proxy_rate': _rate(
            preference_based_with_behavior_count,
            with_any_behavior_count,
        ),
        'none_source_count': total - with_any_behavior_count,
        'none_source_rate': _rate(total - with_any_behavior_count, total),
    }


def _compute_mixed_fallback_by_signal_source(served_qs) -> dict:
    fy_qs = served_qs.filter(surface='for_you')
    totals = Counter()
    mixed_fallback_counts = Counter()

    for slate in fy_qs.only('strategy', 'results_json', 'serving_metadata'):
        fields = _extract_serving_behavior_fields(slate)
        source = fields['behavior_signal_source']
        totals[source] += 1

        fallback_type = _classify_single_slate_fallback_mix(
            strategy=slate.strategy,
            results_json=slate.results_json,
        )
        if fallback_type == 'mixed_fallback':
            mixed_fallback_counts[source] += 1

    return {
        'total_for_you_slates': sum(totals.values()),
        'total_mixed_fallback_count': sum(mixed_fallback_counts.values()),
        'breakdown': {
            source: {
                'total': totals.get(source, 0),
                'mixed_fallback_count': mixed_fallback_counts.get(source, 0),
                'mixed_fallback_rate': _rate(
                    mixed_fallback_counts.get(source, 0),
                    totals.get(source, 0),
                ),
            }
            for source in BEHAVIOR_SIGNAL_SOURCE_VALUES
        },
    }


def _compute_ctr_by_surface_strategy(events_qs) -> list[dict]:
    """
    Compute CTR cross-tabulated by surface and strategy.
    """
    surface_strategy_pairs = list(
        events_qs.filter(event_type__in=['impression', 'click'])
        # Clear model default ordering so DISTINCT deduplicates the pair rows.
        .order_by()
        .values('surface', 'strategy')
        .distinct()
    )

    results = []
    for pair in surface_strategy_pairs:
        surface = pair['surface']
        strategy = pair['strategy']
        pair_qs = events_qs.filter(surface=surface, strategy=strategy)
        impressions = pair_qs.filter(event_type='impression').count()
        clicks = pair_qs.filter(event_type='click').count()
        results.append({
            'surface': surface,
            'strategy': strategy,
            'impressions': impressions,
            'clicks': clicks,
            'ctr': round(clicks / impressions, 4) if impressions else None,
        })

    results.sort(key=lambda r: (r['surface'], r['strategy']))
    return results


def _compute_ctr_by_signal_source(events_qs) -> list[dict]:
    impressions = Counter()
    clicks = Counter()

    for event in (
        events_qs.filter(
            surface='for_you',
            event_type__in=['impression', 'click'],
        )
        .select_related('served_set')
    ):
        source = 'none'
        if event.served_set is not None:
            source = _extract_serving_behavior_fields(
                event.served_set
            )['behavior_signal_source']

        if event.event_type == 'impression':
            impressions[source] += 1
        elif event.event_type == 'click':
            clicks[source] += 1

    rows = []
    for source in BEHAVIOR_SIGNAL_SOURCE_VALUES:
        impression_count = impressions.get(source, 0)
        click_count = clicks.get(source, 0)
        if impression_count == 0 and click_count == 0:
            continue
        rows.append({
            'behavior_signal_source': source,
            'impressions': impression_count,
            'clicks': click_count,
            'ctr': _rate(click_count, impression_count),
        })

    return rows


def _compute_ctr_by_strategy_signal_source(events_qs) -> list[dict]:
    counts = {}

    for event in (
        events_qs.filter(
            surface='for_you',
            event_type__in=['impression', 'click'],
        )
        .select_related('served_set')
    ):
        source = 'none'
        if event.served_set is not None:
            source = _extract_serving_behavior_fields(
                event.served_set
            )['behavior_signal_source']

        key = (event.strategy, source)
        bucket = counts.setdefault(key, {'impressions': 0, 'clicks': 0})
        if event.event_type == 'impression':
            bucket['impressions'] += 1
        elif event.event_type == 'click':
            bucket['clicks'] += 1

    rows = []
    for (strategy, source), bucket in counts.items():
        rows.append({
            'strategy': strategy,
            'behavior_signal_source': source,
            'impressions': bucket['impressions'],
            'clicks': bucket['clicks'],
            'ctr': _rate(bucket['clicks'], bucket['impressions']),
        })

    rows.sort(key=lambda row: (row['strategy'], row['behavior_signal_source']))
    return rows


def _build_user_behavior_stats(
    traveller_ids: list[int],
    since,
) -> dict[int, dict]:
    if not traveller_ids:
        return {}

    stats_by_user: dict[int, dict] = {}

    recommendation_events_qs = RecommendationEvent.objects.filter(
        user_id__in=traveller_ids,
        event_type__in=QUALIFYING_EVENT_TYPES,
        listing_id__isnull=False,
    )
    interaction_events_qs = ListingInteractionEvent.objects.filter(
        user_id__in=traveller_ids,
        event_type__in=QUALIFYING_INTERACTION_EVENT_TYPES,
        listing_id__isnull=False,
    )
    if since is not None:
        recommendation_events_qs = recommendation_events_qs.filter(created_at__gte=since)
        interaction_events_qs = interaction_events_qs.filter(created_at__gte=since)

    def get_user_stats(user_id: int) -> dict:
        return stats_by_user.setdefault(
            user_id,
            {
                'event_count': 0,
                'distinct_listing_ids': set(),
                'recommendation_event_count': 0,
                'interaction_event_count': 0,
            },
        )

    for event in recommendation_events_qs.values('user_id', 'listing_id'):
        stats = get_user_stats(event['user_id'])
        stats['event_count'] += 1
        stats['recommendation_event_count'] += 1
        stats['distinct_listing_ids'].add(event['listing_id'])

    for event in interaction_events_qs.values('user_id', 'listing_id'):
        stats = get_user_stats(event['user_id'])
        stats['event_count'] += 1
        stats['interaction_event_count'] += 1
        stats['distinct_listing_ids'].add(event['listing_id'])

    for stats in stats_by_user.values():
        stats['distinct_listing_count'] = len(stats['distinct_listing_ids'])

    return stats_by_user


def _compute_bands(
    *,
    values: list[int],
    band_edges: list[int],
    band_labels: list[str],
    total_population: int,
) -> list[dict]:
    """
    Bucket values into bands and return counts.

    band_edges defines the lower bound of each band. Users in total_population but not in values are counted in the first band (the '0' band — users with no events at all).
    """
    band_counts = [0] * len(band_labels)

    for v in values:
        placed = False
        for i in range(len(band_edges) - 1, -1, -1):
            if v >= band_edges[i]:
                band_counts[i] += 1
                placed = True
                break
        if not placed:
            band_counts[0] += 1

    users_without_events = total_population - len(values)
    if users_without_events > 0:
        band_counts[0] += users_without_events

    return [
        {'band': label, 'count': count}
        for label, count in zip(band_labels, band_counts)
    ]


def _group_event_counts(events_qs, group_field: str, event_type: str) -> dict:
    return {
        row[group_field]: row['total']
        for row in events_qs.filter(event_type=event_type)
        .values(group_field)
        .annotate(total=Count('id'))
    }


def _summarize_unknown_values(
    *,
    source_name: str,
    vector_field: str,
    known_values: set,
    raw_iter,
    limit_per_field: int,
) -> dict:
    counter = Counter()
    records_scanned = 0

    for raw_value in raw_iter:
        records_scanned += 1
        for item in _coerce_iterable(raw_value):
            if item not in known_values:
                counter[item] += 1

    return _counter_summary(
        source_name=source_name,
        vector_field=vector_field,
        counter=counter,
        records_scanned=records_scanned,
        limit_per_field=limit_per_field,
    )


def _counter_summary(
    *,
    source_name: str,
    vector_field: str,
    counter: Counter,
    records_scanned: int,
    limit_per_field: int,
) -> dict:
    return {
        'source': source_name,
        'vector_field': vector_field,
        'records_scanned': records_scanned,
        'unknown_count': sum(counter.values()),
        'unique_unknown_count': len(counter),
        'top_unknown_values': counter.most_common(limit_per_field),
    }


def _coerce_iterable(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    if isinstance(value, set):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    return [str(value).strip().lower()] if str(value).strip() else []
