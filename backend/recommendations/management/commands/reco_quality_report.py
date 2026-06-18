import json

from django.core.management.base import BaseCommand

from recommendations.services.monitoring_service import (
    get_behavior_coverage_summary,
    get_quality_summary,
    get_vocab_drift_summary,
)


class Command(BaseCommand):
    help = "Print recommendation quality metrics and optional artifact-vocabulary drift."

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=None,
            help="Limit the report window to the last N days.",
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help="Output raw JSON.",
        )
        parser.add_argument(
            '--include-vocab-drift',
            action='store_true',
            help="Include live vocab drift audit against the artifact bundle.",
        )
        parser.add_argument(
            '--include-behavior-coverage',
            action='store_true',
            help="Include behavior readiness coverage summary for travellers.",
        )

    def handle(self, *args, **options):
        summary = get_quality_summary(days=options['days'])
        if options['include_vocab_drift']:
            summary['vocab_drift'] = get_vocab_drift_summary()
        if options['include_behavior_coverage']:
            summary['behavior_coverage'] = get_behavior_coverage_summary(
                days=options['days'],
            )

        if options['json']:
            self.stdout.write(json.dumps(summary, indent=2, default=str))
            return

        self.stdout.write(self.style.MIGRATE_HEADING(
            "=== Recommendation Quality Report ==="
        ))
        self.stdout.write(
            f"Active model version: {summary['active_model_version'] or 'none'}"
        )
        if summary['window_days'] is not None:
            self.stdout.write(
                f"Window: last {summary['window_days']} day(s) "
                f"since {summary['window_start']}"
            )
        else:
            self.stdout.write("Window: all tracked data")

        served = summary['served_sets']
        self.stdout.write("\nServed slates")
        self.stdout.write(f"  Total          : {served['total']}")
        self.stdout.write(f"  Fallback count : {served['fallback_count']}")
        self.stdout.write(f"  Fallback rate  : {served['fallback_rate']}")
        self.stdout.write(f"  Empty count    : {served['empty_count']}")
        self.stdout.write(f"  Empty rate     : {served['empty_rate']}")
        self.stdout.write(f"  By surface     : {served['by_surface']}")
        self.stdout.write(f"  By strategy    : {served['by_strategy']}")

        self.stdout.write("\nFallback analysis (Phase 2.5)")
        self.stdout.write(
            f"  Pure fallback       : {served['pure_fallback_count']} "
            f"({served['pure_fallback_rate']})"
        )
        self.stdout.write(
            f"  Mixed fallback      : {served['mixed_fallback_count']} "
            f"({served['mixed_fallback_rate']})"
        )
        self.stdout.write(
            f"  Pure personalized   : {served['pure_personalized_count']} "
            f"({served['pure_personalized_rate']})"
        )
        self.stdout.write(
            f"  Any fallback (total): {served['any_fallback_count']} "
            f"({served['any_fallback_rate']})"
        )

        fy = summary['for_you_breakdown']
        self.stdout.write("\n/for-you/ strategy breakdown (Phase 2.5)")
        self.stdout.write(f"  Total               : {fy['total']}")
        self.stdout.write(
            f"  behavior_enhanced   : {fy['behavior_enhanced_count']} "
            f"({fy['behavior_enhanced_rate']})"
        )
        self.stdout.write(
            f"  preference_based    : {fy['preference_based_count']} "
            f"({fy['preference_based_rate']})"
        )
        self.stdout.write(
            f"  popular_fallback    : {fy['popular_fallback_count']} "
            f"({fy['popular_fallback_rate']})"
        )

        signal_breakdown = summary['for_you_signal_source_breakdown']
        self.stdout.write("\n/for-you/ behavior signal source breakdown (Part 6)")
        self.stdout.write(f"  Total               : {signal_breakdown['total']}")
        self.stdout.write(
            f"  none                : {signal_breakdown['none_count']} "
            f"({signal_breakdown['none_rate']})"
        )
        self.stdout.write(
            f"  recommendation_only : {signal_breakdown['recommendation_only_count']} "
            f"({signal_breakdown['recommendation_only_rate']})"
        )
        self.stdout.write(
            f"  browsing_only       : {signal_breakdown['browsing_only_count']} "
            f"({signal_breakdown['browsing_only_rate']})"
        )
        self.stdout.write(
            f"  mixed               : {signal_breakdown['mixed_count']} "
            f"({signal_breakdown['mixed_rate']})"
        )

        enhanced_signal_breakdown = summary['behavior_enhanced_signal_source_breakdown']
        self.stdout.write(
            "\nbehavior_enhanced signal source breakdown (Part 6)"
        )
        self.stdout.write(
            f"  Total               : {enhanced_signal_breakdown['total']}"
        )
        self.stdout.write(
            f"  none                : {enhanced_signal_breakdown['none_count']} "
            f"({enhanced_signal_breakdown['none_rate']})"
        )
        self.stdout.write(
            f"  recommendation_only : "
            f"{enhanced_signal_breakdown['recommendation_only_count']} "
            f"({enhanced_signal_breakdown['recommendation_only_rate']})"
        )
        self.stdout.write(
            f"  browsing_only       : "
            f"{enhanced_signal_breakdown['browsing_only_count']} "
            f"({enhanced_signal_breakdown['browsing_only_rate']})"
        )
        self.stdout.write(
            f"  mixed               : {enhanced_signal_breakdown['mixed_count']} "
            f"({enhanced_signal_breakdown['mixed_rate']})"
        )

        behavior_inputs = summary['behavior_input_aggregates']
        self.stdout.write("\nBehavior input aggregates (Part 6)")
        self.stdout.write(
            f"  Recommendation events sum : "
            f"{behavior_inputs['recommendation_event_count_sum']}"
        )
        self.stdout.write(
            f"  Interaction events sum    : "
            f"{behavior_inputs['interaction_event_count_sum']}"
        )
        self.stdout.write(
            f"  Combined behavior sum     : "
            f"{behavior_inputs['behavior_event_count_sum']}"
        )
        self.stdout.write(
            f"  Behavior listings sum     : "
            f"{behavior_inputs['behavior_listing_count_sum']}"
        )
        self.stdout.write(
            f"  Recommendation avg/slate  : "
            f"{behavior_inputs['recommendation_event_count_avg']}"
        )
        self.stdout.write(
            f"  Interaction avg/slate     : "
            f"{behavior_inputs['interaction_event_count_avg']}"
        )

        sparse_context = summary['broader_browsing_sparse_context']
        self.stdout.write("\nBroader browsing sparse context (Part 6)")
        self.stdout.write(
            f"  With any behavior         : "
            f"{sparse_context['with_any_behavior_count']} "
            f"({sparse_context['with_any_behavior_rate']})"
        )
        self.stdout.write(
            f"  behavior_enhanced         : "
            f"{sparse_context['behavior_enhanced_count']} "
            f"({sparse_context['behavior_enhanced_rate_within_behavior_present']})"
        )
        self.stdout.write(
            f"  preference_based w/behavior: "
            f"{sparse_context['preference_based_with_behavior_count']} "
            f"({sparse_context['preference_based_with_behavior_rate']})"
        )
        self.stdout.write(
            f"  popular_fallback w/behavior: "
            f"{sparse_context['popular_fallback_with_behavior_count']} "
            f"({sparse_context['popular_fallback_with_behavior_rate']})"
        )

        mixed_fallback = summary['mixed_fallback_by_signal_source']
        self.stdout.write("\nMixed fallback by signal source (Part 6)")
        self.stdout.write(
            f"  Total mixed fallback      : "
            f"{mixed_fallback['total_mixed_fallback_count']}"
        )
        for source, row in mixed_fallback['breakdown'].items():
            self.stdout.write(
                f"  {source}: total={row['total']} "
                f"mixed_fallback={row['mixed_fallback_count']} "
                f"rate={row['mixed_fallback_rate']}"
            )

        events = summary['events']
        self.stdout.write("\nEvents")
        self.stdout.write(f"  Total                : {events['total']}")
        self.stdout.write(f"  By type              : {events['by_type']}")
        self.stdout.write(f"  Impressions/surface  : {events['impressions_by_surface']}")
        self.stdout.write(f"  Clicks/surface       : {events['clicks_by_surface']}")
        self.stdout.write(
            f"  Orphan events        : {events['orphan_event_count']} "
            f"({events['orphan_event_rate']})"
        )

        self.stdout.write("\nCTR by surface")
        for row in events['ctr_by_surface']:
            self.stdout.write(
                f"  {row['surface']}: impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        self.stdout.write("\nCTR by strategy (Phase 2.5)")
        for row in events['ctr_by_strategy']:
            self.stdout.write(
                f"  {row['strategy']}: impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        self.stdout.write("\nCTR by surface + strategy (Phase 2.5)")
        for row in events['ctr_by_surface_strategy']:
            self.stdout.write(
                f"  {row['surface']}/{row['strategy']}: "
                f"impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        self.stdout.write("\nCTR by behavior signal source (Part 6)")
        for row in events['ctr_by_signal_source']:
            self.stdout.write(
                f"  {row['behavior_signal_source']}: "
                f"impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        self.stdout.write("\nCTR by strategy + behavior signal source (Part 6)")
        for row in events['ctr_by_strategy_signal_source']:
            self.stdout.write(
                f"  {row['strategy']}/{row['behavior_signal_source']}: "
                f"impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        self.stdout.write("\nCTR by position")
        for row in events['ctr_by_position']:
            self.stdout.write(
                f"  pos {row['position']}: impressions={row['impressions']} "
                f"clicks={row['clicks']} ctr={row['ctr']}"
            )

        top_clicked = summary['top_clicked']
        self.stdout.write("\nTop clicked categories")
        for row in top_clicked['categories']:
            self.stdout.write(f"  {row['listing__category']}: {row['clicks']}")

        self.stdout.write("\nTop clicked activity types")
        for row in top_clicked['activity_types']:
            self.stdout.write(f"  {row['listing__activity_type']}: {row['clicks']}")

        self.stdout.write("\nTop clicked destinations")
        for row in top_clicked['destinations']:
            self.stdout.write(f"  {row['listing__destination']}: {row['clicks']}")

        if options['include_behavior_coverage']:
            bc = summary['behavior_coverage']
            self.stdout.write(self.style.MIGRATE_HEADING(
                "\n=== Behavior Coverage Summary ==="
            ))
            self.stdout.write(f"  Total travellers          : {bc['total_travellers']}")
            self.stdout.write(
                f"  With any qualifying events : {bc['with_any_events']} "
                f"({bc['with_any_events_rate']})"
            )
            self.stdout.write(
                f"  With recommendation events : "
                f"{bc['with_any_recommendation_events']} "
                f"({bc['with_any_recommendation_events_rate']})"
            )
            self.stdout.write(
                f"  With interaction events    : "
                f"{bc['with_any_interaction_events']} "
                f"({bc['with_any_interaction_events_rate']})"
            )
            self.stdout.write(
                f"  Recommendation-only users  : "
                f"{bc['recommendation_only_users']} "
                f"({bc['recommendation_only_users_rate']})"
            )
            self.stdout.write(
                f"  Interaction-only users     : "
                f"{bc['interaction_only_users']} "
                f"({bc['interaction_only_users_rate']})"
            )
            self.stdout.write(
                f"  Mixed-source users         : "
                f"{bc['mixed_source_users']} "
                f"({bc['mixed_source_users_rate']})"
            )
            self.stdout.write(
                f"  With sufficient listings   : {bc['with_sufficient_listings']} "
                f"({bc['with_sufficient_listings_rate']})"
            )
            self.stdout.write(
                f"  With events but sparse     : {bc['with_any_events_but_sparse']} "
                f"({bc['with_any_events_but_sparse_rate']})"
            )
            self.stdout.write(
                f"  Min listings threshold     : {bc['min_listings_threshold']}"
            )
            self.stdout.write(
                f"  Aggregate recommendation events : "
                f"{bc['aggregate_events']['recommendation_event_count']}"
            )
            self.stdout.write(
                f"  Aggregate interaction events    : "
                f"{bc['aggregate_events']['interaction_event_count']}"
            )
            self.stdout.write("\n  Event count distribution:")
            for band in bc['event_count_bands']:
                self.stdout.write(f"    {band['band']:>6s}: {band['count']}")
            self.stdout.write("\n  Distinct listing count distribution:")
            for band in bc['listing_count_bands']:
                self.stdout.write(f"    {band['band']:>6s}: {band['count']}")

        if options['include_vocab_drift']:
            self.stdout.write(self.style.MIGRATE_HEADING(
                "\n=== Artifact Vocabulary Drift ==="
            ))
            for field in summary['vocab_drift']['fields']:
                self.stdout.write(
                    f"  {field['source']} -> unknown_count={field['unknown_count']} "
                    f"unique_unknown_count={field['unique_unknown_count']}"
                )
                for value, count in field['top_unknown_values']:
                    self.stdout.write(f"    {value}: {count}")
