import { formatNPR } from '@utils/format';
import type { TripPlanDetail } from '@/types/tripPlanner';

interface TripStatsGridProps {
	plan: TripPlanDetail;
}

const TripStatsGrid = ({ plan }: TripStatsGridProps) => {
	return (
		<div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden mt-8">
			<div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
				<div className="p-6 text-center hover:bg-surface-muted transition-colors">
					<div className="text-3xl font-bold text-teal-600 mb-1">{plan.totalDays}</div>
					<div className="text-sm font-medium text-ink-muted">Total Days</div>
				</div>
				<div className="p-6 text-center hover:bg-surface-muted transition-colors">
					<div className="text-3xl font-bold text-teal-600 mb-1">{plan.itemCount}</div>
					<div className="text-sm font-medium text-ink-muted">Experiences</div>
				</div>
				<div className="p-6 text-center hover:bg-surface-muted transition-colors">
					<div className="text-3xl font-bold text-teal-600 mb-1">
						{formatNPR(plan.estimatedCost, true)}
					</div>
					<div className="text-sm font-medium text-ink-muted">Estimated Cost</div>
				</div>
				<div className="p-6 text-center hover:bg-surface-muted transition-colors">
					<div className="text-3xl font-bold text-teal-600 mb-1">{plan.travellersCount}</div>
					<div className="text-sm font-medium text-ink-muted">Travellers</div>
				</div>
			</div>
		</div>
	);
};

export default TripStatsGrid;
