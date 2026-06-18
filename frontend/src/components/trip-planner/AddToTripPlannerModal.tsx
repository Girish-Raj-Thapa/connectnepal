import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, Map, Loader2, Search, ChevronDown } from 'lucide-react';
import tripPlannerService from '@services/tripPlanner.service';
import notification from '@utils/notifications';
import type { TripPlanListItem, TripPlanDetail, DurationType } from '@/types/tripPlanner';
import { computeBlockedDays } from '@/types/tripPlanner';
import TripPlanModal from './TripPlanModal';

interface AddToTripPlannerModalProps {
	open: boolean;
	listingId: number;
	listingTitle: string;
	durationType: DurationType;
	durationDays: number;
	onClose: () => void;
}

const AddToTripPlannerModal = ({
	open,
	listingId,
	listingTitle,
	durationType,
	durationDays,
	onClose,
}: AddToTripPlannerModalProps) => {
	const [plans, setPlans] = useState<TripPlanListItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedPlan, setSelectedPlan] = useState<TripPlanListItem | null>(null);
	const [planDetail, setPlanDetail] = useState<TripPlanDetail | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [selectedDay, setSelectedDay] = useState<number | null>(null);
	const [adding, setAdding] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [tripSearch, setTripSearch] = useState('');
	const [isTripMenuOpen, setIsTripMenuOpen] = useState(false);
	const tripPickerRef = useRef<HTMLDivElement | null>(null);

	// Fetch plan list when modal opens
	useEffect(() => {
		if (!open) return;

		setSelectedPlan(null);
		setPlanDetail(null);
		setSelectedDay(null);
		setTripSearch('');
		setIsTripMenuOpen(false);

		const fetchPlans = async () => {
			setLoading(true);
			try {
				const result = await tripPlannerService.listMyTripPlans({
					status: 'planning',
				});
				setPlans(result.results);
			} catch {
				notification.error('Failed to load trip plans');
			} finally {
				setLoading(false);
			}
		};

		void fetchPlans();
	}, [open]);

	useEffect(() => {
		if (!open) return;

		const handlePointerDown = (event: MouseEvent) => {
			if (
				tripPickerRef.current &&
				!tripPickerRef.current.contains(event.target as Node)
			) {
				setIsTripMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		return () => document.removeEventListener('mousedown', handlePointerDown);
	}, [open]);

	// Fetch full plan detail when a plan is selected (to get itemsByDay for day availability)
	useEffect(() => {
		if (!selectedPlan) {
			setPlanDetail(null);
			return;
		}

		setSelectedDay(null);
		setPlanDetail(null);

		const fetchDetail = async () => {
			setLoadingDetail(true);
			try {
				const detail = await tripPlannerService.getTripPlan(selectedPlan.id);
				setPlanDetail(detail);
			} catch {
				notification.error('Failed to load trip details');
				setSelectedPlan(null);
			} finally {
				setLoadingDetail(false);
			}
		};

		void fetchDetail();
	}, [selectedPlan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	// Compute which days are available:
	// - not blocked by existing full_day/multi_day items
	// - not already occupied by any item
	// - listing itself fits within the trip (multi_day overflow check)
	const availableDays = (() => {
		if (!planDetail || !selectedPlan) return [];

		const blockedDays = computeBlockedDays(planDetail.itemsByDay);
		const occupiedDays = new Set(
			Object.entries(planDetail.itemsByDay)
				.filter(([, items]) => items.length > 0)
				.map(([day]) => Number(day)),
		);

		return Array.from({ length: selectedPlan.totalDays }, (_, i) => i + 1).filter(
			(day) => {
				if (blockedDays.has(day) || occupiedDays.has(day)) return false;
				// Multi-day listing: ensure it fits within the trip's total days
				if (durationType === 'multi_day' && durationDays > 1) {
					if (day + durationDays - 1 > selectedPlan.totalDays) return false;
				}
				return true;
			},
		);
	})();

	const handleSelectPlan = (plan: TripPlanListItem) => {
		setSelectedPlan(plan);
		setSelectedDay(null);
		setTripSearch('');
		setIsTripMenuOpen(false);
	};

	const filteredPlans = useMemo(() => {
		const query = tripSearch.trim().toLowerCase();
		if (!query) return plans;
		return plans.filter((plan) => {
			const date = plan.startDate
				? new Date(plan.startDate).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric',
					}).toLowerCase()
				: '';
			return (
				plan.title.toLowerCase().includes(query) ||
				plan.statusDisplay.toLowerCase().includes(query) ||
				date.includes(query)
			);
		});
	}, [plans, tripSearch]);

	const formatTripMeta = (plan: TripPlanListItem) => {
		const parts = [
			`${plan.totalDays} day${plan.totalDays !== 1 ? 's' : ''}`,
			`${plan.itemCount} experience${plan.itemCount !== 1 ? 's' : ''}`,
		];
		if (plan.startDate) {
			parts.push(
				new Date(plan.startDate).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
				}),
			);
		}
		return parts.join(' · ');
	};

	const handleAdd = async (planId: number, dayNumber: number) => {
		setAdding(true);
		try {
			await tripPlannerService.addTripItem(planId, { listingId, dayNumber });
			notification.success(`Added to trip plan!`);
			onClose();
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to add to trip',
			);
		} finally {
			setAdding(false);
		}
	};

	// After creating a new trip, auto-add the listing to day 1 — no extra step needed
	const handlePlanCreated = async (planId: number) => {
		setShowCreateModal(false);
		await handleAdd(planId, 1);
	};

	// Empty-state message for the day picker
	const noAvailableDaysReason = (() => {
		if (!selectedPlan) return '';
		if (durationType === 'multi_day' && durationDays > selectedPlan.totalDays) {
			return `This experience spans ${durationDays} days, but this trip only has ${selectedPlan.totalDays} day${selectedPlan.totalDays !== 1 ? 's' : ''}. Create a longer trip to add it.`;
		}
		return 'All days in this trip are already fully occupied. Try a different trip or create a new one.';
	})();

	if (!open) return null;

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center">
				{/* Backdrop */}
				<div
					className="absolute inset-0 bg-black/40 backdrop-blur-sm"
					onClick={onClose}
				/>

				{/* Modal */}
				<div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl mx-4 z-10 overflow-hidden h-[92vh] max-h-[920px] flex flex-col">
					{/* Header */}
					<div className="flex items-center justify-between px-6 py-5 border-b border-line-muted shrink-0">
						<div className="min-w-0 pr-4">
							<h2 className="section-heading text-ink">
								Add to Trip Planner
							</h2>
							<p className="text-sm text-ink-muted mt-0.5 truncate">
								{listingTitle}
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="p-2 hover:bg-surface-muted rounded-lg transition-colors shrink-0"
						>
							<X className="w-5 h-5 text-ink-muted" />
						</button>
					</div>

					{/* Scrollable content */}
					<div className="p-6 overflow-y-auto grow">
						{/* Trip picker section */}
						<p className="text-sm font-semibold text-ink-secondary mb-3">
							Select a trip to add to:
						</p>

						{loading ? (
							<div className="h-12 bg-surface-muted rounded-xl animate-pulse mb-4" />
						) : plans.length === 0 ? (
							<div className="text-center py-6 text-ink-muted mb-4">
								<Map className="w-8 h-8 mx-auto mb-2 opacity-40" />
								<p className="text-sm font-medium">No active trips yet</p>
								<p className="text-xs mt-1">
									Create a new trip to get started.
								</p>
							</div>
						) : (
							<div className="mb-4 space-y-3">
								<div ref={tripPickerRef} className="relative">
									<div className="relative">
										<span className="absolute inset-y-0 left-0 flex items-center pl-4 text-ink-muted">
											<Search className="w-4 h-4" />
										</span>
										<input
											type="text"
											value={tripSearch}
											onChange={(e) => {
												setTripSearch(e.target.value);
												setIsTripMenuOpen(true);
											}}
											onFocus={() => setIsTripMenuOpen(true)}
											placeholder="Search trips by name or date"
											className="w-full rounded-xl border-2 border-line bg-surface-muted py-3.5 pl-11 pr-10 text-sm text-ink transition-all focus:border-teal-500 focus:bg-surface focus:outline-none"
										/>
										<span className="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-muted">
											<ChevronDown className="w-4 h-4" />
										</span>
									</div>

									{isTripMenuOpen && (
										<div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
											{filteredPlans.length > 0 ? (
												filteredPlans.map((plan) => (
													<button
														key={plan.id}
														type="button"
														onClick={() => handleSelectPlan(plan)}
														className="flex w-full items-start justify-between gap-3 border-b border-line px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-muted"
													>
														<div className="min-w-0">
															<p className="truncate text-sm font-semibold text-ink">
																{plan.title}
															</p>
															<p className="mt-0.5 text-xs text-ink-muted">
																{formatTripMeta(plan)}
															</p>
														</div>
														{selectedPlan?.id === plan.id && (
															<Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
														)}
													</button>
												))
											) : (
												<p className="px-4 py-3 text-sm text-ink-muted">
													No matching trips found.
												</p>
											)}
										</div>
									)}
								</div>

								{selectedPlan ? (
									<div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold text-teal-800">
													{selectedPlan.title}
												</p>
												<p className="mt-0.5 text-xs text-teal-700">
													{formatTripMeta(selectedPlan)}
												</p>
											</div>
											<Check className="w-5 h-5 text-teal-600 shrink-0" />
										</div>
									</div>
								) : (
									<p className="text-xs text-ink-muted">
										Search and select one planning trip to continue.
									</p>
								)}
							</div>
						)}

						{/* Create New Trip button */}
						<button
							type="button"
							onClick={() => setShowCreateModal(true)}
							className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed border-line hover:border-teal-500 hover:bg-teal-50 transition-all text-ink-muted hover:text-teal-600"
						>
							<Plus className="w-5 h-5" />
							<span className="font-semibold text-sm">Create New Trip</span>
						</button>

						{/* Day selector — appears after selecting a plan */}
						{selectedPlan && (
							<div className="mt-5 pt-5 border-t border-line-muted">
								<p className="text-sm font-semibold text-ink-secondary mb-3">
									Which day?
								</p>

								{loadingDetail ? (
									<div className="flex items-center gap-2 text-ink-muted py-2">
										<Loader2 className="w-4 h-4 animate-spin" />
										<span className="text-sm">Checking availability…</span>
									</div>
								) : availableDays.length === 0 ? (
									<p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
										{noAvailableDaysReason}
									</p>
								) : (
									<div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
										{availableDays.map((day) => (
											<button
												key={day}
												type="button"
												onClick={() => setSelectedDay(day)}
												className={`h-11 rounded-lg text-sm font-semibold transition-all ${
													selectedDay === day
														? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
														: 'bg-surface-muted text-ink-muted hover:bg-teal-50 hover:text-teal-600'
												}`}
											>
												{day}
											</button>
										))}
									</div>
								)}
							</div>
						)}
					</div>

					{/* Footer CTA — only visible when plan + day selected */}
					{selectedPlan && selectedDay && (
						<div className="px-6 pb-6 pt-2 shrink-0 border-t border-line-muted">
							<button
								type="button"
								onClick={() => void handleAdd(selectedPlan.id, selectedDay)}
								disabled={adding}
								className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{adding
									? 'Adding...'
									: `Add to Day ${selectedDay} · ${selectedPlan.title}`}
							</button>
						</div>
					)}

					{/* Full-screen adding overlay when auto-adding after trip creation */}
					{adding && !selectedDay && (
						<div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl z-10">
							<div className="flex items-center gap-2 text-teal-600">
								<Loader2 className="w-5 h-5 animate-spin" />
								<span className="font-semibold text-sm">Adding to trip…</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Create Trip sub-modal */}
			<TripPlanModal
				open={showCreateModal}
				mode="create"
				onClose={() => setShowCreateModal(false)}
				onCreated={(planId) => void handlePlanCreated(planId)}
			/>
		</>
	);
};

export default AddToTripPlannerModal;
