export type RecommendationStrategy =
	| 'content_based'
	| 'preference_based'
	| 'behavior_enhanced'
	| 'popular_fallback';

export type BehaviorSignalSource =
	| 'none'
	| 'recommendation_only'
	| 'browsing_only'
	| 'mixed';

export interface RecommendationMeta {
	requestId: string | null;
	strategy: RecommendationStrategy;
	modelVersion: string;
	usedFallback: boolean;
	personalizedCount: number;
	fallbackCount: number;
	behaviorEventCount: number;
	behaviorListingCount: number;
	recommendationEventCount: number;
	interactionEventCount: number;
	behaviorSignalSource: BehaviorSignalSource;
}

export function normalizeRecommendationMeta(
	meta: Partial<RecommendationMeta> | null | undefined,
): RecommendationMeta {
	return {
		requestId: meta?.requestId ?? null,
		strategy: meta?.strategy ?? 'popular_fallback',
		modelVersion: meta?.modelVersion ?? '',
		usedFallback: meta?.usedFallback ?? false,
		personalizedCount: meta?.personalizedCount ?? 0,
		fallbackCount: meta?.fallbackCount ?? 0,
		behaviorEventCount: meta?.behaviorEventCount ?? 0,
		behaviorListingCount: meta?.behaviorListingCount ?? 0,
		recommendationEventCount: meta?.recommendationEventCount ?? 0,
		interactionEventCount: meta?.interactionEventCount ?? 0,
		behaviorSignalSource: meta?.behaviorSignalSource ?? 'none',
	};
}
