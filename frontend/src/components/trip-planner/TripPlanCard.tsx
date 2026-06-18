import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import type { TripPlanListItem } from '@/types/tripPlanner';

interface TripPlanCardProps {
	plan: TripPlanListItem;
	coverImageOverride?: string | null;
	onEdit?: (plan: TripPlanListItem) => void;
	onDelete?: (plan: TripPlanListItem) => void;
	deleting?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
	planning: 'bg-yellow-500',
	booked: 'bg-emerald-500',
	completed: 'bg-blue-500',
	archived: 'bg-gray-500',
};

/** Format "Created X days ago" from ISO date string */
const formatCreatedAgo = (iso: string): string => {
	const diff = Date.now() - new Date(iso).getTime();
	const days = Math.floor(diff / 86400000);
	if (days === 0) return 'Created today';
	if (days === 1) return 'Created yesterday';
	if (days < 7) return `Created ${days} days ago`;
	if (days < 30) {
		const weeks = Math.floor(days / 7);
		return `Created ${weeks} week${weeks > 1 ? 's' : ''} ago`;
	}
	const months = Math.floor(days / 30);
	return `Created ${months} month${months > 1 ? 's' : ''} ago`;
};

/** Format cost: 45000 → "45K", 1500 → "1.5K" */
const formatCostShort = (cost: string): string => {
	const num = Number(cost);
	if (isNaN(num) || num === 0) return '0';
	if (num >= 1000) {
		const k = num / 1000;
		return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
	}
	return String(num);
};

const TripPlanCard = ({
	plan,
	coverImageOverride,
	onEdit,
	onDelete,
	deleting = false,
}: TripPlanCardProps) => {
	const detailPath = ROUTES.TRAVELLER_TRIP_DETAIL.replace(':id', String(plan.id));
	const coverImage = coverImageOverride || plan.coverImage;
	const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		onEdit?.(plan);
	};
	const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		onDelete?.(plan);
	};

	return (
		<Link
			to={detailPath}
			className="trip-card bg-surface rounded-3xl border border-line overflow-hidden shadow-md cursor-pointer block
				transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]"
		>
			{/* Image / Cover */}
			<div className="relative h-44 overflow-hidden bg-linear-to-br from-gray-200 to-gray-300">
				{(onEdit || onDelete) && (
					<div className="absolute top-4 left-4 z-10 flex gap-2">
						{onEdit && (
							<button
								type="button"
								onClick={handleEdit}
								className="px-3 py-1.5 rounded-xl text-xs font-semibold
									bg-white/90 text-ink-secondary border border-white/70 shadow-sm hover:bg-surface"
							>
								<span className="inline-flex items-center gap-1">
									<Pencil className="w-3.5 h-3.5" />
									Edit
								</span>
							</button>
						)}
						{onDelete && plan.status !== 'archived' && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={deleting}
								className="px-3 py-1.5 rounded-xl text-xs font-semibold
									bg-white/90 text-red-600 border border-white/70 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<span className="inline-flex items-center gap-1">
									<Trash2 className="w-3.5 h-3.5" />
									{deleting ? 'Archiving...' : 'Archive'}
								</span>
							</button>
						)}
					</div>
				)}
				{coverImage ? (
					<img
						src={coverImage}
						alt={plan.title}
						className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center bg-linear-to-br from-teal-100 to-teal-200">
						<svg className="w-16 h-16 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</div>
				)}
				<div className="absolute top-4 right-4">
					<span
						className={`text-[11px] px-2.5 py-1 rounded-xl font-bold uppercase tracking-wide text-white ${STATUS_COLORS[plan.status] ?? 'bg-gray-500'}`}
					>
						{plan.statusDisplay}
					</span>
				</div>
				<div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
				<div className="absolute bottom-4 left-4 right-4">
					<h3 className="font-heading text-2xl font-semibold text-white mb-1">
						{plan.title}
					</h3>
					<p className="text-sm text-white/90">{formatCreatedAgo(plan.createdAt)}</p>
				</div>
			</div>

			{/* Stats */}
			<div className="p-3.5">
				<div className="grid grid-cols-3 gap-3">
					<div className="text-center">
						<div className="text-xl font-bold text-teal-600">{plan.totalDays}</div>
						<div className="text-xs text-ink-muted font-medium">Days</div>
					</div>
					<div className="text-center">
						<div className="text-xl font-bold text-teal-600">{plan.itemCount}</div>
						<div className="text-xs text-ink-muted font-medium">Experiences</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold text-teal-600">
							{formatCostShort(plan.estimatedCost)}
						</div>
						<div className="text-xs text-ink-muted font-medium">NPR</div>
					</div>
				</div>
			</div>
		</Link>
	);
};

export default TripPlanCard;
