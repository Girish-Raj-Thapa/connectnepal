import PublicPackageCard from '@components/packages/PublicPackageCard';
import type { RecommendationMeta } from '@services/recommendations.service';
import type { RecommendedPackage } from '@/types/packages';

interface PackageRecommendationGridProps {
	title: string;
	packages: RecommendedPackage[];
	meta: RecommendationMeta | null;
	loading: boolean;
	error: string | null;
	columns?: 3 | 4;
	skeletonCount?: number;
}

function PackageCardSkeleton() {
	return (
		<div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden animate-pulse">
			<div className="aspect-video bg-surface-raised" />
			<div className="p-4 space-y-3">
				<div className="h-4 bg-surface-raised rounded w-3/4" />
				<div className="h-3 bg-surface-raised rounded w-1/2" />
				<div className="h-3 bg-surface-raised rounded w-2/3" />
				<div className="h-3 bg-surface-muted rounded w-1/3" />
			</div>
			<div className="px-4 pb-4 pt-2 border-t border-line-muted flex justify-between">
				<div className="h-4 bg-surface-raised rounded w-1/3" />
				<div className="h-4 bg-surface-muted rounded w-1/4" />
			</div>
		</div>
	);
}

const PackageRecommendationGrid = (props: PackageRecommendationGridProps) => {
	const {
		title,
		packages,
		loading,
		error,
		columns = 3,
		skeletonCount = 3,
	} = props;

	if (!loading && (error || packages.length === 0)) return null;

	const gridCols =
		columns === 4
			? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
			: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

	return (
		<section className="mb-10">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-ink">{title}</h2>
			</div>
			<div className={`grid ${gridCols} gap-6`}>
				{loading
					? Array.from({ length: skeletonCount }).map((_, index) => (
						<PackageCardSkeleton key={index} />
					))
					: packages.map((pkg) => <PublicPackageCard key={pkg.id} pkg={pkg} />)}
			</div>
		</section>
	);
};

export default PackageRecommendationGrid;
