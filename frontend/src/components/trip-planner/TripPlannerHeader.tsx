import { Link, useNavigate, generatePath } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import type { TripPlanDetail } from '@/types/tripPlanner';

interface TripPlannerHeaderProps {
	plan: TripPlanDetail;
	onEdit?: () => void;
	onDelete?: () => void;
	deleting?: boolean;
}

const TripPlannerHeader = ({
	plan,
	onEdit,
	onDelete,
	deleting = false,
}: TripPlannerHeaderProps) => {
	const navigate = useNavigate();

	const handleBookTrip = () => {
		void navigate(
			generatePath(ROUTES.TRAVELLER_BOOK_FROM_TRIP, { planId: String(plan.id) }),
		);
	};

	return (
		<>
			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8">
				<div className="py-3">
					<div className="flex items-center gap-2 text-sm">
						<Link
							to={ROUTES.TRAVELLER_TRIPS}
							className="text-ink-muted hover:text-teal-600 transition-colors"
						>
							My Trips
						</Link>
						<span className="text-line">/</span>
						<span className="text-ink font-medium">{plan.title}</span>
					</div>
				</div>
			</div>

			{/* Title + Meta */}
			<div className="flex items-center justify-between mb-6 mt-8">
				<div>
					<h2 className="page-heading text-ink mb-2">
						{plan.title}
					</h2>
				</div>
				<div className="flex items-center gap-3">
					{onEdit && (
						<button
							onClick={onEdit}
							className="px-4 py-2 border border-teal-200 text-teal-700 rounded-xl font-semibold text-sm
								hover:bg-teal-50 transition-colors"
						>
							Edit Trip
						</button>
					)}
					{onDelete && plan.status !== 'archived' && (
						<button
							onClick={onDelete}
							disabled={deleting}
							className="px-4 py-2 border border-red-200 text-red-600 rounded-xl font-semibold text-sm
								hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span className="inline-flex items-center gap-1.5">
								<Trash2 className="w-4 h-4" />
								{deleting ? 'Archiving...' : 'Archive Trip'}
							</span>
						</button>
					)}
					<button
						onClick={handleBookTrip}
						disabled={plan.status !== 'planning'}
						title={
							plan.status !== 'planning'
								? 'Only trips in Planning status can be booked'
								: 'Book all experiences in this trip'
						}
						className="px-6 py-2 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Book Trip
					</button>
				</div>
			</div>
		</>
	);
};

export default TripPlannerHeader;
