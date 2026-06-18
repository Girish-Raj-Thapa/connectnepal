import { useRef, useEffect } from 'react';
import ListingCard from '@components/listings/ListingCard';
import RecommendationsService, {
	getRecommendationSessionId,
} from '@services/recommendations.service';
import type {
	ListingNavigationState,
	RecommendationMeta,
	RecommendationNavigationContext,
	RecommendationSurface,
} from '@services/recommendations.service';
import type { RecommendationListing } from '@/types/listings';

interface RecommendationGridProps {
	title: string;
	listings: RecommendationListing[];
	meta: RecommendationMeta | null;
	surface: RecommendationSurface;
	loading: boolean;
	error: string | null;
	columns?: 3 | 4;
	skeletonCount?: number;
}

function ListingCardSkeleton() {
	return (
		<div className="animate-pulse rounded-2xl border border-line overflow-hidden">
			<div className="h-48 bg-surface-raised" />
			<div className="p-4 space-y-3">
				<div className="h-4 bg-surface-raised rounded w-3/4" />
				<div className="h-3 bg-surface-raised rounded w-full" />
				<div className="h-3 bg-surface-raised rounded w-5/6" />
				<div className="flex justify-between pt-2">
					<div className="h-4 bg-surface-raised rounded w-1/4" />
					<div className="h-4 bg-surface-raised rounded w-1/3" />
				</div>
			</div>
		</div>
	);
}

const RecommendationGrid = ({
	title,
	listings,
	meta,
	surface,
	loading,
	error,
	columns = 3,
	skeletonCount = 3,
}: RecommendationGridProps) => {
	const gridRef = useRef<HTMLDivElement>(null);
	const impressedRef = useRef<Set<number>>(new Set());

	// Impression tracking — fires once per card as it enters the viewport
	useEffect(() => {
		if (!meta?.requestId || listings.length === 0) return;

		const impressed = impressedRef.current;

		const observer = new IntersectionObserver(
			(entries) => {
				const batch = entries
					.filter((e) => e.isIntersecting)
					.map((e) => {
						const id = Number((e.target as HTMLElement).dataset.listingId);
						if (!id || impressed.has(id)) return null;

						impressed.add(id);
						observer.unobserve(e.target);

						const listing = listings.find((l) => l.id === id);
						if (!listing) return null;

						return {
							requestId: meta.requestId!,
							listingId: id,
							eventType: 'impression' as const,
							surface,
							strategy: meta.strategy,
							modelVersion: meta.modelVersion || undefined,
							position: listing.position,
							sessionId: getRecommendationSessionId(),
						};
					})
					.filter(Boolean);

				if (batch.length > 0) {
					void RecommendationsService.sendEvents(
						batch as Parameters<typeof RecommendationsService.sendEvents>[0]
					);
				}
			},
			{ threshold: 0.5 }
		);

		gridRef.current?.querySelectorAll('[data-listing-id]').forEach((el) => {
			observer.observe(el);
		});

		return () => observer.disconnect();
	}, [listings, meta, surface]);

	if (!loading && (error || listings.length === 0)) return null;

	const gridCols =
		columns === 4
			? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
			: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

	// let diagnosticText: string | null = null;
	// if (meta?.usedFallback && meta.fallbackCount > 0) {
	// 	diagnosticText =
	// 		`${meta.personalizedCount} personalized and ${meta.fallbackCount} popular picks shown.`;
	// }


	const handleCardClick = (listing: RecommendationListing) => {
		if (meta?.requestId) {
			void RecommendationsService.sendEvents([{
				requestId: meta.requestId,
				listingId: listing.id,
				eventType: 'click',
				surface,
				strategy: meta.strategy,
				modelVersion: meta.modelVersion || undefined,
				position: listing.position,
				sessionId: getRecommendationSessionId(),
			}]);
		}
	};

		return (
		<section className="mt-12">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-ink">{title}</h2>
				{/* {diagnosticText && (
					<p className="mt-1 text-sm text-ink-muted">{diagnosticText}</p>
				)} */}
			</div>
			<div ref={gridRef} className={`grid ${gridCols} gap-6`}>
				{loading
					? Array.from({ length: skeletonCount }).map((_, i) => (
						<ListingCardSkeleton key={i} />
					))
					: listings.map((listing) => (
						<div
							key={listing.id}
							data-listing-id={listing.id}
						>
							<ListingCard
								listing={listing}
								state={navigationStateForListing(listing, meta, surface)}
								onNavigate={() => handleCardClick(listing)}
							/>
						</div>
					))}
			</div>
		</section>
	);
};

function navigationStateForListing(
	listing: RecommendationListing,
	meta: RecommendationMeta | null,
	surface: RecommendationSurface,
): ListingNavigationState {
	return {
		listingNavigationContext: meta?.requestId
			? {
				source: 'recommendation',
				requestId: meta.requestId,
				listingId: listing.id,
				surface,
				strategy: meta.strategy,
				modelVersion: meta.modelVersion,
				usedFallback: meta.usedFallback,
				personalizedCount: meta.personalizedCount,
				fallbackCount: meta.fallbackCount,
				position: listing.position,
			} satisfies RecommendationNavigationContext
			: null,
	};
}

export default RecommendationGrid;
