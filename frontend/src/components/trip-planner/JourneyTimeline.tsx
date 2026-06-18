import JourneyItemCard from './JourneyItemCard';
import type { TripPlannerItem, ItemsByDay } from '@/types/tripPlanner';
import { computeBlockedDays } from '@/types/tripPlanner';

interface JourneyTimelineProps {
	itemsByDay: ItemsByDay;
	onDeleteItem: (itemId: number) => void;
	onMoveItem: (itemId: number, targetDay: number) => void;
	onEditItem: (item: TripPlannerItem) => void;
	onAddExperience: () => void;
	deletingItemId: number | null;
	updatingItemId: number | null;
	totalDays: number;
}

const JourneyTimeline = ({
	itemsByDay,
	onDeleteItem,
	onMoveItem,
	onEditItem,
	onAddExperience,
	deletingItemId,
	updatingItemId,
	totalDays,
}: JourneyTimelineProps) => {
	// Flatten items grouped by day into ordered timeline entries
	const timelineItems: {
		dayNumber: number;
		item: TripPlannerItem;
		unavailableDays: Set<number>;
	}[] = [];

	Object.entries(itemsByDay)
		.sort(([a], [b]) => Number(a) - Number(b))
		.forEach(([day, items]) => {
			const sorted = [...items].sort((a, b) => a.order - b.order);
			sorted.forEach((item) => {
				const itemsWithoutCurrent: ItemsByDay = {};
				Object.entries(itemsByDay).forEach(([key, dayItems]) => {
					const filtered = dayItems.filter((entry) => entry.id !== item.id);
					if (filtered.length > 0) {
						itemsWithoutCurrent[key] = filtered;
					}
				});

				const blockedDays = computeBlockedDays(itemsWithoutCurrent);
				const occupiedDays = new Set(
					Object.keys(itemsWithoutCurrent).map((value) => Number(value)),
				);
				const unavailableDays = new Set<number>([
					...blockedDays,
					...occupiedDays,
				]);
				timelineItems.push({
					dayNumber: Number(day),
					item,
					unavailableDays,
				});
			});
		});

	const getDayLabel = (dayNumber: number, item: TripPlannerItem) => {
		if (item.durationTypeSnapshot === 'multi_day') {
			const span = item.durationDaysSnapshot > 0 ? item.durationDaysSnapshot : 1;
			const endDay = dayNumber + span - 1;
			if (endDay > dayNumber) {
				return `Days ${dayNumber}\u2013${endDay}`;
			}
		}
		return `Day ${dayNumber}`;
	};

	return (
		<div className="bg-surface rounded-3xl border-2 border-line-muted p-8 shadow-sm">
			<div
				className="flex gap-6 overflow-x-auto pb-8 pt-4"
				style={{ scrollBehavior: 'smooth' }}
			>
				{timelineItems.length === 0 && (
					<div className="flex items-center justify-center min-w-75 py-8 text-center">
						<p className="text-ink-muted">
							No experiences yet. Add one to start planning!
						</p>
					</div>
				)}

				{timelineItems.map(
					({ dayNumber, item, unavailableDays }, idx) => (
					<div
						key={`${item.id}-${dayNumber}`}
						className="group"
						style={{ minWidth: 280, position: 'relative' }}
					>
						{/* Day badge */}
						<div
							className="absolute -top-3 left-1/2 -translate-x-1/2 z-10
								bg-linear-to-br from-teal-700 to-teal-500 text-white
								px-4 py-1 rounded-full text-xs font-bold
								shadow-md shadow-teal-500/30"
						>
							{getDayLabel(dayNumber, item)}
						</div>

						<JourneyItemCard
							item={item}
							onDelete={onDeleteItem}
							onMove={onMoveItem}
							onEdit={onEditItem}
							totalDays={totalDays}
							unavailableDays={unavailableDays}
							updating={updatingItemId === item.id}
							deleting={deletingItemId === item.id}
						/>

						{/* Connector line */}
						{idx < timelineItems.length - 1 && (
							<div
								className="absolute top-1/2 left-full w-6 h-0.75 -translate-y-1/2 -z-10"
								style={{
									background: 'linear-gradient(to right, #0d9488, #14b8a6)',
								}}
							/>
						)}
					</div>
				))}

				{/* Add Experience tile */}
				<div style={{ minWidth: 200 }} className="flex items-center justify-center">
						<button
							onClick={onAddExperience}
							className="w-full h-67.5 rounded-2xl p-8 flex flex-col items-center justify-center gap-3
								border-2 border-dashed border-teal-300/50 hover:border-teal-500 hover:bg-teal-50/50
								transition-all group"
						>
						<div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 animate-[pulse-ring_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
							<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
						</div>
						<span className="text-sm font-semibold text-ink-muted group-hover:text-teal-600">
							Add Experience
						</span>
					</button>
				</div>
			</div>

			<style>{`
				@keyframes pulse-ring {
					0%, 100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.5); }
					50% { box-shadow: 0 0 0 12px rgba(13, 148, 136, 0); }
				}
			`}</style>
		</div>
	);
};

export default JourneyTimeline;
