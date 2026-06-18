import json
import uuid
from datetime import timedelta
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

import numpy as np
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import resolve, reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Account, HostDetail, TravellerDetail
from listings.models import (
    ActivityType,
    CancellationPolicy,
    Category,
    DifficultyLevel,
    DurationType,
    Listing,
)
from packages.models import Package, PackageListing, PackageSlot
from recommendations.models import (
    ListingFeatureSnapshot,
    ListingInteractionEvent,
    RecommendationEvent,
    RecommendationModelVersion,
    ServedRecommendationSet,
    UserBehaviorProfileSnapshot,
)
from recommendations.services.artifact_loader import ArtifactLoadError, artifact_loader
from recommendations.services.behavior_profile_service import (
    BehaviorProfile,
    build_behavior_profile,
)
from recommendations.services.behavior_query_builder_service import (
    BehaviorQueryResult,
    build_behavior_query,
)
from recommendations.services.cache_versioning_service import (
    bump_catalog_generation,
    bump_user_behavior_generation,
    get_user_behavior_generation,
    get_user_preference_generation,
)
from recommendations.services.monitoring_service import (
    get_behavior_coverage_summary,
    get_quality_summary,
    get_vocab_drift_summary,
)
from recommendations.services.preprocessing import (
    preprocess_listing,
    preprocess_traveller_query,
)
from recommendations.services.recommendation_service import (
    PackageRecommendationResult,
    RecommendationResult,
    get_for_you_packages,
    get_for_you_listings,
    get_similar_listings,
)
from recommendations.services.tracking_service import (
    create_served_slate,
    persist_events,
    persist_listing_interactions,
)
from recommendations.services.vectorizer import vectorize_batch, vectorize_listing
from recommendations.serializers import (
    EventBatchSerializer,
    InteractionBatchSerializer,
)
from recommendations.tasks import (
    rebuild_user_behavior_profile_snapshot_task,
    reindex_listing_task,
)
from recommendations.views import (
    EventIngestionView,
    ForYouListingsView,
    ForYouPackagesView,
    InteractionIngestionView,
    SimilarListingsView,
)


class RecommendationTestDataMixin:
    account_seq = 0
    listing_seq = 0
    model_seq = 0
    package_seq = 0

    def create_account(self, role=Account.Role.TRAVELLER, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            'email': f'{role}-{seq}@example.com',
            'role': role,
            'first_name': 'Test',
            'last_name': 'User',
            'is_active': True,
            'has_completed_onboarding': True,
            'onboarding_step': 5,
        }
        defaults.update(overrides)
        return Account.objects.create(**defaults)

    def create_host(self, **overrides):
        user = overrides.pop('user', None) or self.create_account(role=Account.Role.HOST)
        defaults = {
            'user': user,
            'business_name': 'Test Host Co.',
            'verification_status': HostDetail.VerificationStatus.APPROVED,
        }
        defaults.update(overrides)
        return HostDetail.objects.create(**defaults)

    def create_traveller(self, **overrides):
        preference_overrides = overrides.pop('preferences', {})
        user = overrides.pop('user', None) or self.create_account(role=Account.Role.TRAVELLER, **overrides)
        TravellerDetail.objects.create(
            user=user,
            preferred_activities=preference_overrides.get('preferred_activities', []),
            preferred_min_budget=preference_overrides.get('preferred_min_budget'),
            preferred_max_budget=preference_overrides.get('preferred_max_budget'),
            preferred_trip_style=preference_overrides.get('preferred_trip_style'),
        )
        return user

    def create_model_version(self, is_active=True, **overrides):
        self.__class__.model_seq += 1
        seq = self.__class__.model_seq
        defaults = {
            'version_label': f'test-v{seq}',
            'artifact_hash': f'hash-{seq}',
            'sklearn_version': '1.6.1',
            'vector_dimension': settings.RECOMMENDATION_VECTOR_DIMENSION,
            'is_active': is_active,
        }
        defaults.update(overrides)
        if is_active:
            RecommendationModelVersion.objects.update(is_active=False)
        return RecommendationModelVersion.objects.create(**defaults)

    def create_listing(self, **overrides):
        self.__class__.listing_seq += 1
        seq = self.__class__.listing_seq
        host = overrides.pop('host', None) or self.create_host()
        is_active = overrides.pop('is_active', True)
        is_bookable = overrides.pop('is_bookable', True)

        defaults = {
            'host': host,
            'title': f'Test Listing {seq}',
            'description': 'A well described cultural experience in Kathmandu.',
            'destination': 'Kathmandu',
            'location': 'Durbar Square',
            'category': Category.CULTURAL,
            'activity_type': ActivityType.CITY_TOUR,
            'difficulty_level': DifficultyLevel.MODERATE,
            'ideal_for': ['families'],
            'price_per_person': '1200.00',
            'duration_type': DurationType.FULL_DAY,
            'duration_days': 1,
            'duration_nights': 0,
            'tags': [],
            'what_to_bring': 'Water bottle',
            'requirements': 'None',
            'inclusions': ['Guide'],
            'exclusions': ['Personal expenses'],
            'cancellation_policy': CancellationPolicy.MODERATE,
            'languages_offered': ['english'],
            'rating_average': '4.50',
            'rating_count': 10,
            'booking_count': 5,
            'best_seasons': ['autumn'],
            'max_group_size': 10,
            'min_group_size': 1,
            'instant_booking': True,
            'is_active': True,
            'is_bookable': False,
        }
        defaults.update(overrides)
        listing = Listing.objects.create(**defaults)
        Listing.objects.filter(pk=listing.pk).update(
            is_active=is_active,
            is_bookable=is_bookable,
        )
        listing.refresh_from_db()
        return listing

    def create_package(self, **overrides):
        self.__class__.package_seq += 1
        seq = self.__class__.package_seq
        host = overrides.pop('host', None) or self.create_host()
        listings = overrides.pop('listings', None) or [
            self.create_listing(host=host, is_bookable=True),
            self.create_listing(host=host, is_bookable=True),
        ]
        slot_start_date = overrides.pop('slot_start_date', None)
        create_slot = overrides.pop('create_slot', True)
        is_active = overrides.pop('is_active', True)
        is_bookable = overrides.pop('is_bookable', True)

        defaults = {
            'host': host,
            'title': f'Package {seq}',
            'slug': f'package-{seq}',
            'description': 'A curated package built from multiple listings.',
            'duration_days': 3,
            'duration_nights': 2,
            'total_price': '9000.00',
            'max_group_size': 8,
            'booking_count': 12,
            'rating_average': '4.40',
            'rating_count': 6,
            'tags': ['curated'],
            'is_active': is_active,
            'is_bookable': is_bookable,
        }
        defaults.update(overrides)
        package = Package.objects.create(**defaults)

        for index, listing in enumerate(listings, start=1):
            PackageListing.objects.create(
                package=package,
                listing=listing,
                sort_order=index,
            )

        if create_slot:
            if slot_start_date is None:
                slot_start_date = timezone.now().date() + timedelta(days=7)
            PackageSlot.objects.create(
                package=package,
                start_date=slot_start_date,
                end_date=slot_start_date + timedelta(days=max(package.duration_days - 1, 0)),
                capacity=package.max_group_size,
                is_active=True,
            )

        return package


class RecommendationCacheBackendMixin:
    def setUp(self):
        super().setUp()
        self.recommendation_cache_backend = LocMemCache(
            f'recommendation-tests-{id(self)}',
            {},
        )
        self.recommendation_cache_patch = mock.patch(
            'recommendations.services.recommendation_service.cache',
            self.recommendation_cache_backend,
        )
        self.recommendation_cache_patch.start()
        self.addCleanup(self.recommendation_cache_patch.stop)

        self.generation_cache_patch = mock.patch(
            'recommendations.services.cache_versioning_service._get_cache',
            return_value=self.recommendation_cache_backend,
        )
        self.generation_cache_patch.start()
        self.addCleanup(self.generation_cache_patch.stop)


class ArtifactLoaderTests(SimpleTestCase):
    def test_artifact_loader_loads_current_bundle(self):
        bundle = artifact_loader.get_bundle()

        self.assertEqual(bundle.version_label, '2.0.0')
        self.assertEqual(bundle.vector_dimension, settings.RECOMMENDATION_VECTOR_DIMENSION)
        self.assertTrue(bundle.sklearn_version)
        self.assertIsNotNone(bundle.vectorizer)

    def test_artifact_loader_raises_for_missing_directory(self):
        with TemporaryDirectory() as temp_dir:
            missing_dir = Path(temp_dir) / 'missing'
            with override_settings(RECOMMENDATION_ARTIFACT_DIR=missing_dir):
                with self.assertRaises(ArtifactLoadError):
                    artifact_loader.reload()


class PreprocessingAndVectorizerTests(SimpleTestCase):
    def test_preprocess_listing_returns_expected_fields(self):
        host_user = Account(email='host@example.com', role=Account.Role.HOST)
        host = HostDetail(user=host_user, business_name='Host')
        listing = Listing(
            host=host,
            title='Kathmandu Heritage Walk',
            description='Explore temples and courtyards',
            destination='Kathmandu',
            location='Basantapur',
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.MODERATE,
            ideal_for=['families'],
            price_per_person='1000.00',
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            average_duration_hours='7.0',
            tags=[],
            languages_offered=['english'],
            best_seasons=['autumn'],
            max_group_size=10,
            is_bookable=True,
            instant_booking=True,
            is_active=True,
        )

        preprocessed = preprocess_listing(listing)

        self.assertEqual(preprocessed['category_mapped'], 'heritage')
        self.assertEqual(preprocessed['activity_type_for_ohe'], 'city_tour')
        self.assertEqual(preprocessed['difficulty_level_norm'], 'moderate')
        self.assertEqual(preprocessed['duration_type_mapped'], 'full_day')
        self.assertIn('combined_text', preprocessed)
        self.assertIn('meta_token_text', preprocessed)

    def test_vectorize_listing_returns_expected_dimension(self):
        host_user = Account(email='host2@example.com', role=Account.Role.HOST)
        host = HostDetail(user=host_user, business_name='Host')
        listing = Listing(
            host=host,
            title='Pokhara Sightseeing',
            description='Lake views and local sightseeing',
            destination='Pokhara',
            location='Lakeside',
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=['families'],
            price_per_person='1500.00',
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            average_duration_hours='7.0',
            tags=[],
            languages_offered=['english'],
            best_seasons=['autumn'],
            max_group_size=8,
            is_bookable=True,
            instant_booking=True,
            is_active=True,
        )

        vector = vectorize_listing(preprocess_listing(listing))

        self.assertEqual(vector.shape, (settings.RECOMMENDATION_VECTOR_DIMENSION,))

    def test_vectorize_batch_logs_unknown_multivalue_labels_once(self):
        preprocessed = {
            'combined_text': 'solo traveler cultural tour kathmandu',
            'category_mapped': 'cultural',
            'activity_type_for_ohe': 'city_tour',
            'difficulty_level_norm': 'easy',
            'duration_type_mapped': 'full_day',
            'tags_list': [],
            'ideal_for_list': ['solo'],
            'best_seasons_list': ['autumn'],
            'languages_offered_list': ['english'],
            'duration_days_filled': 1.0,
            'duration_nights_filled': 0.0,
            'average_duration_hours_filled': 7.0,
            'max_group_size': 4.0,
        }

        with self.assertLogs('recommendations', level='WARNING') as captured:
            vectors = vectorize_batch([preprocessed])

        self.assertEqual(len(vectors), 1)
        self.assertEqual(
            vectors[0].shape,
            (settings.RECOMMENDATION_VECTOR_DIMENSION,),
        )
        self.assertTrue(
            any('ideal_for_list' in message for message in captured.output)
        )


class TravellerPreferencePreprocessingTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def test_preprocess_traveller_query_maps_frontend_labels_to_artifact_signals(self):
        traveller = self.create_traveller(
            city='Kathmandu',
            preferences={
                'preferred_activities': [
                    'Food & Local Experiences',
                    'Photography',
                ],
                'preferred_trip_style': 'Family',
            },
        )

        preprocessed = preprocess_traveller_query(traveller)

        self.assertEqual(preprocessed['activity_type_for_ohe'], 'cooking_class')
        self.assertEqual(preprocessed['destination_norm'], 'kathmandu')
        self.assertIn('food tour', preprocessed['tags_list'])
        self.assertIn('local food experience', preprocessed['tags_list'])
        self.assertIn('photography', preprocessed['tags_list'])
        self.assertIn('photo walk', preprocessed['tags_list'])
        self.assertIn('family travel', preprocessed['ideal_for_list'])
        self.assertNotIn('food & local experiences', preprocessed['tags_list'])

    def test_preprocess_traveller_query_maps_photography_to_city_tour(self):
        traveller = self.create_traveller(
            city='Pokhara',
            preferences={
                'preferred_activities': ['Photography'],
            },
        )

        preprocessed = preprocess_traveller_query(traveller)

        self.assertEqual(preprocessed['activity_type_for_ohe'], 'city_tour')
        self.assertEqual(preprocessed['category_mapped'], 'photography')
        self.assertIn('photography', preprocessed['tags_list'])


class RecommendationServiceTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def _make_query_result(
        self,
        *,
        strategy='preference_based',
        behavior_used=False,
        behavior_event_count=0,
        behavior_listing_count=0,
        recommendation_event_count=0,
        interaction_event_count=0,
        behavior_signal_source='none',
    ):
        vector = np.ones(
            settings.RECOMMENDATION_VECTOR_DIMENSION,
            dtype=np.float32,
        )
        vector = vector / np.linalg.norm(vector)
        return BehaviorQueryResult(
            query_vector=vector,
            preference_vector=vector,
            preprocessed_payload={'dummy': 'query'},
            strategy=strategy,
            behavior_used=behavior_used,
            alpha_applied=(
                settings.RECOMMENDATION_BEHAVIOR_ALPHA if behavior_used else 0.0
            ),
            behavior_event_count=behavior_event_count,
            behavior_listing_count=behavior_listing_count,
            recommendation_event_count=recommendation_event_count,
            interaction_event_count=interaction_event_count,
            behavior_signal_source=behavior_signal_source,
        )

    def test_get_similar_listings_falls_back_when_no_active_model(self):
        source = self.create_listing(is_bookable=True, rating_average='4.20')
        other = self.create_listing(is_bookable=True, rating_average='4.80')

        result = get_similar_listings(source.pk, limit=3)

        self.assertEqual(result.strategy, 'popular_fallback')
        self.assertEqual(result.seed_listing_id, source.pk)
        self.assertEqual(result.listing_ids, [other.pk])
        self.assertEqual(result.results_detail, [{'listing_id': other.pk, 'distance': None}])

    def test_get_for_you_listings_falls_back_when_traveller_has_no_preferences(self):
        self.create_model_version(is_active=True)
        first = self.create_listing(is_bookable=True, rating_average='4.90')
        second = self.create_listing(is_bookable=True, rating_average='4.10')
        traveller = self.create_traveller(preferences={})

        result = get_for_you_listings(traveller, limit=2)

        self.assertEqual(result.strategy, 'popular_fallback')
        self.assertEqual(result.listing_ids, [first.pk, second.pk])
        self.assertEqual(len(result.results_detail), 2)

    def test_get_similar_listings_uses_cached_results_after_first_lookup(self):
        self.create_model_version(is_active=True, version_label='cache-v1')
        source = self.create_listing(is_bookable=True)
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.preprocess_listing',
            return_value={'dummy': 'data'},
        ), mock.patch(
            'recommendations.services.recommendation_service.vectorize_listing',
            return_value=np.ones(settings.RECOMMENDATION_VECTOR_DIMENSION, dtype=np.float32),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_similar',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.11}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            first = get_similar_listings(source.pk, limit=1)

        self.assertEqual(first.listing_ids, [recommended.pk])
        self.assertEqual(
            first.results_detail,
            [{'listing_id': recommended.pk, 'distance': 0.11}],
        )

        with mock.patch(
            'recommendations.services.recommendation_service.preprocess_listing',
            side_effect=AssertionError('expected similar recommendations cache hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.vectorize_listing',
            side_effect=AssertionError('expected similar recommendations cache hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_similar',
            side_effect=AssertionError('expected similar recommendations cache hit'),
        ):
            second = get_similar_listings(source.pk, limit=1)

        self.assertEqual(second.listing_ids, [recommended.pk])
        self.assertEqual(
            second.results_detail,
            [{'listing_id': recommended.pk, 'distance': 0.11}],
        )

    def test_get_for_you_listings_recomputes_after_preference_update(self):
        self.create_model_version(is_active=True, version_label='cache-v2')
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})
        recommended = self.create_listing(is_bookable=True)

        build_profile_mock = mock.Mock(
            return_value=BehaviorProfile(
                behavior_vector=None,
                is_sparse=True,
                event_count=0,
                distinct_listing_count=0,
                top_listing_ids=[],
            )
        )
        build_query_mock = mock.Mock(return_value=self._make_query_result())
        retrieve_mock = mock.Mock(
            return_value=[{'listing_id': recommended.pk, 'distance': 0.07}]
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            build_profile_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            build_query_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            retrieve_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            first = get_for_you_listings(traveller, limit=1)
            second = get_for_you_listings(traveller, limit=1)

            detail = traveller.traveller_detail
            detail.preferred_activities = ['food & local experiences']
            detail.save(update_fields=['preferred_activities'])

            third = get_for_you_listings(traveller, limit=1)

        self.assertEqual(first.listing_ids, [recommended.pk])
        self.assertEqual(second.listing_ids, [recommended.pk])
        self.assertEqual(third.listing_ids, [recommended.pk])
        self.assertEqual(build_profile_mock.call_count, 2)
        self.assertEqual(build_query_mock.call_count, 2)
        self.assertEqual(retrieve_mock.call_count, 2)

    def test_get_for_you_listings_recomputes_after_catalog_generation_bump(self):
        self.create_model_version(is_active=True, version_label='cache-v3')
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})
        recommended = self.create_listing(is_bookable=True)

        build_profile_mock = mock.Mock(
            return_value=BehaviorProfile(
                behavior_vector=None,
                is_sparse=True,
                event_count=0,
                distinct_listing_count=0,
                top_listing_ids=[],
            )
        )
        build_query_mock = mock.Mock(return_value=self._make_query_result())
        retrieve_mock = mock.Mock(
            return_value=[{'listing_id': recommended.pk, 'distance': 0.09}]
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            build_profile_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            build_query_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            retrieve_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            first = get_for_you_listings(traveller, limit=1)
            second = get_for_you_listings(traveller, limit=1)
            bump_catalog_generation()
            third = get_for_you_listings(traveller, limit=1)

        self.assertEqual(first.listing_ids, [recommended.pk])
        self.assertEqual(second.listing_ids, [recommended.pk])
        self.assertEqual(third.listing_ids, [recommended.pk])
        self.assertEqual(build_profile_mock.call_count, 2)
        self.assertEqual(build_query_mock.call_count, 2)
        self.assertEqual(retrieve_mock.call_count, 2)

    def test_get_for_you_listings_prefers_in_budget_candidates_when_min_budget_is_set(self):
        self.create_model_version(is_active=True, version_label='budget-v1')
        traveller = self.create_traveller(
            preferences={
                'preferred_activities': ['Photography'],
                'preferred_min_budget': '1000.00',
                'preferred_max_budget': '5000.00',
            }
        )
        below_min = self.create_listing(
            is_bookable=True,
            price_per_person='500.00',
            category=Category.PHOTOGRAPHY,
            activity_type=ActivityType.CITY_TOUR,
        )
        in_range = self.create_listing(
            is_bookable=True,
            price_per_person='2000.00',
            category=Category.PHOTOGRAPHY,
            activity_type=ActivityType.CITY_TOUR,
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=BehaviorProfile(
                behavior_vector=None,
                is_sparse=True,
                event_count=0,
                distinct_listing_count=0,
                top_listing_ids=[],
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_query_result(),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[
                {'listing_id': below_min.pk, 'distance': 0.05},
                {'listing_id': in_range.pk, 'distance': 0.08},
            ],
        ):
            result = get_for_you_listings(traveller, limit=2)

        self.assertEqual(result.listing_ids, [in_range.pk, below_min.pk])
        self.assertFalse(result.used_fallback)
        self.assertEqual(result.personalized_count, 2)
        self.assertEqual(result.fallback_count, 0)

    def test_get_for_you_listings_fallback_respects_max_budget(self):
        self.create_model_version(is_active=True, version_label='budget-v2')
        traveller = self.create_traveller(
            preferences={
                'preferred_activities': ['Photography'],
                'preferred_min_budget': '1000.00',
                'preferred_max_budget': '1000.00',
            }
        )
        over_budget_candidate = self.create_listing(
            is_bookable=True,
            price_per_person='2000.00',
            category=Category.PHOTOGRAPHY,
            activity_type=ActivityType.CITY_TOUR,
        )
        under_budget_fallback = self.create_listing(
            is_bookable=True,
            price_per_person='900.00',
            rating_average='4.10',
            booking_count=4,
        )
        over_budget_fallback = self.create_listing(
            is_bookable=True,
            price_per_person='9000.00',
            rating_average='4.95',
            booking_count=100,
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=BehaviorProfile(
                behavior_vector=None,
                is_sparse=True,
                event_count=0,
                distinct_listing_count=0,
                top_listing_ids=[],
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_query_result(),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[
                {'listing_id': over_budget_candidate.pk, 'distance': 0.05},
            ],
        ):
            result = get_for_you_listings(traveller, limit=2)

        self.assertIn(under_budget_fallback.pk, result.listing_ids)
        self.assertNotIn(over_budget_fallback.pk, result.listing_ids)
        self.assertTrue(result.used_fallback)
        self.assertEqual(result.personalized_count, 0)
        self.assertGreaterEqual(result.fallback_count, 1)


class PackageRecommendationTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='package-v1',
        )

    def _make_listing_result(
        self,
        *,
        listing_ids,
        results_detail,
        strategy='behavior_enhanced',
        behavior_event_count=12,
        behavior_listing_count=6,
        recommendation_event_count=4,
        interaction_event_count=8,
        behavior_signal_source='mixed',
    ):
        return RecommendationResult(
            listing_ids=listing_ids,
            strategy=strategy,
            model_version_label=self.model_version.version_label,
            model_version=self.model_version,
            results_detail=results_detail,
            behavior_event_count=behavior_event_count,
            behavior_listing_count=behavior_listing_count,
            recommendation_event_count=recommendation_event_count,
            interaction_event_count=interaction_event_count,
            behavior_signal_source=behavior_signal_source,
        )

    def test_get_for_you_packages_ranks_packages_by_aggregate_child_score(self):
        traveller = self.create_traveller(
            preferences={
                'preferred_activities': ['hiking'],
                'preferred_max_budget': '10000.00',
            },
        )
        host = self.create_host()
        listing_a = self.create_listing(host=host, is_bookable=True)
        listing_b = self.create_listing(host=host, is_bookable=True)
        listing_c = self.create_listing(host=host, is_bookable=True)
        listing_d = self.create_listing(host=host, is_bookable=True)
        other_listing = self.create_listing(host=host, is_bookable=True)

        stronger_package = self.create_package(
            host=host,
            listings=[listing_a, listing_b],
            total_price='8500.00',
            booking_count=8,
            rating_average='4.60',
        )
        weaker_package = self.create_package(
            host=host,
            listings=[listing_c, other_listing],
            total_price='7000.00',
            booking_count=20,
            rating_average='4.90',
        )
        self.create_package(
            host=host,
            listings=[listing_a, listing_d],
            total_price='20000.00',
            booking_count=30,
            rating_average='4.95',
        )
        self.create_package(
            host=host,
            listings=[listing_a, listing_d],
            create_slot=False,
            total_price='6000.00',
        )

        listing_result = self._make_listing_result(
            listing_ids=[listing_a.pk, listing_b.pk, listing_c.pk],
            results_detail=[
                {'listing_id': listing_a.pk, 'distance': 0.05},
                {'listing_id': listing_b.pk, 'distance': 0.10},
                {'listing_id': listing_c.pk, 'distance': 0.20},
            ],
        )

        with mock.patch(
            'recommendations.services.recommendation_service.get_for_you_listings',
            return_value=listing_result,
        ):
            result = get_for_you_packages(traveller, limit=3)

        self.assertEqual(
            result.package_ids,
            [stronger_package.pk, weaker_package.pk],
        )
        self.assertEqual(result.strategy, 'behavior_enhanced')
        self.assertFalse(result.used_fallback)
        self.assertEqual(result.personalized_count, 2)
        self.assertEqual(result.fallback_count, 0)
        self.assertEqual(result.behavior_signal_source, 'mixed')
        self.assertEqual(result.interaction_event_count, 8)

    def test_get_for_you_packages_falls_back_to_popular_packages_when_no_matches_exist(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        host = self.create_host()
        listing_a = self.create_listing(host=host, is_bookable=True)
        listing_b = self.create_listing(host=host, is_bookable=True)
        unmatched_listing = self.create_listing(is_bookable=True)

        popular_package = self.create_package(
            host=host,
            listings=[listing_a, listing_b],
            booking_count=50,
            rating_average='4.90',
        )
        second_package = self.create_package(
            host=host,
            listings=[listing_b, self.create_listing(host=host, is_bookable=True)],
            booking_count=20,
            rating_average='4.50',
        )

        listing_result = self._make_listing_result(
            listing_ids=[unmatched_listing.pk],
            results_detail=[{'listing_id': unmatched_listing.pk, 'distance': 0.05}],
            strategy='preference_based',
            behavior_event_count=5,
            behavior_listing_count=3,
            recommendation_event_count=1,
            interaction_event_count=4,
            behavior_signal_source='browsing_only',
        )

        with mock.patch(
            'recommendations.services.recommendation_service.get_for_you_listings',
            return_value=listing_result,
        ):
            result = get_for_you_packages(traveller, limit=2)

        self.assertEqual(result.package_ids, [popular_package.pk, second_package.pk])
        self.assertEqual(result.strategy, 'popular_fallback')
        self.assertTrue(result.used_fallback)
        self.assertEqual(result.personalized_count, 0)
        self.assertEqual(result.fallback_count, 2)
        self.assertEqual(result.behavior_signal_source, 'browsing_only')
        self.assertEqual(result.interaction_event_count, 4)


class CacheGenerationTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def test_traveller_detail_save_bumps_user_preference_generation(self):
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})

        first_generation = get_user_preference_generation(traveller.pk)

        detail = traveller.traveller_detail
        detail.preferred_trip_style = 'Solo'
        detail.save(update_fields=['preferred_trip_style'])

        second_generation = get_user_preference_generation(traveller.pk)

        self.assertEqual(first_generation, 1)
        self.assertEqual(second_generation, 2)


class TrackingAndViewTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory(HTTP_HOST='localhost')
        self.model_version = self.create_model_version(is_active=True, version_label='view-v1')

    def test_create_served_slate_persists_positions_and_distance(self):
        traveller = self.create_traveller()
        listing = self.create_listing(is_bookable=True)
        served = create_served_slate(
            user=traveller,
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            seed_listing_id=listing.pk,
            results=[
                {'listing_id': listing.pk, 'distance': 0.123},
            ],
        )

        self.assertEqual(served.result_count, 1)
        self.assertEqual(
            served.results_json,
            [{'listing_id': listing.pk, 'position': 1, 'distance': 0.123}],
        )

    def test_create_served_slate_persists_serving_metadata(self):
        traveller = self.create_traveller()
        listing = self.create_listing(is_bookable=True)

        served = create_served_slate(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            results=[
                {'listing_id': listing.pk, 'distance': 0.123},
            ],
            serving_metadata={
                'behavior_signal_source': 'mixed',
                'recommendation_event_count': 2,
                'interaction_event_count': 3,
                'behavior_event_count': 5,
                'behavior_listing_count': 4,
            },
        )

        self.assertEqual(
            served.serving_metadata,
            {
                'behavior_signal_source': 'mixed',
                'recommendation_event_count': 2,
                'interaction_event_count': 3,
                'behavior_event_count': 5,
                'behavior_listing_count': 4,
            },
        )

    def test_similar_view_returns_meta_results_and_creates_served_slate(self):
        source = self.create_listing(is_bookable=True)
        recommended = self.create_listing(is_bookable=True)

        result = RecommendationResult(
            listing_ids=[recommended.pk],
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            model_version=self.model_version,
            results_detail=[{'listing_id': recommended.pk, 'distance': 0.25}],
            personalized_count=1,
            seed_listing_id=source.pk,
        )

        with mock.patch('recommendations.views.get_similar_listings', return_value=result):
            request = self.factory.get(
                f'/api/recommendations/listings/{source.pk}/similar/?limit=1&session_id=session-1'
            )
            response = SimilarListingsView.as_view()(request, pk=source.pk)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], recommended.pk)
        self.assertEqual(response.data['results'][0]['position'], 1)
        self.assertEqual(response.data['meta']['strategy'], 'content_based')
        self.assertIsNotNone(response.data['meta']['request_id'])
        self.assertFalse(response.data['meta']['used_fallback'])
        self.assertEqual(response.data['meta']['personalized_count'], 1)
        self.assertEqual(response.data['meta']['fallback_count'], 0)
        self.assertEqual(ServedRecommendationSet.objects.count(), 1)

    def test_for_you_view_returns_meta_results_and_creates_served_slate(self):
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})
        recommended = self.create_listing(is_bookable=True)

        result = RecommendationResult(
            listing_ids=[recommended.pk],
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            model_version=self.model_version,
            results_detail=[{'listing_id': recommended.pk, 'distance': 0.18}],
            used_fallback=True,
            personalized_count=0,
            fallback_count=1,
            behavior_event_count=8,
            behavior_listing_count=4,
            recommendation_event_count=3,
            interaction_event_count=5,
            behavior_signal_source='mixed',
        )

        with mock.patch('recommendations.views.get_for_you_listings', return_value=result):
            request = self.factory.get('/api/recommendations/for-you/?limit=1')
            force_authenticate(request, user=traveller)
            response = ForYouListingsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], recommended.pk)
        self.assertEqual(response.data['results'][0]['position'], 1)
        self.assertEqual(response.data['meta']['strategy'], 'preference_based')
        self.assertTrue(response.data['meta']['used_fallback'])
        self.assertEqual(response.data['meta']['personalized_count'], 0)
        self.assertEqual(response.data['meta']['fallback_count'], 1)
        self.assertEqual(response.data['meta']['behavior_event_count'], 8)
        self.assertEqual(response.data['meta']['behavior_listing_count'], 4)
        self.assertEqual(response.data['meta']['recommendation_event_count'], 3)
        self.assertEqual(response.data['meta']['interaction_event_count'], 5)
        self.assertEqual(response.data['meta']['behavior_signal_source'], 'mixed')
        self.assertEqual(ServedRecommendationSet.objects.count(), 1)
        served = ServedRecommendationSet.objects.get()
        self.assertEqual(
            served.serving_metadata,
            {
                'behavior_signal_source': 'mixed',
                'recommendation_event_count': 3,
                'interaction_event_count': 5,
                'behavior_event_count': 8,
                'behavior_listing_count': 4,
            },
        )

    def test_for_you_packages_view_returns_packages_and_behavior_meta(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        package = self.create_package()

        result = PackageRecommendationResult(
            package_ids=[package.pk],
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            model_version=self.model_version,
            results_detail=[{'package_id': package.pk, 'score': 1.42}],
            personalized_count=1,
            behavior_event_count=9,
            behavior_listing_count=5,
            recommendation_event_count=4,
            interaction_event_count=5,
            behavior_signal_source='mixed',
        )

        with mock.patch(
            'recommendations.views.get_for_you_packages',
            return_value=result,
        ):
            request = self.factory.get('/api/recommendations/packages/for-you/?limit=1')
            force_authenticate(request, user=traveller)
            response = ForYouPackagesView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], package.pk)
        self.assertEqual(response.data['results'][0]['position'], 1)
        self.assertIsNone(response.data['meta']['request_id'])
        self.assertEqual(response.data['meta']['strategy'], 'behavior_enhanced')
        self.assertFalse(response.data['meta']['used_fallback'])
        self.assertEqual(response.data['meta']['personalized_count'], 1)
        self.assertEqual(response.data['meta']['fallback_count'], 0)
        self.assertEqual(response.data['meta']['behavior_event_count'], 9)
        self.assertEqual(response.data['meta']['behavior_listing_count'], 5)
        self.assertEqual(response.data['meta']['recommendation_event_count'], 4)
        self.assertEqual(response.data['meta']['interaction_event_count'], 5)
        self.assertEqual(response.data['meta']['behavior_signal_source'], 'mixed')
        self.assertEqual(ServedRecommendationSet.objects.count(), 0)

    def test_event_ingestion_view_accepts_valid_events_and_reports_partial_failure(self):
        listing = self.create_listing(is_bookable=True)
        served = ServedRecommendationSet.objects.create(
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[{'listing_id': listing.pk, 'position': 1, 'distance': 0.1}],
        )

        request = self.factory.post(
            '/api/recommendations/events/',
            {
                'events': [
                    {
                        'request_id': str(served.request_id),
                        'listing_id': listing.pk,
                        'event_type': 'click',
                        'surface': 'similar',
                        'strategy': 'content_based',
                        'model_version': self.model_version.version_label,
                        'position': 1,
                        'session_id': 'session-1',
                        'metadata': {'source': 'test'},
                    },
                    {
                        'request_id': str(served.request_id),
                        'listing_id': listing.pk,
                        'event_type': 'click',
                        'surface': 'similar',
                        'strategy': 'content_based',
                        'model_version': self.model_version.version_label,
                        'position': 2,
                        'metadata': {'source': 'test'},
                    },
                ]
            },
            format='json',
        )
        response = EventIngestionView.as_view()(request)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['accepted'], 1)
        self.assertEqual(response.data['rejected'], 1)
        self.assertEqual(RecommendationEvent.objects.count(), 1)


class ReindexAndSignalTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(is_active=True, version_label='reindex-v1')

    def test_reindex_task_upserts_snapshot_for_visible_listing(self):
        listing = self.create_listing(is_bookable=True)
        vector = np.ones(settings.RECOMMENDATION_VECTOR_DIMENSION, dtype=np.float32)

        with mock.patch('recommendations.tasks.preprocess_listing', return_value={'dummy': 'data'}), \
             mock.patch('recommendations.tasks.vectorize_listing', return_value=vector), \
             mock.patch('recommendations.tasks.invalidate_listing_cache') as invalidate_mock:
            reindex_listing_task.run(listing.pk)

        snapshot = ListingFeatureSnapshot.objects.get(
            listing=listing,
            model_version=self.model_version,
            vector_type='content',
        )
        self.assertEqual(len(snapshot.embedding), settings.RECOMMENDATION_VECTOR_DIMENSION)
        invalidate_mock.assert_called_once_with(listing.pk)

    def test_reindex_task_deletes_snapshot_for_non_visible_listing(self):
        listing = self.create_listing(is_bookable=True)
        ListingFeatureSnapshot.objects.create(
            listing=listing,
            model_version=self.model_version,
            vector_type='content',
            embedding=[0.1] * settings.RECOMMENDATION_VECTOR_DIMENSION,
            metadata={},
        )
        Listing.objects.filter(pk=listing.pk).update(is_bookable=False)

        with mock.patch('recommendations.tasks.invalidate_listing_cache') as invalidate_mock:
            reindex_listing_task.run(listing.pk)

        self.assertFalse(
            ListingFeatureSnapshot.objects.filter(
                listing=listing,
                model_version=self.model_version,
                vector_type='content',
            ).exists()
        )
        invalidate_mock.assert_called_once_with(listing.pk)

    def test_signal_dispatches_reindex_only_for_relevant_field_changes(self):
        listing = self.create_listing(is_bookable=False)

        with mock.patch('listings.signals._dispatch_reco_reindex') as dispatch_mock:
            listing.location = 'New Meeting Point'
            listing.save(update_fields=['location'])
            dispatch_mock.assert_not_called()

            listing.title = 'Updated Recommendation Title'
            listing.save(update_fields=['title'])
            dispatch_mock.assert_called_once_with(listing.pk)


class MonitoringServiceTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(is_active=True, version_label='monitor-v1')

    def test_quality_summary_returns_core_metrics(self):
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})
        listing = self.create_listing(is_bookable=True, category=Category.CULTURAL, activity_type=ActivityType.CITY_TOUR)
        served_a = create_served_slate(
            user=traveller,
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            seed_listing_id=listing.pk,
            results=[{'listing_id': listing.pk, 'distance': 0.2}],
        )
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='popular_fallback',
            model_version=self.model_version,
            result_count=0,
            results_json=[],
        )
        RecommendationEvent.objects.create(
            served_set=served_a,
            request_id=served_a.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='similar',
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=served_a,
            request_id=served_a.request_id,
            user=traveller,
            listing=listing,
            event_type='click',
            surface='similar',
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        summary = get_quality_summary()

        self.assertEqual(summary['active_model_version'], self.model_version.version_label)
        self.assertEqual(summary['served_sets']['total'], 2)
        self.assertEqual(summary['served_sets']['fallback_count'], 1)
        self.assertEqual(summary['served_sets']['empty_count'], 1)
        self.assertEqual(summary['events']['by_type']['click'], 1)
        similar_ctr = next(
            row for row in summary['events']['ctr_by_surface']
            if row['surface'] == 'similar'
        )
        self.assertEqual(similar_ctr['ctr'], 1.0)

    def test_vocab_drift_summary_surfaces_unknown_listing_and_traveller_values(self):
        self.create_listing(
            is_bookable=True,
            tags=['asd'],
            ideal_for=['solo'],
            languages_offered=['english'],
            best_seasons=['autumn'],
        )
        self.create_traveller(
            preferences={
                'preferred_activities': ['asda'],
                'preferred_trip_style': 'Couple',
            }
        )

        summary = get_vocab_drift_summary(limit_per_field=5)
        fields = {field['source']: field for field in summary['fields']}

        self.assertGreaterEqual(fields['listing.tags']['unknown_count'], 1)
        self.assertGreaterEqual(fields['listing.ideal_for']['unknown_count'], 1)
        self.assertGreaterEqual(fields['traveller.preferences.tags']['unknown_count'], 1)
        self.assertEqual(fields['traveller.preferences.ideal_for']['unknown_count'], 0)


class MonitoringCommandTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(is_active=True, version_label='report-v1')

    def test_quality_report_command_outputs_json_summary(self):
        traveller = self.create_traveller(preferences={'preferred_activities': ['hiking']})
        listing = self.create_listing(is_bookable=True)
        served = create_served_slate(
            user=traveller,
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            seed_listing_id=listing.pk,
            results=[{'listing_id': listing.pk, 'distance': 0.2}],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='similar',
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        output = StringIO()
        call_command(
            'reco_quality_report',
            '--json',
            '--include-vocab-drift',
            stdout=output,
        )
        payload = json.loads(output.getvalue())

        self.assertEqual(
            payload['active_model_version'],
            self.model_version.version_label,
        )
        self.assertEqual(payload['served_sets']['total'], 1)
        self.assertIn('vocab_drift', payload)


class BehaviorProfileServiceTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='behavior-v1',
        )
        self.host = self.create_host()

    def _create_listing_with_snapshot(self, embedding=None, **listing_overrides):
        listing = self.create_listing(
            host=self.host,
            is_bookable=True,
            **listing_overrides,
        )
        if embedding is None:
            rng = np.random.RandomState(listing.pk)
            embedding = rng.rand(settings.RECOMMENDATION_VECTOR_DIMENSION).astype(
                np.float32
            )
            embedding = embedding / np.linalg.norm(embedding)
        ListingFeatureSnapshot.objects.create(
            listing=listing,
            model_version=self.model_version,
            vector_type='content',
            embedding=embedding.tolist(),
            metadata={},
        )
        return listing

    def _create_event(self, user, listing, *, event_type='click', created_at=None):
        served = ServedRecommendationSet.objects.create(
            user=user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        event = RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=user,
            listing=listing,
            event_type=event_type,
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        if created_at is not None:
            RecommendationEvent.objects.filter(pk=event.pk).update(
                created_at=created_at
            )
            event.refresh_from_db()
        return event

    def test_no_events_returns_sparse_profile(self):
        traveller = self.create_traveller()

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertIsNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 0)
        self.assertEqual(profile.distinct_listing_count, 0)
        self.assertEqual(profile.top_listing_ids, [])

    def test_only_impression_events_returns_sparse(self):
        traveller = self.create_traveller()
        listing = self._create_listing_with_snapshot()
        for _ in range(5):
            self._create_event(traveller, listing, event_type='impression')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertIsNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 0)

    def test_click_events_scored_correctly(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_event(traveller, listing, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.distinct_listing_count, 3)

    def test_detail_open_weighted_higher_than_click(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_a = np.zeros(dim, dtype=np.float32)
        emb_a[0] = 1.0
        listing_a = self._create_listing_with_snapshot(embedding=emb_a)

        emb_b = np.zeros(dim, dtype=np.float32)
        emb_b[1] = 1.0
        listing_b = self._create_listing_with_snapshot(embedding=emb_b)

        listing_c = self._create_listing_with_snapshot()
        self._create_event(traveller, listing_c, event_type='click')
        self._create_event(traveller, listing_a, event_type='detail_open')
        self._create_event(traveller, listing_b, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_recent_window_weighted_higher_than_long_term(self):
        traveller = self.create_traveller()
        now = timezone.now()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_a = np.zeros(dim, dtype=np.float32)
        emb_a[0] = 1.0
        listing_a = self._create_listing_with_snapshot(embedding=emb_a)

        emb_b = np.zeros(dim, dtype=np.float32)
        emb_b[1] = 1.0
        listing_b = self._create_listing_with_snapshot(embedding=emb_b)

        listing_c = self._create_listing_with_snapshot()
        self._create_event(traveller, listing_c, event_type='click')
        self._create_event(
            traveller,
            listing_a,
            event_type='click',
            created_at=now - timedelta(days=1),
        )
        self._create_event(
            traveller,
            listing_b,
            event_type='click',
            created_at=now - timedelta(days=30),
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_events_older_than_90_days_ignored(self):
        traveller = self.create_traveller()
        now = timezone.now()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_event(
                traveller,
                listing,
                event_type='click',
                created_at=now - timedelta(days=91),
            )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertEqual(profile.event_count, 0)

    def test_duplicate_events_on_same_listing_accumulate(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_a = np.zeros(dim, dtype=np.float32)
        emb_a[0] = 1.0
        listing_a = self._create_listing_with_snapshot(embedding=emb_a)

        emb_b = np.zeros(dim, dtype=np.float32)
        emb_b[1] = 1.0
        listing_b = self._create_listing_with_snapshot(embedding=emb_b)

        listing_c = self._create_listing_with_snapshot()
        self._create_event(traveller, listing_c, event_type='click')
        for _ in range(3):
            self._create_event(traveller, listing_a, event_type='click')
        self._create_event(traveller, listing_b, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertEqual(profile.event_count, 5)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_missing_snapshot_rows_skipped(self):
        traveller = self.create_traveller()
        listing_a = self._create_listing_with_snapshot()
        listing_b = self._create_listing_with_snapshot()
        listing_no_snapshot = self.create_listing(host=self.host, is_bookable=True)

        self._create_event(traveller, listing_a, event_type='click')
        self._create_event(traveller, listing_b, event_type='click')
        self._create_event(traveller, listing_no_snapshot, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.distinct_listing_count, 2)
        self.assertNotIn(listing_no_snapshot.pk, profile.top_listing_ids)

    @override_settings(RECOMMENDATION_BEHAVIOR_TOP_K=3)
    def test_top_k_cap_respected(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(5)]
        for i, listing in enumerate(listings):
            for _ in range(5 - i):
                self._create_event(traveller, listing, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertEqual(len(profile.top_listing_ids), 3)
        self.assertEqual(
            profile.top_listing_ids,
            [listings[0].pk, listings[1].pk, listings[2].pk],
        )

    def test_behavior_vector_is_l2_normalized(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_event(traveller, listing, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertAlmostEqual(
            np.linalg.norm(profile.behavior_vector),
            1.0,
            places=5,
        )

    def test_sparse_threshold_two_listings_is_sparse(self):
        traveller = self.create_traveller()
        listing_a = self._create_listing_with_snapshot()
        listing_b = self._create_listing_with_snapshot()

        self._create_event(traveller, listing_a, event_type='click')
        self._create_event(traveller, listing_b, event_type='detail_open')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertIsNone(profile.behavior_vector)
        self.assertEqual(profile.distinct_listing_count, 2)

    def test_sparse_threshold_exactly_three_listings_is_not_sparse(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_event(traveller, listing, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.distinct_listing_count, 3)

    def test_top_listing_ids_ordered_by_descending_score(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for _ in range(5):
            self._create_event(traveller, listings[0], event_type='click')
        for _ in range(3):
            self._create_event(traveller, listings[1], event_type='click')
        self._create_event(traveller, listings[2], event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertEqual(
            profile.top_listing_ids,
            [listings[0].pk, listings[1].pk, listings[2].pk],
        )


class UnifiedBehaviorProfileServiceTests(
    RecommendationTestDataMixin,
    TestCase,
):
    """
    Tests for the unified behavior profile service that reads from both
    RecommendationEvent and ListingInteractionEvent.
    """

    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='unified-v1',
        )
        self.host = self.create_host()

    def _create_listing_with_snapshot(self, embedding=None, **listing_overrides):
        listing = self.create_listing(
            host=self.host,
            is_bookable=True,
            **listing_overrides,
        )
        if embedding is None:
            rng = np.random.RandomState(listing.pk)
            embedding = rng.rand(settings.RECOMMENDATION_VECTOR_DIMENSION).astype(
                np.float32
            )
            embedding = embedding / np.linalg.norm(embedding)
        ListingFeatureSnapshot.objects.create(
            listing=listing,
            model_version=self.model_version,
            vector_type='content',
            embedding=embedding.tolist(),
            metadata={},
        )
        return listing

    def _create_reco_event(self, user, listing, *, event_type='click', created_at=None):
        served = ServedRecommendationSet.objects.create(
            user=user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        event = RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=user,
            listing=listing,
            event_type=event_type,
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        if created_at is not None:
            RecommendationEvent.objects.filter(pk=event.pk).update(
                created_at=created_at,
            )
            event.refresh_from_db()
        return event

    def _create_interaction_event(
        self,
        user,
        listing,
        *,
        event_type='click',
        surface='catalog',
        created_at=None,
    ):
        event = ListingInteractionEvent.objects.create(
            user=user,
            listing=listing,
            event_type=event_type,
            surface=surface,
            metadata={},
        )
        if created_at is not None:
            ListingInteractionEvent.objects.filter(pk=event.pk).update(
                created_at=created_at,
            )
            event.refresh_from_db()
        return event

    def test_only_reco_events_still_produces_profile(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_reco_event(traveller, listing, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.recommendation_event_count, 3)
        self.assertEqual(profile.interaction_event_count, 0)

    def test_only_interaction_events_produces_profile(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_interaction_event(
                traveller, listing, event_type='click', surface='catalog',
            )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.recommendation_event_count, 0)
        self.assertEqual(profile.interaction_event_count, 3)

    def test_both_streams_contribute_to_profile(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]

        self._create_reco_event(traveller, listings[0], event_type='click')
        self._create_interaction_event(
            traveller, listings[1], event_type='click', surface='search_results',
        )
        self._create_interaction_event(
            traveller, listings[2], event_type='detail_open', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.recommendation_event_count, 1)
        self.assertEqual(profile.interaction_event_count, 2)
        self.assertEqual(profile.distinct_listing_count, 3)

    @override_settings(
        RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_FOR_YOU=1.0,
        RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_CATALOG=0.6,
    )
    def test_reco_origin_scores_higher_than_catalog(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_reco = np.zeros(dim, dtype=np.float32)
        emb_reco[0] = 1.0
        listing_reco = self._create_listing_with_snapshot(embedding=emb_reco)

        emb_catalog = np.zeros(dim, dtype=np.float32)
        emb_catalog[1] = 1.0
        listing_catalog = self._create_listing_with_snapshot(embedding=emb_catalog)

        listing_third = self._create_listing_with_snapshot()
        self._create_reco_event(traveller, listing_third, event_type='click')

        self._create_reco_event(traveller, listing_reco, event_type='click')
        self._create_interaction_event(
            traveller, listing_catalog, event_type='click', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    @override_settings(
        RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_SEARCH=0.8,
        RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_CATALOG=0.6,
    )
    def test_search_click_scores_higher_than_catalog_click(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_search = np.zeros(dim, dtype=np.float32)
        emb_search[0] = 1.0
        listing_search = self._create_listing_with_snapshot(embedding=emb_search)

        emb_catalog = np.zeros(dim, dtype=np.float32)
        emb_catalog[1] = 1.0
        listing_catalog = self._create_listing_with_snapshot(embedding=emb_catalog)

        listing_third = self._create_listing_with_snapshot()
        self._create_interaction_event(
            traveller, listing_third, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_search, event_type='click', surface='search_results',
        )
        self._create_interaction_event(
            traveller, listing_catalog, event_type='click', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_same_listing_from_both_streams_accumulates(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_target = np.zeros(dim, dtype=np.float32)
        emb_target[0] = 1.0
        listing_target = self._create_listing_with_snapshot(embedding=emb_target)

        emb_other = np.zeros(dim, dtype=np.float32)
        emb_other[1] = 1.0
        listing_other = self._create_listing_with_snapshot(embedding=emb_other)

        listing_third = self._create_listing_with_snapshot()
        self._create_reco_event(traveller, listing_third, event_type='click')

        self._create_reco_event(traveller, listing_target, event_type='click')
        self._create_interaction_event(
            traveller, listing_target, event_type='click', surface='catalog',
        )
        self._create_reco_event(traveller, listing_other, event_type='click')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_detail_open_outweighs_click_for_interaction_events(self):
        traveller = self.create_traveller()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_detail = np.zeros(dim, dtype=np.float32)
        emb_detail[0] = 1.0
        listing_detail = self._create_listing_with_snapshot(embedding=emb_detail)

        emb_click = np.zeros(dim, dtype=np.float32)
        emb_click[1] = 1.0
        listing_click = self._create_listing_with_snapshot(embedding=emb_click)

        listing_third = self._create_listing_with_snapshot()
        self._create_interaction_event(
            traveller, listing_third, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_detail, event_type='detail_open', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_click, event_type='click', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_impression_events_excluded(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_reco_event(traveller, listing, event_type='impression')

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertEqual(profile.event_count, 0)

    def test_missing_snapshot_skipped_for_interaction_events(self):
        traveller = self.create_traveller()
        listing_a = self._create_listing_with_snapshot()
        listing_b = self._create_listing_with_snapshot()
        listing_no_snap = self.create_listing(host=self.host, is_bookable=True)

        self._create_interaction_event(
            traveller, listing_a, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_b, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_no_snap, event_type='click', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertEqual(profile.event_count, 3)
        self.assertEqual(profile.distinct_listing_count, 2)
        self.assertNotIn(listing_no_snap.pk, profile.top_listing_ids)

    def test_sparse_with_interaction_events_below_threshold(self):
        traveller = self.create_traveller()
        listing_a = self._create_listing_with_snapshot()
        listing_b = self._create_listing_with_snapshot()

        self._create_interaction_event(
            traveller, listing_a, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_b, event_type='click', surface='search_results',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertIsNone(profile.behavior_vector)
        self.assertEqual(profile.distinct_listing_count, 2)

    def test_cross_stream_listings_meet_threshold(self):
        traveller = self.create_traveller()
        listing_reco = self._create_listing_with_snapshot()
        listing_browse_1 = self._create_listing_with_snapshot()
        listing_browse_2 = self._create_listing_with_snapshot()

        self._create_reco_event(traveller, listing_reco, event_type='click')
        self._create_interaction_event(
            traveller, listing_browse_1, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listing_browse_2, event_type='click', surface='search_results',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertIsNotNone(profile.behavior_vector)
        self.assertEqual(profile.distinct_listing_count, 3)

    def test_unified_vector_is_l2_normalized(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]

        self._create_reco_event(traveller, listings[0], event_type='click')
        self._create_interaction_event(
            traveller, listings[1], event_type='click', surface='search_results',
        )
        self._create_interaction_event(
            traveller, listings[2], event_type='detail_open', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertAlmostEqual(
            np.linalg.norm(profile.behavior_vector),
            1.0,
            places=5,
        )

    def test_no_events_returns_sparse(self):
        traveller = self.create_traveller()

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertIsNone(profile.behavior_vector)
        self.assertEqual(profile.event_count, 0)
        self.assertEqual(profile.recommendation_event_count, 0)
        self.assertEqual(profile.interaction_event_count, 0)

    def test_recent_interaction_events_weighted_higher(self):
        traveller = self.create_traveller()
        now = timezone.now()
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION

        emb_recent = np.zeros(dim, dtype=np.float32)
        emb_recent[0] = 1.0
        listing_recent = self._create_listing_with_snapshot(embedding=emb_recent)

        emb_old = np.zeros(dim, dtype=np.float32)
        emb_old[1] = 1.0
        listing_old = self._create_listing_with_snapshot(embedding=emb_old)

        listing_third = self._create_listing_with_snapshot()
        self._create_interaction_event(
            traveller, listing_third, event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller,
            listing_recent,
            event_type='click',
            surface='catalog',
            created_at=now - timedelta(days=1),
        )
        self._create_interaction_event(
            traveller,
            listing_old,
            event_type='click',
            surface='catalog',
            created_at=now - timedelta(days=30),
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertGreater(profile.behavior_vector[0], profile.behavior_vector[1])

    def test_old_interaction_events_excluded(self):
        traveller = self.create_traveller()
        now = timezone.now()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]
        for listing in listings:
            self._create_interaction_event(
                traveller,
                listing,
                event_type='click',
                surface='catalog',
                created_at=now - timedelta(days=91),
            )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertTrue(profile.is_sparse)
        self.assertEqual(profile.event_count, 0)

    @override_settings(RECOMMENDATION_BEHAVIOR_TOP_K=3)
    def test_top_k_respects_accumulated_scores(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(4)]

        for _ in range(3):
            self._create_reco_event(traveller, listings[0], event_type='click')
        for _ in range(2):
            self._create_interaction_event(
                traveller,
                listings[1],
                event_type='detail_open',
                surface='search_results',
            )
        self._create_reco_event(traveller, listings[2], event_type='click')
        self._create_interaction_event(
            traveller, listings[3], event_type='click', surface='catalog',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertEqual(len(profile.top_listing_ids), 3)
        self.assertNotIn(listings[3].pk, profile.top_listing_ids)
        self.assertEqual(profile.top_listing_ids[0], listings[0].pk)

    def test_all_browsing_surfaces_contribute(self):
        traveller = self.create_traveller()
        listings = [self._create_listing_with_snapshot() for _ in range(3)]

        self._create_interaction_event(
            traveller, listings[0], event_type='click', surface='catalog',
        )
        self._create_interaction_event(
            traveller, listings[1], event_type='click', surface='search_results',
        )
        self._create_interaction_event(
            traveller, listings[2], event_type='detail_open', surface='listing_detail',
        )

        profile = build_behavior_profile(
            user_id=traveller.pk,
            model_version=self.model_version,
        )

        self.assertFalse(profile.is_sparse)
        self.assertEqual(profile.interaction_event_count, 3)
        self.assertEqual(profile.distinct_listing_count, 3)


class BehaviorQueryBuilderTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION
        self.pref_vector = np.zeros(dim, dtype=np.float32)
        self.pref_vector[0] = 1.0
        self.behavior_vector = np.zeros(dim, dtype=np.float32)
        self.behavior_vector[1] = 1.0
        self.mock_preprocessed = {'dummy': 'query'}

        self.preprocess_patch = mock.patch(
            'recommendations.services.behavior_query_builder_service.preprocess_traveller_query',
            return_value=self.mock_preprocessed,
        )
        self.vectorize_patch = mock.patch(
            'recommendations.services.behavior_query_builder_service.vectorize_query',
            return_value=self.pref_vector,
        )
        self.preprocess_patch.start()
        self.vectorize_patch.start()
        self.addCleanup(self.preprocess_patch.stop)
        self.addCleanup(self.vectorize_patch.stop)

    def _make_sparse_profile(self, event_count=0, distinct_listing_count=0):
        return BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=event_count,
            distinct_listing_count=distinct_listing_count,
            top_listing_ids=[],
        )

    def _make_active_profile(self, event_count=5, distinct_listing_count=3):
        return BehaviorProfile(
            behavior_vector=self.behavior_vector,
            is_sparse=False,
            event_count=event_count,
            distinct_listing_count=distinct_listing_count,
            top_listing_ids=[1, 2, 3],
        )

    def test_sparse_profile_returns_preference_only(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_sparse_profile(),
        )

        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.alpha_applied, 0.0)
        np.testing.assert_array_equal(result.query_vector, self.pref_vector)
        np.testing.assert_array_equal(result.preference_vector, self.pref_vector)

    def test_none_behavior_vector_returns_preference_only(self):
        profile = BehaviorProfile(
            behavior_vector=None,
            is_sparse=False,
            event_count=5,
            distinct_listing_count=3,
            top_listing_ids=[1, 2, 3],
        )

        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )

        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        np.testing.assert_array_equal(result.query_vector, self.pref_vector)

    def test_non_sparse_profile_returns_blended_vector(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        self.assertEqual(result.strategy, 'behavior_enhanced')
        self.assertTrue(result.behavior_used)
        self.assertEqual(
            result.alpha_applied,
            settings.RECOMMENDATION_BEHAVIOR_ALPHA,
        )
        self.assertFalse(np.array_equal(result.query_vector, self.pref_vector))

    def test_alpha_applied_correctly(self):
        alpha = settings.RECOMMENDATION_BEHAVIOR_ALPHA
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        expected_ratio = (1.0 - alpha) / alpha
        actual_ratio = result.query_vector[0] / result.query_vector[1]
        self.assertAlmostEqual(actual_ratio, expected_ratio, places=4)

    def test_blended_vector_is_l2_normalized(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        self.assertAlmostEqual(np.linalg.norm(result.query_vector), 1.0, places=5)

    def test_preference_vector_preserved_in_output(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        np.testing.assert_array_equal(result.preference_vector, self.pref_vector)
        self.assertFalse(
            np.array_equal(result.preference_vector, result.query_vector)
        )

    def test_preprocessed_payload_included_in_output(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_sparse_profile(),
        )

        self.assertEqual(result.preprocessed_payload, self.mock_preprocessed)

    def test_behavior_used_false_when_sparse(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_sparse_profile(
                event_count=2,
                distinct_listing_count=2,
            ),
        )

        self.assertFalse(result.behavior_used)
        self.assertEqual(result.alpha_applied, 0.0)

    def test_behavior_counts_propagated_from_profile(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(
                event_count=42,
                distinct_listing_count=7,
            ),
        )

        self.assertEqual(result.behavior_event_count, 42)
        self.assertEqual(result.behavior_listing_count, 7)

    def test_output_vector_dimension_matches_settings(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        self.assertEqual(
            result.query_vector.shape,
            (settings.RECOMMENDATION_VECTOR_DIMENSION,),
        )

    def test_preference_dominates_blend(self):
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=self._make_active_profile(),
        )

        preference_similarity = float(np.dot(result.query_vector, self.pref_vector))
        behavior_similarity = float(np.dot(result.query_vector, self.behavior_vector))
        self.assertGreater(preference_similarity, behavior_similarity)


class BehaviorQueryBuilderSourceTests(
    RecommendationTestDataMixin,
    TestCase,
):
    """
    Tests for the extended BehaviorQueryResult contract introduced in
    broader browsing Part 4 — signal source classification and per-stream
    event counts.
    """

    def setUp(self):
        super().setUp()
        self.traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        dim = settings.RECOMMENDATION_VECTOR_DIMENSION
        self.pref_vector = np.zeros(dim, dtype=np.float32)
        self.pref_vector[0] = 1.0
        self.behavior_vector = np.zeros(dim, dtype=np.float32)
        self.behavior_vector[1] = 1.0
        self.mock_preprocessed = {'dummy': 'query'}

        self.preprocess_patch = mock.patch(
            'recommendations.services.behavior_query_builder_service.preprocess_traveller_query',
            return_value=self.mock_preprocessed,
        )
        self.vectorize_patch = mock.patch(
            'recommendations.services.behavior_query_builder_service.vectorize_query',
            return_value=self.pref_vector,
        )
        self.preprocess_patch.start()
        self.vectorize_patch.start()
        self.addCleanup(self.preprocess_patch.stop)
        self.addCleanup(self.vectorize_patch.stop)

    def _make_profile(
        self,
        *,
        is_sparse=False,
        has_vector=True,
        event_count=10,
        distinct_listing_count=5,
        recommendation_event_count=0,
        interaction_event_count=0,
    ):
        return BehaviorProfile(
            behavior_vector=self.behavior_vector if has_vector else None,
            is_sparse=is_sparse,
            event_count=event_count,
            distinct_listing_count=distinct_listing_count,
            top_listing_ids=[1, 2, 3] if has_vector else [],
            recommendation_event_count=recommendation_event_count,
            interaction_event_count=interaction_event_count,
        )

    # ── Signal source classification ─────────────────────────────────

    def test_signal_source_none_when_no_events(self):
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=0,
            distinct_listing_count=0,
            recommendation_event_count=0,
            interaction_event_count=0,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.behavior_signal_source, 'none')

    def test_signal_source_recommendation_only(self):
        profile = self._make_profile(
            recommendation_event_count=8,
            interaction_event_count=0,
            event_count=8,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.behavior_signal_source, 'recommendation_only')

    def test_signal_source_browsing_only(self):
        profile = self._make_profile(
            recommendation_event_count=0,
            interaction_event_count=6,
            event_count=6,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.behavior_signal_source, 'browsing_only')

    def test_signal_source_mixed(self):
        profile = self._make_profile(
            recommendation_event_count=5,
            interaction_event_count=3,
            event_count=8,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.behavior_signal_source, 'mixed')

    # ── Per-stream counts propagated ─────────────────────────────────

    def test_recommendation_event_count_propagated(self):
        profile = self._make_profile(
            recommendation_event_count=12,
            interaction_event_count=0,
            event_count=12,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.recommendation_event_count, 12)
        self.assertEqual(result.interaction_event_count, 0)

    def test_interaction_event_count_propagated(self):
        profile = self._make_profile(
            recommendation_event_count=0,
            interaction_event_count=7,
            event_count=7,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.recommendation_event_count, 0)
        self.assertEqual(result.interaction_event_count, 7)

    def test_mixed_counts_propagated(self):
        profile = self._make_profile(
            recommendation_event_count=4,
            interaction_event_count=9,
            event_count=13,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.recommendation_event_count, 4)
        self.assertEqual(result.interaction_event_count, 9)
        self.assertEqual(result.behavior_event_count, 13)

    # ── Sparse profile with events still classifies source ───────────

    def test_sparse_profile_with_reco_events_classifies_source(self):
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=2,
            distinct_listing_count=1,
            recommendation_event_count=2,
            interaction_event_count=0,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.behavior_signal_source, 'recommendation_only')
        self.assertEqual(result.recommendation_event_count, 2)

    def test_sparse_profile_with_browsing_events_classifies_source(self):
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=2,
            distinct_listing_count=1,
            recommendation_event_count=0,
            interaction_event_count=2,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.behavior_signal_source, 'browsing_only')

    def test_sparse_profile_with_mixed_events_classifies_source(self):
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=4,
            distinct_listing_count=2,
            recommendation_event_count=1,
            interaction_event_count=3,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.behavior_signal_source, 'mixed')

    # ── behavior_used flag unchanged ─────────────────────────────────

    def test_behavior_used_true_for_non_sparse_with_browsing(self):
        profile = self._make_profile(
            recommendation_event_count=0,
            interaction_event_count=6,
            event_count=6,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertTrue(result.behavior_used)
        self.assertEqual(result.strategy, 'behavior_enhanced')

    def test_behavior_used_true_for_non_sparse_with_mixed(self):
        profile = self._make_profile(
            recommendation_event_count=3,
            interaction_event_count=4,
            event_count=7,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertTrue(result.behavior_used)
        self.assertEqual(result.strategy, 'behavior_enhanced')

    # ── Backward compatibility ───────────────────────────────────────

    def test_existing_fields_unchanged_for_sparse(self):
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=0,
            distinct_listing_count=0,
            recommendation_event_count=0,
            interaction_event_count=0,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.alpha_applied, 0.0)
        self.assertEqual(result.behavior_event_count, 0)
        self.assertEqual(result.behavior_listing_count, 0)
        np.testing.assert_array_equal(result.query_vector, self.pref_vector)
        np.testing.assert_array_equal(result.preference_vector, self.pref_vector)
        self.assertEqual(result.preprocessed_payload, self.mock_preprocessed)

    def test_existing_fields_unchanged_for_active(self):
        profile = self._make_profile(
            recommendation_event_count=5,
            interaction_event_count=3,
            event_count=8,
            distinct_listing_count=5,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'behavior_enhanced')
        self.assertTrue(result.behavior_used)
        self.assertEqual(
            result.alpha_applied,
            settings.RECOMMENDATION_BEHAVIOR_ALPHA,
        )
        self.assertEqual(result.behavior_event_count, 8)
        self.assertEqual(result.behavior_listing_count, 5)
        np.testing.assert_array_equal(result.preference_vector, self.pref_vector)
        self.assertFalse(
            np.array_equal(result.query_vector, self.pref_vector),
        )
        self.assertAlmostEqual(
            np.linalg.norm(result.query_vector), 1.0, places=5,
        )

    def test_no_onboarding_plus_no_behavior_handled_safely(self):
        """User with no onboarding and no events should get preference-only with 'none' source."""
        profile = self._make_profile(
            is_sparse=True,
            has_vector=False,
            event_count=0,
            distinct_listing_count=0,
            recommendation_event_count=0,
            interaction_event_count=0,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        self.assertEqual(result.strategy, 'preference_based')
        self.assertFalse(result.behavior_used)
        self.assertEqual(result.behavior_signal_source, 'none')
        self.assertIsNotNone(result.query_vector)
        self.assertIsNotNone(result.preference_vector)

    def test_result_has_all_expected_attributes(self):
        """Ensure the BehaviorQueryResult exposes all documented fields."""
        profile = self._make_profile(
            recommendation_event_count=3,
            interaction_event_count=2,
            event_count=5,
        )
        result = build_behavior_query(
            user=self.traveller,
            behavior_profile=profile,
        )
        expected_attrs = [
            'query_vector',
            'preference_vector',
            'preprocessed_payload',
            'strategy',
            'behavior_used',
            'alpha_applied',
            'behavior_event_count',
            'behavior_listing_count',
            'recommendation_event_count',
            'interaction_event_count',
            'behavior_signal_source',
        ]
        for attr in expected_attrs:
            self.assertTrue(
                hasattr(result, attr),
                f"BehaviorQueryResult missing attribute: {attr}",
            )


class ForYouBehaviorIntegrationTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def _make_sparse_profile(self):
        return BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=1,
            distinct_listing_count=1,
            top_listing_ids=[101],
            recommendation_event_count=1,
            interaction_event_count=0,
        )

    def _make_rich_profile(self):
        vector = np.ones(
            settings.RECOMMENDATION_VECTOR_DIMENSION,
            dtype=np.float32,
        )
        vector = vector / np.linalg.norm(vector)
        return BehaviorProfile(
            behavior_vector=vector,
            is_sparse=False,
            event_count=8,
            distinct_listing_count=4,
            top_listing_ids=[1, 2, 3, 4],
            recommendation_event_count=8,
            interaction_event_count=0,
        )

    def _make_behavior_query_result(
        self,
        *,
        strategy='preference_based',
        behavior_used=False,
        behavior_event_count=1,
        behavior_listing_count=1,
        recommendation_event_count=None,
        interaction_event_count=0,
        behavior_signal_source=None,
    ):
        pref = np.ones(
            settings.RECOMMENDATION_VECTOR_DIMENSION,
            dtype=np.float32,
        )
        pref = pref / np.linalg.norm(pref)
        query = pref.copy()
        if behavior_used:
            query = np.roll(pref, 1).astype(np.float32)
        if recommendation_event_count is None:
            recommendation_event_count = behavior_event_count
        if behavior_signal_source is None:
            if recommendation_event_count == 0 and interaction_event_count == 0:
                behavior_signal_source = 'none'
            elif interaction_event_count == 0:
                behavior_signal_source = 'recommendation_only'
            elif recommendation_event_count == 0:
                behavior_signal_source = 'browsing_only'
            else:
                behavior_signal_source = 'mixed'
        return BehaviorQueryResult(
            query_vector=query,
            preference_vector=pref,
            preprocessed_payload={'dummy': 'query'},
            strategy=strategy,
            behavior_used=behavior_used,
            alpha_applied=(
                settings.RECOMMENDATION_BEHAVIOR_ALPHA if behavior_used else 0.0
            ),
            behavior_event_count=behavior_event_count,
            behavior_listing_count=behavior_listing_count,
            recommendation_event_count=recommendation_event_count,
            interaction_event_count=interaction_event_count,
            behavior_signal_source=behavior_signal_source,
        )

    def test_sparse_profile_keeps_preference_based_strategy(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_sparse_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='preference_based',
                behavior_used=False,
                behavior_event_count=1,
                behavior_listing_count=1,
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.1}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.strategy, 'preference_based')
        self.assertEqual(result.behavior_event_count, 1)
        self.assertEqual(result.behavior_listing_count, 1)

    def test_rich_profile_produces_behavior_enhanced_strategy(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=8,
                behavior_listing_count=4,
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.strategy, 'behavior_enhanced')
        self.assertGreater(result.behavior_event_count, 0)
        self.assertGreater(result.behavior_listing_count, 0)

    def test_mixed_slate_keeps_behavior_enhanced_strategy(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)
        self.create_listing(is_bookable=True, rating_average='4.90', booking_count=50)
        self.create_listing(is_bookable=True, rating_average='4.80', booking_count=40)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=8,
                behavior_listing_count=4,
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=3)

        self.assertEqual(result.strategy, 'behavior_enhanced')
        self.assertTrue(result.used_fallback)
        self.assertEqual(result.personalized_count, 1)
        self.assertGreaterEqual(result.fallback_count, 1)

    def test_no_preferences_uses_popular_fallback_unchanged(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(preferences={})
        self.create_listing(is_bookable=True, rating_average='4.50')

        result = get_for_you_listings(traveller, limit=2)

        self.assertEqual(result.strategy, 'popular_fallback')
        self.assertEqual(result.behavior_event_count, 0)
        self.assertEqual(result.behavior_listing_count, 0)

    def test_behavior_counts_propagated_in_result(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=42,
                behavior_listing_count=7,
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.behavior_event_count, 42)
        self.assertEqual(result.behavior_listing_count, 7)

    def test_recommendation_only_metadata_propagated_in_result(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=5,
                behavior_listing_count=3,
                recommendation_event_count=5,
                interaction_event_count=0,
                behavior_signal_source='recommendation_only',
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.behavior_signal_source, 'recommendation_only')
        self.assertEqual(result.recommendation_event_count, 5)
        self.assertEqual(result.interaction_event_count, 0)

    def test_browsing_only_metadata_propagated_in_result(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=6,
                behavior_listing_count=4,
                recommendation_event_count=0,
                interaction_event_count=6,
                behavior_signal_source='browsing_only',
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.behavior_signal_source, 'browsing_only')
        self.assertEqual(result.recommendation_event_count, 0)
        self.assertEqual(result.interaction_event_count, 6)

    def test_mixed_metadata_propagated_in_result(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=8,
                behavior_listing_count=4,
                recommendation_event_count=3,
                interaction_event_count=5,
                behavior_signal_source='mixed',
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.05}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.behavior_signal_source, 'mixed')
        self.assertEqual(result.recommendation_event_count, 3)
        self.assertEqual(result.interaction_event_count, 5)

    def test_zero_candidates_full_fallback_preserves_behavior_metadata(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        fallback_listing = self.create_listing(
            is_bookable=True,
            rating_average='4.90',
            booking_count=50,
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_rich_profile(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='behavior_enhanced',
                behavior_used=True,
                behavior_event_count=8,
                behavior_listing_count=4,
                recommendation_event_count=3,
                interaction_event_count=5,
                behavior_signal_source='mixed',
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.strategy, 'popular_fallback')
        self.assertTrue(result.used_fallback)
        self.assertEqual(result.listing_ids, [fallback_listing.pk])
        self.assertEqual(result.behavior_signal_source, 'mixed')
        self.assertEqual(result.recommendation_event_count, 3)
        self.assertEqual(result.interaction_event_count, 5)

    def test_no_broader_browsing_data_remains_preference_based(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=BehaviorProfile(
                behavior_vector=None,
                is_sparse=True,
                event_count=0,
                distinct_listing_count=0,
                top_listing_ids=[],
                recommendation_event_count=0,
                interaction_event_count=0,
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_behavior_query_result(
                strategy='preference_based',
                behavior_used=False,
                behavior_event_count=0,
                behavior_listing_count=0,
                recommendation_event_count=0,
                interaction_event_count=0,
                behavior_signal_source='none',
            ),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.08}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        self.assertEqual(result.strategy, 'preference_based')
        self.assertEqual(result.behavior_signal_source, 'none')
        self.assertEqual(result.recommendation_event_count, 0)
        self.assertEqual(result.interaction_event_count, 0)


class BehaviorGenerationTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(is_active=True)
        self.traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        self.listing = self.create_listing(is_bookable=True)
        self.served = ServedRecommendationSet.objects.create(
            user=self.traveller,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': self.listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )

    def _make_event(self, event_type, session_id='session-1'):
        return {
            'request_id': self.served.request_id,
            'listing_id': self.listing.pk,
            'event_type': event_type,
            'surface': 'for_you',
            'strategy': 'preference_based',
            'model_version': self.model_version.version_label,
            'position': 1,
            'session_id': session_id,
            'metadata': {},
        }

    def test_click_event_queues_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_events(
                    validated_events=[self._make_event('click')],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_detail_open_event_queues_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_events(
                    validated_events=[self._make_event('detail_open')],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_impression_event_does_not_queue_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            persist_events(
                validated_events=[self._make_event('impression')],
                user=self.traveller,
            )

        queue_mock.assert_not_called()
        self.assertEqual(get_user_behavior_generation(self.traveller.pk), gen_before)

    def test_anonymous_qualifying_event_does_not_queue_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            persist_events(
                validated_events=[self._make_event('click', session_id='anon-session')],
                user=None,
            )

        queue_mock.assert_not_called()
        self.assertEqual(get_user_behavior_generation(self.traveller.pk), gen_before)

    def test_multiple_qualifying_events_queue_once(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_events(
                    validated_events=[
                        self._make_event('click'),
                        self._make_event('detail_open'),
                    ],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )


class BehaviorSnapshotTaskTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def test_rebuild_task_upserts_snapshot_and_bumps_generation(self):
        model_version = self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        profile = BehaviorProfile(
            behavior_vector=np.ones(
                settings.RECOMMENDATION_VECTOR_DIMENSION,
                dtype=np.float32,
            ),
            is_sparse=False,
            event_count=6,
            distinct_listing_count=3,
            top_listing_ids=[11, 12, 13],
            recommendation_event_count=2,
            interaction_event_count=4,
        )
        gen_before = get_user_behavior_generation(traveller.pk)

        with mock.patch(
            'recommendations.tasks.build_behavior_profile',
            return_value=profile,
        ):
            result = rebuild_user_behavior_profile_snapshot_task.run(
                user_id=traveller.pk,
            )

        snapshot = UserBehaviorProfileSnapshot.objects.get(
            user_id=traveller.pk,
            model_version=model_version,
        )
        self.assertFalse(snapshot.is_sparse)
        self.assertEqual(snapshot.event_count, 6)
        self.assertEqual(snapshot.distinct_listing_count, 3)
        self.assertEqual(snapshot.top_listing_ids, [11, 12, 13])
        self.assertEqual(snapshot.recommendation_event_count, 2)
        self.assertEqual(snapshot.interaction_event_count, 4)
        self.assertEqual(
            get_user_behavior_generation(traveller.pk),
            gen_before + 1,
        )
        self.assertEqual(result['behavior_generation'], gen_before + 1)

    def test_rebuild_task_does_not_bump_generation_for_non_active_model(self):
        self.create_model_version(is_active=True)
        inactive_model_version = self.create_model_version(is_active=False)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        profile = BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=2,
            distinct_listing_count=1,
            top_listing_ids=[21],
            recommendation_event_count=1,
            interaction_event_count=1,
        )
        gen_before = get_user_behavior_generation(traveller.pk)

        with mock.patch(
            'recommendations.tasks.build_behavior_profile',
            return_value=profile,
        ):
            result = rebuild_user_behavior_profile_snapshot_task.run(
                user_id=traveller.pk,
                model_version_id=inactive_model_version.pk,
            )

        snapshot = UserBehaviorProfileSnapshot.objects.get(
            user_id=traveller.pk,
            model_version=inactive_model_version,
        )
        self.assertTrue(snapshot.is_sparse)
        self.assertEqual(get_user_behavior_generation(traveller.pk), gen_before)
        self.assertFalse(result['generation_bumped'])
        self.assertIsNone(result['behavior_generation'])


class ForYouCacheKeyTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def _make_sparse(self):
        return BehaviorProfile(
            behavior_vector=None,
            is_sparse=True,
            event_count=0,
            distinct_listing_count=0,
            top_listing_ids=[],
        )

    def _make_query_result(self):
        vector = np.ones(
            settings.RECOMMENDATION_VECTOR_DIMENSION,
            dtype=np.float32,
        )
        return BehaviorQueryResult(
            query_vector=vector,
            preference_vector=vector,
            preprocessed_payload={'dummy': 'query'},
            strategy='preference_based',
            behavior_used=False,
            alpha_applied=0.0,
            behavior_event_count=0,
            behavior_listing_count=0,
            recommendation_event_count=0,
            interaction_event_count=0,
            behavior_signal_source='none',
        )

    def test_different_limits_produce_separate_cache_entries(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True, rating_average='4.90')

        retrieve_mock = mock.Mock(
            side_effect=[
                [{'listing_id': listing_a.pk, 'distance': 0.1}],
                [
                    {'listing_id': listing_a.pk, 'distance': 0.1},
                    {'listing_id': listing_b.pk, 'distance': 0.2},
                ],
            ]
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_sparse(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_query_result(),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            retrieve_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            side_effect=lambda listing_ids, **kw: listing_ids,
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            side_effect=lambda candidates, eligible_ids, limit: eligible_ids[:limit],
        ):
            result_small = get_for_you_listings(traveller, limit=1)
            result_large = get_for_you_listings(traveller, limit=2)

        self.assertEqual(len(result_small.listing_ids), 1)
        self.assertEqual(len(result_large.listing_ids), 2)
        self.assertEqual(retrieve_mock.call_count, 2)

    def test_behavior_generation_bump_causes_cache_miss(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)
        retrieve_mock = mock.Mock(
            return_value=[{'listing_id': recommended.pk, 'distance': 0.1}],
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_sparse(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_query_result(),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            retrieve_mock,
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            first = get_for_you_listings(traveller, limit=1)
            second = get_for_you_listings(traveller, limit=1)
            bump_user_behavior_generation(traveller.pk)
            third = get_for_you_listings(traveller, limit=1)

        self.assertEqual(first.listing_ids, [recommended.pk])
        self.assertEqual(second.listing_ids, [recommended.pk])
        self.assertEqual(third.listing_ids, [recommended.pk])
        self.assertEqual(retrieve_mock.call_count, 2)

    def test_cache_hit_preserves_new_behavior_metadata(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)
        query_result = BehaviorQueryResult(
            query_vector=np.ones(
                settings.RECOMMENDATION_VECTOR_DIMENSION,
                dtype=np.float32,
            ),
            preference_vector=np.ones(
                settings.RECOMMENDATION_VECTOR_DIMENSION,
                dtype=np.float32,
            ),
            preprocessed_payload={'dummy': 'query'},
            strategy='behavior_enhanced',
            behavior_used=True,
            alpha_applied=settings.RECOMMENDATION_BEHAVIOR_ALPHA,
            behavior_event_count=8,
            behavior_listing_count=4,
            recommendation_event_count=3,
            interaction_event_count=5,
            behavior_signal_source='mixed',
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_sparse(),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=query_result,
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.1}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            first = get_for_you_listings(traveller, limit=1)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            side_effect=AssertionError('expected cache hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            side_effect=AssertionError('expected cache hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            side_effect=AssertionError('expected cache hit'),
        ):
            second = get_for_you_listings(traveller, limit=1)

        self.assertEqual(first.listing_ids, [recommended.pk])
        self.assertEqual(second.listing_ids, [recommended.pk])
        self.assertEqual(second.behavior_signal_source, 'mixed')
        self.assertEqual(second.recommendation_event_count, 3)
        self.assertEqual(second.interaction_event_count, 5)

    def test_snapshot_hit_skips_sync_behavior_build(self):
        model_version = self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)
        UserBehaviorProfileSnapshot.objects.create(
            user=traveller,
            model_version=model_version,
            behavior_vector=[1.0] * settings.RECOMMENDATION_VECTOR_DIMENSION,
            is_sparse=False,
            event_count=8,
            distinct_listing_count=4,
            top_listing_ids=[1, 2, 3, 4],
            recommendation_event_count=3,
            interaction_event_count=5,
        )
        query_result = BehaviorQueryResult(
            query_vector=np.ones(
                settings.RECOMMENDATION_VECTOR_DIMENSION,
                dtype=np.float32,
            ),
            preference_vector=np.ones(
                settings.RECOMMENDATION_VECTOR_DIMENSION,
                dtype=np.float32,
            ),
            preprocessed_payload={'dummy': 'query'},
            strategy='behavior_enhanced',
            behavior_used=True,
            alpha_applied=settings.RECOMMENDATION_BEHAVIOR_ALPHA,
            behavior_event_count=8,
            behavior_listing_count=4,
            recommendation_event_count=3,
            interaction_event_count=5,
            behavior_signal_source='mixed',
        )

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            side_effect=AssertionError('expected snapshot hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.queue_behavior_profile_rebuild',
            side_effect=AssertionError('expected snapshot hit'),
        ), mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=query_result,
        ) as query_mock, mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.1}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        behavior_profile = query_mock.call_args.kwargs['behavior_profile']
        self.assertIsInstance(behavior_profile.behavior_vector, np.ndarray)
        self.assertFalse(behavior_profile.is_sparse)
        self.assertEqual(behavior_profile.event_count, 8)
        self.assertEqual(behavior_profile.distinct_listing_count, 4)
        self.assertEqual(result.listing_ids, [recommended.pk])

    def test_snapshot_miss_queues_rebuild_after_sync_fallback(self):
        self.create_model_version(is_active=True)
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        recommended = self.create_listing(is_bookable=True)

        with mock.patch(
            'recommendations.services.recommendation_service.build_behavior_profile',
            return_value=self._make_sparse(),
        ) as build_mock, mock.patch(
            'recommendations.services.recommendation_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock, mock.patch(
            'recommendations.services.recommendation_service.build_behavior_query',
            return_value=self._make_query_result(),
        ), mock.patch(
            'recommendations.services.recommendation_service.retrieve_for_you',
            return_value=[{'listing_id': recommended.pk, 'distance': 0.1}],
        ), mock.patch(
            'recommendations.services.recommendation_service.filter_eligible_listings',
            return_value=[recommended.pk],
        ), mock.patch(
            'recommendations.services.recommendation_service.light_rerank',
            return_value=[recommended.pk],
        ):
            result = get_for_you_listings(traveller, limit=1)

        build_mock.assert_called_once()
        queue_mock.assert_called_once_with(user_id=traveller.pk)
        self.assertEqual(result.listing_ids, [recommended.pk])


class AccountCityInvalidationTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def test_city_change_bumps_preference_generation(self):
        traveller = self.create_traveller(
            city='Kathmandu',
            preferences={'preferred_activities': ['hiking']},
        )
        gen_before = get_user_preference_generation(traveller.pk)

        traveller.city = 'Pokhara'
        traveller.save(update_fields=['city'])

        self.assertEqual(
            get_user_preference_generation(traveller.pk),
            gen_before + 1,
        )

    def test_city_noop_save_does_not_bump(self):
        traveller = self.create_traveller(
            city='Kathmandu',
            preferences={'preferred_activities': ['hiking']},
        )
        gen_before = get_user_preference_generation(traveller.pk)

        traveller.city = 'Kathmandu'
        traveller.save(update_fields=['city'])

        self.assertEqual(get_user_preference_generation(traveller.pk), gen_before)

    def test_non_city_account_field_change_does_not_bump(self):
        traveller = self.create_traveller(
            city='Kathmandu',
            preferences={'preferred_activities': ['hiking']},
        )
        gen_before = get_user_preference_generation(traveller.pk)

        traveller.first_name = 'Updated'
        traveller.save(update_fields=['first_name'])

        self.assertEqual(get_user_preference_generation(traveller.pk), gen_before)


class BehaviorEnhancedStrategyValidationTest(
    RecommendationTestDataMixin,
    TestCase,
):
    def test_behavior_enhanced_is_valid_strategy_for_events(self):
        listing = self.create_listing(is_bookable=True)

        serializer = EventBatchSerializer(
            data={
                'events': [
                    {
                        'request_id': str(uuid.uuid4()),
                        'listing_id': listing.pk,
                        'event_type': 'click',
                        'surface': 'for_you',
                        'strategy': 'behavior_enhanced',
                        'model_version': 'v-test',
                        'position': 1,
                        'session_id': 'session-1',
                        'metadata': {},
                    }
                ]
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


class Phase25MonitoringTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='monitor-25-v1',
        )

    def _create_for_you_slate(
        self,
        *,
        traveller,
        listing,
        strategy='behavior_enhanced',
        signal_source='none',
        recommendation_event_count=0,
        interaction_event_count=0,
        behavior_event_count=None,
        behavior_listing_count=0,
        results_json=None,
    ):
        if behavior_event_count is None:
            behavior_event_count = (
                recommendation_event_count + interaction_event_count
            )
        if results_json is None:
            results_json = [
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ]

        return ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy=strategy,
            model_version=self.model_version,
            result_count=len(results_json),
            results_json=results_json,
            serving_metadata={
                'behavior_signal_source': signal_source,
                'recommendation_event_count': recommendation_event_count,
                'interaction_event_count': interaction_event_count,
                'behavior_event_count': behavior_event_count,
                'behavior_listing_count': behavior_listing_count,
            },
        )

    def test_mixed_fallback_slate_classified_correctly(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=2,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.05},
                {'listing_id': listing_b.pk, 'position': 2},
            ],
        )

        served = get_quality_summary()['served_sets']

        self.assertEqual(served['mixed_fallback_count'], 1)
        self.assertEqual(served['pure_fallback_count'], 0)
        self.assertEqual(served['pure_personalized_count'], 0)
        self.assertEqual(served['any_fallback_count'], 1)

    def test_pure_personalized_slate_classified_correctly(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )

        served = get_quality_summary()['served_sets']

        self.assertEqual(served['pure_personalized_count'], 1)
        self.assertEqual(served['mixed_fallback_count'], 0)
        self.assertEqual(served['pure_fallback_count'], 0)

    def test_pure_fallback_slate_classified_correctly(self):
        traveller = self.create_traveller(preferences={})
        listing = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='popular_fallback',
            model_version=self.model_version,
            result_count=1,
            results_json=[{'listing_id': listing.pk, 'position': 1}],
        )

        served = get_quality_summary()['served_sets']

        self.assertEqual(served['pure_fallback_count'], 1)
        self.assertEqual(served['mixed_fallback_count'], 0)
        self.assertEqual(served['pure_personalized_count'], 0)
        self.assertEqual(served['any_fallback_count'], 1)

    def test_any_fallback_count_sums_pure_and_mixed(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='popular_fallback',
            model_version=self.model_version,
            result_count=1,
            results_json=[{'listing_id': listing_a.pk, 'position': 1}],
        )
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=2,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.1},
                {'listing_id': listing_b.pk, 'position': 2},
            ],
        )

        served = get_quality_summary()['served_sets']

        self.assertEqual(served['pure_fallback_count'], 1)
        self.assertEqual(served['mixed_fallback_count'], 1)
        self.assertEqual(served['any_fallback_count'], 2)

    def test_behavior_enhanced_appears_in_strategy_breakdown(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
        )

        summary = get_quality_summary()

        self.assertIn('behavior_enhanced', summary['served_sets']['by_strategy'])
        self.assertEqual(summary['served_sets']['by_strategy']['behavior_enhanced'], 1)

    def test_for_you_breakdown_counts_strategies(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
        )
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='popular_fallback',
            model_version=self.model_version,
            result_count=0,
            results_json=[],
        )
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            seed_listing_id=listing.pk,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.2},
            ],
        )

        fy = get_quality_summary()['for_you_breakdown']

        self.assertEqual(fy['total'], 3)
        self.assertEqual(fy['behavior_enhanced_count'], 1)
        self.assertEqual(fy['preference_based_count'], 1)
        self.assertEqual(fy['popular_fallback_count'], 1)

    def test_ctr_by_strategy_computed_correctly(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)
        served = ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='click',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        ctr_row = next(
            row for row in get_quality_summary()['events']['ctr_by_strategy']
            if row['strategy'] == 'behavior_enhanced'
        )
        self.assertEqual(ctr_row['impressions'], 1)
        self.assertEqual(ctr_row['clicks'], 1)
        self.assertEqual(ctr_row['ctr'], 1.0)

    def test_ctr_by_surface_strategy_cross_tab(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)
        served = ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='click',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        row = next(
            r for r in get_quality_summary()['events']['ctr_by_surface_strategy']
            if r['surface'] == 'for_you' and r['strategy'] == 'behavior_enhanced'
        )
        self.assertEqual(row['ctr'], 1.0)

    def test_orphan_event_counted(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        RecommendationEvent.objects.create(
            served_set=None,
            request_id=uuid.uuid4(),
            user=traveller,
            listing=listing,
            event_type='click',
            surface='for_you',
            strategy='preference_based',
            model_version_label='test-v1',
            position=1,
            metadata={},
        )

        summary = get_quality_summary()
        self.assertEqual(summary['events']['orphan_event_count'], 1)
        self.assertEqual(summary['events']['orphan_event_rate'], 1.0)

    def test_signal_source_breakdown_counts_all_sources(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='preference_based',
            signal_source='none',
        )
        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='behavior_enhanced',
            signal_source='recommendation_only',
            recommendation_event_count=4,
            behavior_listing_count=2,
        )
        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='behavior_enhanced',
            signal_source='browsing_only',
            interaction_event_count=5,
            behavior_listing_count=3,
        )
        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='behavior_enhanced',
            signal_source='mixed',
            recommendation_event_count=2,
            interaction_event_count=3,
            behavior_listing_count=4,
        )

        summary = get_quality_summary()
        breakdown = summary['for_you_signal_source_breakdown']
        enhanced_breakdown = summary['behavior_enhanced_signal_source_breakdown']

        self.assertEqual(breakdown['total'], 4)
        self.assertEqual(breakdown['none_count'], 1)
        self.assertEqual(breakdown['recommendation_only_count'], 1)
        self.assertEqual(breakdown['browsing_only_count'], 1)
        self.assertEqual(breakdown['mixed_count'], 1)
        self.assertEqual(enhanced_breakdown['total'], 3)
        self.assertEqual(enhanced_breakdown['none_count'], 0)
        self.assertEqual(enhanced_breakdown['recommendation_only_count'], 1)
        self.assertEqual(enhanced_breakdown['browsing_only_count'], 1)
        self.assertEqual(enhanced_breakdown['mixed_count'], 1)

    def test_behavior_input_aggregates_sum_metadata_fields(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            signal_source='recommendation_only',
            recommendation_event_count=5,
            behavior_listing_count=2,
        )
        self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            signal_source='mixed',
            recommendation_event_count=3,
            interaction_event_count=4,
            behavior_listing_count=5,
        )

        aggregates = get_quality_summary()['behavior_input_aggregates']

        self.assertEqual(aggregates['total_for_you_slates'], 2)
        self.assertEqual(aggregates['recommendation_event_count_sum'], 8)
        self.assertEqual(aggregates['interaction_event_count_sum'], 4)
        self.assertEqual(aggregates['behavior_event_count_sum'], 12)
        self.assertEqual(aggregates['behavior_listing_count_sum'], 7)

    def test_ctr_by_signal_source_and_strategy_signal_source_counted_correctly(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)

        mixed_served = self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='behavior_enhanced',
            signal_source='mixed',
            recommendation_event_count=3,
            interaction_event_count=2,
        )
        reco_only_served = self._create_for_you_slate(
            traveller=traveller,
            listing=listing,
            strategy='preference_based',
            signal_source='recommendation_only',
            recommendation_event_count=2,
        )

        RecommendationEvent.objects.create(
            served_set=mixed_served,
            request_id=mixed_served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=mixed_served,
            request_id=mixed_served.request_id,
            user=traveller,
            listing=listing,
            event_type='click',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=reco_only_served,
            request_id=reco_only_served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        events = get_quality_summary()['events']
        mixed_row = next(
            row for row in events['ctr_by_signal_source']
            if row['behavior_signal_source'] == 'mixed'
        )
        reco_only_row = next(
            row for row in events['ctr_by_signal_source']
            if row['behavior_signal_source'] == 'recommendation_only'
        )
        strategy_row = next(
            row for row in events['ctr_by_strategy_signal_source']
            if row['strategy'] == 'behavior_enhanced'
            and row['behavior_signal_source'] == 'mixed'
        )

        self.assertEqual(mixed_row['impressions'], 1)
        self.assertEqual(mixed_row['clicks'], 1)
        self.assertEqual(mixed_row['ctr'], 1.0)
        self.assertEqual(reco_only_row['impressions'], 1)
        self.assertEqual(reco_only_row['clicks'], 0)
        self.assertEqual(reco_only_row['ctr'], 0.0)
        self.assertEqual(strategy_row['impressions'], 1)
        self.assertEqual(strategy_row['clicks'], 1)
        self.assertEqual(strategy_row['ctr'], 1.0)

    def test_mixed_fallback_by_signal_source_segments_correctly(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)

        self._create_for_you_slate(
            traveller=traveller,
            listing=listing_a,
            strategy='behavior_enhanced',
            signal_source='mixed',
            recommendation_event_count=2,
            interaction_event_count=2,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.05},
                {'listing_id': listing_b.pk, 'position': 2},
            ],
        )
        self._create_for_you_slate(
            traveller=traveller,
            listing=listing_a,
            strategy='behavior_enhanced',
            signal_source='recommendation_only',
            recommendation_event_count=3,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.04},
            ],
        )

        breakdown = get_quality_summary()['mixed_fallback_by_signal_source']

        self.assertEqual(breakdown['total_mixed_fallback_count'], 1)
        self.assertEqual(
            breakdown['breakdown']['mixed']['mixed_fallback_count'],
            1,
        )
        self.assertEqual(
            breakdown['breakdown']['recommendation_only']['mixed_fallback_count'],
            0,
        )

    def test_no_data_returns_graceful_empty_values(self):
        summary = get_quality_summary()

        self.assertEqual(summary['served_sets']['total'], 0)
        self.assertEqual(summary['events']['total'], 0)
        self.assertIsNone(summary['served_sets']['fallback_rate'])
        self.assertIsNone(summary['events']['orphan_event_rate'])
        self.assertEqual(summary['for_you_breakdown']['total'], 0)
        self.assertEqual(summary['for_you_signal_source_breakdown']['total'], 0)
        self.assertEqual(
            summary['for_you_signal_source_breakdown']['recommendation_only_count'],
            0,
        )
        self.assertEqual(summary['behavior_input_aggregates']['total_for_you_slates'], 0)
        self.assertEqual(summary['mixed_fallback_by_signal_source']['total_mixed_fallback_count'], 0)
        self.assertEqual(summary['events']['ctr_by_signal_source'], [])
        self.assertEqual(summary['events']['ctr_by_strategy_signal_source'], [])

    def test_existing_core_metrics_still_correct(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(
            is_bookable=True,
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
        )
        served = create_served_slate(
            user=traveller,
            surface='similar',
            strategy='content_based',
            model_version=self.model_version,
            seed_listing_id=listing.pk,
            results=[{'listing_id': listing.pk, 'distance': 0.2}],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='similar',
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='click',
            surface='similar',
            strategy='content_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        summary = get_quality_summary()

        self.assertEqual(summary['active_model_version'], self.model_version.version_label)
        self.assertEqual(summary['served_sets']['total'], 1)
        self.assertEqual(summary['events']['by_type']['click'], 1)
        similar_ctr = next(
            row for row in summary['events']['ctr_by_surface']
            if row['surface'] == 'similar'
        )
        self.assertEqual(similar_ctr['ctr'], 1.0)


class BehaviorCoverageTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='coverage-v1',
        )

    def test_coverage_with_mixed_user_base(self):
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)
        listing_c = self.create_listing(is_bookable=True)

        active_user = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        served_a = ServedRecommendationSet.objects.create(
            user=active_user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=3,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.1},
                {'listing_id': listing_b.pk, 'position': 2, 'distance': 0.2},
                {'listing_id': listing_c.pk, 'position': 3, 'distance': 0.3},
            ],
        )
        for listing in [listing_a, listing_b, listing_c]:
            RecommendationEvent.objects.create(
                served_set=served_a,
                request_id=served_a.request_id,
                user=active_user,
                listing=listing,
                event_type='click',
                surface='for_you',
                strategy='preference_based',
                model_version_label=self.model_version.version_label,
                position=1,
                metadata={},
            )

        sparse_user = self.create_traveller(
            preferences={'preferred_activities': ['photography']},
        )
        served_b = ServedRecommendationSet.objects.create(
            user=sparse_user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served_b,
            request_id=served_b.request_id,
            user=sparse_user,
            listing=listing_a,
            event_type='detail_open',
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        self.create_traveller(
            preferences={'preferred_activities': ['nature walks']},
        )

        coverage = get_behavior_coverage_summary()

        self.assertEqual(coverage['total_travellers'], 3)
        self.assertEqual(coverage['with_any_events'], 2)
        self.assertEqual(coverage['with_sufficient_listings'], 1)
        self.assertEqual(coverage['min_listings_threshold'], 3)

    def test_coverage_with_no_travellers(self):
        coverage = get_behavior_coverage_summary()

        self.assertEqual(coverage['total_travellers'], 0)
        self.assertIsNone(coverage['with_any_events_rate'])
        self.assertIsNone(coverage['with_sufficient_listings_rate'])

    def test_coverage_with_no_events(self):
        self.create_traveller(preferences={'preferred_activities': ['hiking']})

        coverage = get_behavior_coverage_summary()

        self.assertEqual(coverage['total_travellers'], 1)
        self.assertEqual(coverage['with_any_events'], 0)
        self.assertEqual(coverage['with_sufficient_listings'], 0)
        zero_band = next(
            band for band in coverage['event_count_bands']
            if band['band'] == '0'
        )
        self.assertEqual(zero_band['count'], 1)

    def test_impression_events_excluded_from_coverage(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)
        served = ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=traveller,
            listing=listing,
            event_type='impression',
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )

        coverage = get_behavior_coverage_summary()
        self.assertEqual(coverage['with_any_events'], 0)

    def test_band_distribution_places_users_correctly(self):
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)

        user = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        served = ServedRecommendationSet.objects.create(
            user=user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=2,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.1},
                {'listing_id': listing_b.pk, 'position': 2, 'distance': 0.2},
            ],
        )
        for listing in [listing_a, listing_b]:
            RecommendationEvent.objects.create(
                served_set=served,
                request_id=served.request_id,
                user=user,
                listing=listing,
                event_type='click',
                surface='for_you',
                strategy='preference_based',
                model_version_label=self.model_version.version_label,
                position=1,
                metadata={},
            )

        coverage = get_behavior_coverage_summary()

        event_band = next(
            band for band in coverage['event_count_bands']
            if band['band'] == '1-2'
        )
        listing_band = next(
            band for band in coverage['listing_count_bands']
            if band['band'] == '1-2'
        )
        self.assertEqual(event_band['count'], 1)
        self.assertEqual(listing_band['count'], 1)

    def test_coverage_distinguishes_recommendation_interaction_and_mixed_users(self):
        listing_a = self.create_listing(is_bookable=True)
        listing_b = self.create_listing(is_bookable=True)
        listing_c = self.create_listing(is_bookable=True)

        recommendation_only_user = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        interaction_only_user = self.create_traveller(
            preferences={'preferred_activities': ['photography']},
        )
        mixed_user = self.create_traveller(
            preferences={'preferred_activities': ['nature walks']},
        )
        self.create_traveller(
            preferences={'preferred_activities': ['cultural tours']},
        )

        served = ServedRecommendationSet.objects.create(
            user=recommendation_only_user,
            surface='for_you',
            strategy='preference_based',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing_a.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served,
            request_id=served.request_id,
            user=recommendation_only_user,
            listing=listing_a,
            event_type='click',
            surface='for_you',
            strategy='preference_based',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        ListingInteractionEvent.objects.create(
            user=interaction_only_user,
            listing=listing_b,
            event_type='detail_open',
            surface='catalog',
            metadata={},
        )
        served_mixed = ServedRecommendationSet.objects.create(
            user=mixed_user,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing_b.pk, 'position': 1, 'distance': 0.1},
            ],
        )
        RecommendationEvent.objects.create(
            served_set=served_mixed,
            request_id=served_mixed.request_id,
            user=mixed_user,
            listing=listing_b,
            event_type='click',
            surface='for_you',
            strategy='behavior_enhanced',
            model_version_label=self.model_version.version_label,
            position=1,
            metadata={},
        )
        ListingInteractionEvent.objects.create(
            user=mixed_user,
            listing=listing_c,
            event_type='click',
            surface='search_results',
            metadata={},
        )

        coverage = get_behavior_coverage_summary()

        self.assertEqual(coverage['total_travellers'], 4)
        self.assertEqual(coverage['with_any_recommendation_events'], 2)
        self.assertEqual(coverage['with_any_interaction_events'], 2)
        self.assertEqual(coverage['recommendation_only_users'], 1)
        self.assertEqual(coverage['interaction_only_users'], 1)
        self.assertEqual(coverage['mixed_source_users'], 1)
        self.assertEqual(coverage['source_mix']['none_users'], 1)
        self.assertEqual(
            coverage['aggregate_events']['recommendation_event_count'],
            2,
        )
        self.assertEqual(
            coverage['aggregate_events']['interaction_event_count'],
            2,
        )


class Phase25MonitoringCommandTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.model_version = self.create_model_version(
            is_active=True,
            version_label='cmd-25-v1',
        )

    def test_json_output_includes_phase_25_sections(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
            serving_metadata={
                'behavior_signal_source': 'mixed',
                'recommendation_event_count': 2,
                'interaction_event_count': 3,
                'behavior_event_count': 5,
                'behavior_listing_count': 4,
            },
        )

        output = StringIO()
        call_command(
            'reco_quality_report',
            '--json',
            '--include-behavior-coverage',
            stdout=output,
        )
        payload = json.loads(output.getvalue())

        self.assertIn('for_you_breakdown', payload)
        self.assertEqual(payload['for_you_breakdown']['behavior_enhanced_count'], 1)
        self.assertIn('mixed_fallback_count', payload['served_sets'])
        self.assertIn('pure_fallback_count', payload['served_sets'])
        self.assertIn('ctr_by_strategy', payload['events'])
        self.assertIn('ctr_by_surface_strategy', payload['events'])
        self.assertIn('ctr_by_signal_source', payload['events'])
        self.assertIn('ctr_by_strategy_signal_source', payload['events'])
        self.assertIn('orphan_event_count', payload['events'])
        self.assertIn('for_you_signal_source_breakdown', payload)
        self.assertIn('behavior_enhanced_signal_source_breakdown', payload)
        self.assertIn('behavior_input_aggregates', payload)
        self.assertIn('mixed_fallback_by_signal_source', payload)
        self.assertIn('behavior_coverage', payload)
        self.assertGreaterEqual(payload['behavior_coverage']['total_travellers'], 1)
        self.assertIn('source_mix', payload['behavior_coverage'])
        self.assertIn('aggregate_events', payload['behavior_coverage'])
        self.assertIn('fallback_count', payload['served_sets'])
        self.assertIn('fallback_rate', payload['served_sets'])

    def test_json_output_without_behavior_coverage_flag(self):
        output = StringIO()
        call_command(
            'reco_quality_report',
            '--json',
            stdout=output,
        )
        payload = json.loads(output.getvalue())

        self.assertNotIn('behavior_coverage', payload)
        self.assertIn('for_you_breakdown', payload)

    def test_text_output_includes_broader_browsing_sections(self):
        traveller = self.create_traveller(
            preferences={'preferred_activities': ['hiking']},
        )
        listing = self.create_listing(is_bookable=True)
        ServedRecommendationSet.objects.create(
            user=traveller,
            surface='for_you',
            strategy='behavior_enhanced',
            model_version=self.model_version,
            result_count=1,
            results_json=[
                {'listing_id': listing.pk, 'position': 1, 'distance': 0.05},
            ],
            serving_metadata={
                'behavior_signal_source': 'browsing_only',
                'recommendation_event_count': 0,
                'interaction_event_count': 4,
                'behavior_event_count': 4,
                'behavior_listing_count': 2,
            },
        )

        output = StringIO()
        call_command('reco_quality_report', stdout=output)
        rendered = output.getvalue()

        self.assertIn('/for-you/ behavior signal source breakdown', rendered)
        self.assertIn('Behavior input aggregates', rendered)
        self.assertIn('Mixed fallback by signal source', rendered)
        self.assertIn('CTR by behavior signal source', rendered)


class ListingInteractionModelTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def test_create_interaction_event(self):
        traveller = self.create_traveller()
        listing = self.create_listing()

        event = ListingInteractionEvent.objects.create(
            user=traveller,
            listing=listing,
            event_type='click',
            surface='catalog',
            position=3,
            metadata={'search_query': 'trekking'},
        )

        event.refresh_from_db()

        self.assertEqual(event.user_id, traveller.pk)
        self.assertEqual(event.listing_id, listing.pk)
        self.assertEqual(event.event_type, 'click')
        self.assertEqual(event.surface, 'catalog')
        self.assertEqual(event.position, 3)
        self.assertEqual(event.metadata, {'search_query': 'trekking'})
        self.assertIsNotNone(event.created_at)

    def test_create_interaction_event_minimal_fields(self):
        traveller = self.create_traveller()
        listing = self.create_listing()

        event = ListingInteractionEvent.objects.create(
            user=traveller,
            listing=listing,
            event_type='detail_open',
            surface='listing_detail',
        )

        event.refresh_from_db()

        self.assertIsNone(event.position)
        self.assertEqual(event.metadata, {})

    def test_str_representation(self):
        traveller = self.create_traveller()
        listing = self.create_listing()

        event = ListingInteractionEvent.objects.create(
            user=traveller,
            listing=listing,
            event_type='click',
            surface='search_results',
        )

        self.assertEqual(
            str(event),
            f"Interaction click listing={listing.pk} surface=search_results",
        )


class ListingInteractionSerializerTests(
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.listing = self.create_listing()

    def _make_event(self, **overrides):
        defaults = {
            'listing_id': self.listing.pk,
            'event_type': 'click',
            'surface': 'catalog',
        }
        defaults.update(overrides)
        return defaults

    def test_valid_single_event(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event()]},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_optional_fields_default_correctly(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event()]},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        validated_event = serializer.validated_data['events'][0]
        self.assertEqual(validated_event['metadata'], {})
        self.assertNotIn('position', validated_event)

    def test_valid_event_with_all_optional_fields(self):
        serializer = InteractionBatchSerializer(
            data={
                'events': [
                    self._make_event(
                        position=5,
                        metadata={'search_query': 'trekking in nepal'},
                    ),
                ],
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_surface_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(surface='similar')]},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('events', serializer.errors)

    def test_for_you_surface_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(surface='for_you')]},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('events', serializer.errors)

    def test_invalid_event_type_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(event_type='impression')]},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('events', serializer.errors)

    def test_unknown_event_type_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(event_type='bookmark')]},
        )

        self.assertFalse(serializer.is_valid())

    def test_missing_listing_id_rejected(self):
        event = self._make_event()
        del event['listing_id']

        serializer = InteractionBatchSerializer(data={'events': [event]})

        self.assertFalse(serializer.is_valid())

    def test_nonexistent_listing_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(listing_id=999999)]},
        )

        self.assertFalse(serializer.is_valid())

    def test_empty_batch_rejected(self):
        serializer = InteractionBatchSerializer(data={'events': []})

        self.assertFalse(serializer.is_valid())

    def test_oversized_batch_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event() for _ in range(51)]},
        )

        self.assertFalse(serializer.is_valid())

    def test_position_below_one_rejected(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(position=0)]},
        )

        self.assertFalse(serializer.is_valid())

    def test_position_null_accepted(self):
        serializer = InteractionBatchSerializer(
            data={'events': [self._make_event(position=None)]},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_all_three_surfaces_accepted(self):
        for surface in ('catalog', 'search_results', 'listing_detail'):
            serializer = InteractionBatchSerializer(
                data={'events': [self._make_event(surface=surface)]},
            )

            self.assertTrue(
                serializer.is_valid(),
                f"Surface '{surface}' should be valid: {serializer.errors}",
            )

    def test_both_event_types_accepted(self):
        for event_type in ('click', 'detail_open'):
            serializer = InteractionBatchSerializer(
                data={'events': [self._make_event(event_type=event_type)]},
            )

            self.assertTrue(
                serializer.is_valid(),
                f"Event type '{event_type}' should be valid: {serializer.errors}",
            )


class ListingInteractionTrackingServiceTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.traveller = self.create_traveller()
        self.listing = self.create_listing()

    def _make_event(self, **overrides):
        defaults = {
            'listing_id': self.listing.pk,
            'event_type': 'click',
            'surface': 'catalog',
            'metadata': {},
        }
        defaults.update(overrides)
        return defaults

    def test_persist_single_event_creates_row(self):
        result = persist_listing_interactions(
            validated_events=[self._make_event()],
            user=self.traveller,
        )

        self.assertEqual(result['accepted'], 1)
        self.assertEqual(result['rejected'], 0)
        self.assertEqual(result['errors'], [])
        self.assertEqual(ListingInteractionEvent.objects.count(), 1)

        row = ListingInteractionEvent.objects.get()
        self.assertEqual(row.user_id, self.traveller.pk)
        self.assertEqual(row.listing_id, self.listing.pk)
        self.assertEqual(row.event_type, 'click')
        self.assertEqual(row.surface, 'catalog')

    def test_persist_batch_creates_all_rows(self):
        listing_2 = self.create_listing()

        result = persist_listing_interactions(
            validated_events=[
                self._make_event(surface='catalog'),
                self._make_event(
                    listing_id=listing_2.pk,
                    event_type='detail_open',
                    surface='search_results',
                    position=2,
                ),
            ],
            user=self.traveller,
        )

        self.assertEqual(result['accepted'], 2)
        self.assertEqual(result['rejected'], 0)
        self.assertEqual(ListingInteractionEvent.objects.count(), 2)

    def test_persist_stores_position_and_metadata(self):
        persist_listing_interactions(
            validated_events=[
                self._make_event(
                    position=7,
                    metadata={'search_query': 'kathmandu trek'},
                ),
            ],
            user=self.traveller,
        )

        row = ListingInteractionEvent.objects.get()
        self.assertEqual(row.position, 7)
        self.assertEqual(row.metadata, {'search_query': 'kathmandu trek'})

    def test_click_queues_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_listing_interactions(
                    validated_events=[self._make_event(event_type='click')],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_detail_open_queues_behavior_rebuild(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_listing_interactions(
                    validated_events=[self._make_event(event_type='detail_open')],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_multiple_qualifying_events_queue_once(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                persist_listing_interactions(
                    validated_events=[
                        self._make_event(event_type='click'),
                        self._make_event(event_type='detail_open'),
                    ],
                    user=self.traveller,
                )

        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_does_not_create_recommendation_events(self):
        persist_listing_interactions(
            validated_events=[self._make_event()],
            user=self.traveller,
        )

        self.assertEqual(RecommendationEvent.objects.count(), 0)
        self.assertEqual(ListingInteractionEvent.objects.count(), 1)


class ListingInteractionViewTests(
    RecommendationCacheBackendMixin,
    RecommendationTestDataMixin,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()
        self.traveller = self.create_traveller()
        self.listing = self.create_listing()
        self.url = reverse('recommendations:interactions')

    def _make_event(self, **overrides):
        defaults = {
            'listing_id': self.listing.pk,
            'event_type': 'click',
            'surface': 'catalog',
        }
        defaults.update(overrides)
        return defaults

    def _post(self, data, user=None):
        request = self.factory.post(self.url, data, format='json')
        if user is not None:
            force_authenticate(request, user=user)
        return InteractionIngestionView.as_view()(request)

    def test_route_resolves_to_interaction_ingestion_view(self):
        match = resolve(self.url)

        self.assertEqual(match.func.view_class, InteractionIngestionView)

    def test_unauthenticated_returns_401(self):
        response = self._post({'events': [self._make_event()]})

        self.assertEqual(response.status_code, 401)

    def test_authenticated_single_event_returns_202(self):
        response = self._post(
            {'events': [self._make_event()]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['accepted'], 1)
        self.assertEqual(response.data['rejected'], 0)
        self.assertEqual(ListingInteractionEvent.objects.count(), 1)

    def test_authenticated_batch_returns_202(self):
        listing_2 = self.create_listing()

        response = self._post(
            {
                'events': [
                    self._make_event(surface='catalog'),
                    self._make_event(
                        listing_id=listing_2.pk,
                        event_type='detail_open',
                        surface='search_results',
                        position=3,
                    ),
                    self._make_event(
                        event_type='detail_open',
                        surface='listing_detail',
                    ),
                ],
            },
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['accepted'], 3)
        self.assertEqual(response.data['rejected'], 0)
        self.assertEqual(ListingInteractionEvent.objects.count(), 3)

    def test_invalid_surface_returns_400(self):
        response = self._post(
            {'events': [self._make_event(surface='similar')]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ListingInteractionEvent.objects.count(), 0)

    def test_for_you_surface_returns_400(self):
        response = self._post(
            {'events': [self._make_event(surface='for_you')]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ListingInteractionEvent.objects.count(), 0)

    def test_impression_event_type_returns_400(self):
        response = self._post(
            {'events': [self._make_event(event_type='impression')]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ListingInteractionEvent.objects.count(), 0)

    def test_nonexistent_listing_returns_400(self):
        response = self._post(
            {'events': [self._make_event(listing_id=999999)]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ListingInteractionEvent.objects.count(), 0)

    def test_empty_batch_returns_400(self):
        response = self._post({'events': []}, user=self.traveller)

        self.assertEqual(response.status_code, 400)

    def test_oversized_batch_returns_400(self):
        response = self._post(
            {'events': [self._make_event() for _ in range(51)]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 400)

    def test_does_not_create_recommendation_events(self):
        response = self._post(
            {'events': [self._make_event()]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(RecommendationEvent.objects.count(), 0)

    def test_with_position_and_metadata(self):
        response = self._post(
            {
                'events': [
                    self._make_event(
                        position=5,
                        metadata={'search_query': 'adventure trekking'},
                    ),
                ],
            },
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 202)
        row = ListingInteractionEvent.objects.get()
        self.assertEqual(row.position, 5)
        self.assertEqual(row.metadata, {'search_query': 'adventure trekking'})

    def test_behavior_rebuild_queued_on_qualifying_event(self):
        gen_before = get_user_behavior_generation(self.traveller.pk)

        with mock.patch(
            'recommendations.services.tracking_service.queue_behavior_profile_rebuild',
            return_value=True,
        ) as queue_mock:
            with self.captureOnCommitCallbacks(execute=True):
                response = self._post(
                    {'events': [self._make_event(event_type='click')]},
                    user=self.traveller,
                )

        self.assertEqual(response.status_code, 202)
        queue_mock.assert_called_once_with(user_id=self.traveller.pk)
        self.assertEqual(
            get_user_behavior_generation(self.traveller.pk),
            gen_before,
        )

    def test_duplicate_events_in_batch_both_persisted(self):
        response = self._post(
            {'events': [self._make_event(), self._make_event()]},
            user=self.traveller,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['accepted'], 2)
        self.assertEqual(ListingInteractionEvent.objects.count(), 2)

    def test_host_can_also_send_interactions(self):
        host_user = self.create_account(role=Account.Role.HOST)

        response = self._post(
            {'events': [self._make_event()]},
            user=host_user,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['accepted'], 1)
