import { useState, useRef, useEffect } from 'react';
import { Trash2, MoreVertical, Pencil, AlertTriangle } from 'lucide-react';
import type { TripPlannerItem } from '@/types/tripPlanner';
import Button from '@components/button/Button';

interface JourneyItemCardProps {
	item: TripPlannerItem;
	onDelete: (itemId: number) => void;
	onMove: (itemId: number, targetDay: number) => void;
	onEdit: (item: TripPlannerItem) => void;
	totalDays: number;
	unavailableDays: Set<number>;
	updating?: boolean;
	deleting?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
	trekking: 'bg-teal-600',
	adventure: 'bg-amber-500',
	cultural: 'bg-purple-600',
	nature: 'bg-green-600',
	food_tours: 'bg-orange-500',
	wellness: 'bg-indigo-500',
	photography: 'bg-pink-500',
	heritage: 'bg-rose-600',
	village: 'bg-lime-600',
	festival: 'bg-yellow-500',
};

/**
 * Format the duration subtitle using the snapshotted type + values.
 * - hourly   → "2 hours" / "45 min"
 * - full_day → "Full day"
 * - multi_day → "3 days / 2 nights"
 */
const formatDuration = (item: TripPlannerItem): string => {
	switch (item.durationTypeSnapshot) {
		case 'hourly': {
			const h = parseFloat(item.durationHoursSnapshot);
			if (isNaN(h) || h === 0) return '';
			if (h < 1) return `${Math.round(h * 60)} min`;
			return `${h} hours`;
		}
		case 'full_day':
			return 'Full day';
		case 'multi_day': {
			const days = item.durationDaysSnapshot;
			const nights = item.durationNightsSnapshot;
			if (days && nights) return `${days} days / ${nights} nights`;
			if (days) return `${days} days`;
			return 'Multi-day';
		}
		default:
			return '';
	}
};

const JourneyItemCard = ({
	item,
	onDelete,
	onMove,
	onEdit,
	totalDays,
	unavailableDays,
	updating = false,
	deleting = false,
}: JourneyItemCardProps) => {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [controlsOpen, setControlsOpen] = useState(false);
	const [targetDay, setTargetDay] = useState(item.dayNumber);
	const controlsRef = useRef<HTMLDivElement>(null);

	const handleDeleteClick = () => {
		if (!deleting && !updating) setConfirmOpen(true);
	};

	const handleConfirmDelete = () => {
		if (!deleting && !updating) {
			onDelete(item.id);
			setConfirmOpen(false);
		}
	};

	const handleCancelDelete = () => {
		if (!deleting) setConfirmOpen(false);
	};

	const isTargetUnavailable =
		unavailableDays.has(targetDay) && targetDay !== item.dayNumber;

	const handleMove = () => {
		if (targetDay !== item.dayNumber && !isTargetUnavailable) {
			onMove(item.id, targetDay);
		}
		setControlsOpen(false);
	};

	const categoryColor = CATEGORY_COLORS[item.listing.category] ?? 'bg-gray-500';
	const duration = formatDuration(item);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
				setControlsOpen(false);
			}
		};
		if (controlsOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [controlsOpen]);

	const isUnavailable = item.isAvailableForBooking === false;

	return (
		<>
			<div className={`journey-card bg-surface border rounded-2xl overflow-hidden shadow-md
				transition-all duration-300 hover:-translate-y-1 h-67.5 flex flex-col ${
					isUnavailable ? 'border-amber-300' : 'border-line'
				}`}>
			{/* Image */}
			<div className="relative h-42.5">
				{item.listing.primaryImageThumbnail ? (
					<img
						src={item.listing.primaryImageThumbnail}
						alt={item.listing.title}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full bg-linear-to-br from-gray-200 to-gray-300 flex items-center justify-center">
						<svg className="w-10 h-10 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
				)}
				<div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
				{/* Controls */}
				<div className="absolute top-3 right-3" ref={controlsRef}>
					<button
						type="button"
						onClick={() => setControlsOpen((open) => !open)}
						className="p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
						aria-label="Reorder or move"
					>
						<MoreVertical className="w-4 h-4 text-ink-muted" />
					</button>

					{controlsOpen && (
						<div className="absolute right-0 mt-2 w-52 bg-surface border border-line rounded-xl shadow-lg p-3 z-20">
							<button
								type="button"
								onClick={() => {
									onEdit(item);
									setControlsOpen(false);
								}}
								className="w-full mb-2 px-3 py-2 text-sm font-semibold rounded-lg border border-line text-ink-secondary hover:bg-surface-muted flex items-center justify-center gap-2"
							>
								<Pencil className="w-4 h-4" />
								Edit
							</button>
							<p className="text-xs font-semibold text-ink-secondary mb-2">Move to day</p>
							<select
								value={targetDay}
								onChange={(e) => setTargetDay(Number(e.target.value))}
								className="w-full px-3 py-2 text-sm border border-line rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
								disabled={updating || deleting}
							>
								{Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
									const disabled =
										unavailableDays.has(d) && d !== item.dayNumber;
									return (
										<option key={d} value={d} disabled={disabled}>
											Day {d}
										</option>
									);
								})}
							</select>
							<button
								type="button"
								onClick={handleMove}
								disabled={targetDay === item.dayNumber || isTargetUnavailable || updating || deleting}
								className="mt-2 w-full px-3 py-2 text-sm font-semibold rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Move
							</button>

							{/* Order controls hidden for now */}
						</div>
					)}
				</div>
				{/* Category badge */}
				<div className="absolute bottom-3 left-3 right-3">
					<span className={`px-2 py-1 ${categoryColor} text-white rounded text-xs font-bold`}>
						{item.listing.categoryDisplay}
					</span>
				</div>
			</div>

			{/* Content */}
			<div className="p-4 h-25 flex flex-col">
				{isUnavailable ? (
					<div className="flex items-start gap-2">
						<AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
						<div className="min-w-0">
							<p className="text-xs font-semibold text-amber-700 truncate">
								{item.listing.title}
							</p>
							<p className="text-xs text-amber-600 leading-snug mt-0.5 line-clamp-2">
								{item.availabilityMessage ?? 'Temporarily unavailable'}
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-1">
						<h3 className="font-bold text-ink text-sm truncate">
							{item.listing.title}
						</h3>
						<p className="text-xs text-ink-muted truncate">
							{item.listing.destination}
							{duration && ` \u2022 ${duration}`}
						</p>
					</div>
				)}

				<div className="mt-auto flex items-center justify-between">
					<span className={`text-sm font-bold ${isUnavailable ? 'text-ink-muted' : 'text-teal-600'}`}>
						NPR {Number(item.priceSnapshot).toLocaleString('en-NP')}
					</span>
					<button
						type="button"
						onClick={handleDeleteClick}
						disabled={deleting}
						className="p-1.5 rounded-lg transition-colors text-ink-muted hover:text-red-500 hover:bg-red-50"
						title="Remove"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>

		{confirmOpen && (
			<div className="fixed inset-0 z-50 flex items-center justify-center">
				<div
					className="absolute inset-0 bg-black/40 backdrop-blur-sm"
					onClick={handleCancelDelete}
				/>
				<div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
					<h3 className="card-heading text-ink mb-2">
						Remove experience?
					</h3>
					<p className="text-sm text-ink-muted">
						This will remove <span className="font-semibold">{item.listing.title}</span>{' '}
						from your trip plan.
					</p>
					<div className="flex gap-3 mt-6">
						<Button
							variant="secondary"
							onClick={handleCancelDelete}
							disabled={deleting}
							fullWidth
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleConfirmDelete}
							loading={deleting}
							fullWidth
						>
							Delete
						</Button>
					</div>
				</div>
			</div>
		)}
		</>
	);
};

export default JourneyItemCard;
