import numpy as np

from recommendations.models import (
    RecommendationModelVersion,
    UserBehaviorProfileSnapshot,
)
from recommendations.services.behavior_profile_service import BehaviorProfile

_SNAPSHOT_ONLY_FIELDS = (
    'behavior_vector',
    'is_sparse',
    'event_count',
    'distinct_listing_count',
    'top_listing_ids',
    'recommendation_event_count',
    'interaction_event_count',
)


def get_behavior_profile_snapshot(
    *,
    user_id: int,
    model_version: RecommendationModelVersion,
) -> UserBehaviorProfileSnapshot | None:
    if model_version is None:
        raise ValueError(
            "get_behavior_profile_snapshot requires a valid RecommendationModelVersion."
        )

    return (
        UserBehaviorProfileSnapshot.objects.filter(
            user_id=user_id,
            model_version=model_version,
        )
        .only(*_SNAPSHOT_ONLY_FIELDS)
        .first()
    )


def load_behavior_profile_snapshot(
    *,
    user_id: int,
    model_version: RecommendationModelVersion,
) -> BehaviorProfile | None:
    snapshot = get_behavior_profile_snapshot(
        user_id=user_id,
        model_version=model_version,
    )
    if snapshot is None:
        return None
    return behavior_profile_from_snapshot(snapshot)


def upsert_behavior_profile_snapshot(
    *,
    user_id: int,
    model_version: RecommendationModelVersion,
    behavior_profile: BehaviorProfile,
) -> UserBehaviorProfileSnapshot:
    if model_version is None:
        raise ValueError(
            "upsert_behavior_profile_snapshot requires a valid RecommendationModelVersion."
        )

    defaults = {
        'behavior_vector': _serialize_behavior_vector(behavior_profile.behavior_vector),
        'is_sparse': behavior_profile.is_sparse,
        'event_count': behavior_profile.event_count,
        'distinct_listing_count': behavior_profile.distinct_listing_count,
        'top_listing_ids': [int(listing_id) for listing_id in behavior_profile.top_listing_ids],
        'recommendation_event_count': behavior_profile.recommendation_event_count,
        'interaction_event_count': behavior_profile.interaction_event_count,
    }
    snapshot, _ = UserBehaviorProfileSnapshot.objects.update_or_create(
        user_id=user_id,
        model_version=model_version,
        defaults=defaults,
    )
    return snapshot


def behavior_profile_from_snapshot(
    snapshot: UserBehaviorProfileSnapshot,
) -> BehaviorProfile:
    return BehaviorProfile(
        behavior_vector=_deserialize_behavior_vector(snapshot.behavior_vector),
        is_sparse=snapshot.is_sparse,
        event_count=snapshot.event_count,
        distinct_listing_count=snapshot.distinct_listing_count,
        top_listing_ids=[int(listing_id) for listing_id in snapshot.top_listing_ids],
        recommendation_event_count=snapshot.recommendation_event_count,
        interaction_event_count=snapshot.interaction_event_count,
    )


def _serialize_behavior_vector(behavior_vector) -> list[float] | None:
    if behavior_vector is None:
        return None
    return behavior_vector.tolist()


def _deserialize_behavior_vector(behavior_vector) -> np.ndarray | None:
    if behavior_vector is None:
        return None
    return np.array(behavior_vector, dtype=np.float32)
