import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import TripPlanCard from '@components/trip-planner/TripPlanCard';
import TripStatusTabs from '@components/trip-planner/TripStatusTabs';
import CreateTripModal from '@components/trip-planner/CreateTripModal';
import Loader from '@components/feedback/Loader';
import Pagination from '@components/common/Pagination';
import { useConfirm } from '@context/ConfirmContext';
import tripPlannerService from '@services/tripPlanner.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import type { TripPlanListItem, TripPlanStatus } from '@/types/tripPlanner';
import { getTripCoverFromItems } from '@/types/tripPlanner';

const ITEMS_PER_PAGE = 20;

const TripPlansList = () => {
	const navigate = useNavigate();
	const confirm = useConfirm();

	// ── State ────────────────────────────────────────────
	const [plans, setPlans] = useState<TripPlanListItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<TripPlanStatus | 'all'>('all');
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [coverOverrides, setCoverOverrides] = useState<Record<number, string>>({});
	const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

	const coverCacheRef = useRef<Record<number, { cover: string | null; updatedAt: string; itemCount: number }>>(
		{},
	);

	// Race-condition guard: ignore stale responses
	const fetchIdRef = useRef(0);

	// ── Fetch plans ──────────────────────────────────────
	const fetchPlans = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			const data = await tripPlannerService.listMyTripPlans({
				status: statusFilter === 'all' ? undefined : statusFilter,
				page,
			});
			// Ignore stale response
			if (currentFetchId !== fetchIdRef.current) return;
			setPlans(data.results);
			setTotalCount(data.count);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			notification.error(
				err instanceof Error ? err.message : 'Failed to load trips',
			);
		} finally {
			if (currentFetchId === fetchIdRef.current) {
				setLoading(false);
			}
		}
	}, [statusFilter, page]);

	useEffect(() => {
		void fetchPlans();
	}, [fetchPlans]);

	// ── Resolve cover images from first listing (fallback) ─────────────
	useEffect(() => {
		let cancelled = false;

		const resolveCovers = async () => {
			if (plans.length === 0) return;

			const updates: Record<number, string | null> = {};

			// Clear covers for empty plans
			plans.forEach((plan) => {
				if (plan.itemCount === 0) {
					updates[plan.id] = null;
					coverCacheRef.current[plan.id] = {
						cover: null,
						updatedAt: plan.updatedAt,
						itemCount: plan.itemCount,
					};
				}
			});

			const plansToFetch = plans.filter((plan) => {
				if (plan.itemCount === 0) return false;
				const cached = coverCacheRef.current[plan.id];
				return !cached || cached.updatedAt !== plan.updatedAt || cached.itemCount !== plan.itemCount;
			});

			if (plansToFetch.length === 0) {
				if (!cancelled) {
					setCoverOverrides((prev) => {
						let changed = false;
						const next = { ...prev };
						Object.entries(updates).forEach(([id, cover]) => {
							const planId = Number(id);
							if (!cover && next[planId]) {
								delete next[planId];
								changed = true;
							}
						});
						return changed ? next : prev;
					});
				}
				return;
			}

			await Promise.all(
				plansToFetch.map(async (plan) => {
					try {
						const detail = await tripPlannerService.getTripPlan(plan.id);
						const cover = getTripCoverFromItems(detail.itemsByDay);
						updates[plan.id] = cover;
						coverCacheRef.current[plan.id] = {
							cover,
							updatedAt: plan.updatedAt,
							itemCount: plan.itemCount,
						};
					} catch {
						updates[plan.id] = null;
						coverCacheRef.current[plan.id] = {
							cover: null,
							updatedAt: plan.updatedAt,
							itemCount: plan.itemCount,
						};
					}
				}),
			);

			if (!cancelled) {
				setCoverOverrides((prev) => {
					let changed = false;
					const next = { ...prev };
					Object.entries(updates).forEach(([id, cover]) => {
						const planId = Number(id);
						if (cover) {
							if (next[planId] !== cover) {
								next[planId] = cover;
								changed = true;
							}
						} else if (next[planId]) {
							delete next[planId];
							changed = true;
						}
					});
					return changed ? next : prev;
				});
			}
		};

		void resolveCovers();

		return () => {
			cancelled = true;
		};
	}, [plans]);

	// ── Computed stats ───────────────────────────────────
	// When filter is "all" we can compute tab counts from current page data.
	// Since API supports server-side status filtering, stats are approximate
	// from current page only. For exact counts we'd need separate calls or
	// a stats endpoint. Using client-side counts from current page as best effort.
	const activeCount = plans.filter((p) => p.status === 'planning' || p.status === 'booked').length;
	const completedCount = plans.filter((p) => p.status === 'completed').length;
	const totalExperiences = plans.reduce((sum, p) => sum + p.itemCount, 0);

	const statusTabs = [
		{ value: 'all' as const, label: 'All Trips', count: totalCount },
		{ value: 'planning' as const, label: 'Planning', count: plans.filter((p) => p.status === 'planning').length },
		{ value: 'booked' as const, label: 'Booked', count: plans.filter((p) => p.status === 'booked').length },
		{ value: 'completed' as const, label: 'Completed', count: completedCount },
	];

	// ── Handlers ─────────────────────────────────────────
	const handleStatusChange = (status: TripPlanStatus | 'all') => {
		setStatusFilter(status);
		setPage(1);
	};

	const handleTripCreated = (planId: number) => {
		setShowCreateModal(false);
		notification.success('Trip plan created!');
		void navigate(ROUTES.TRAVELLER_TRIP_DETAIL.replace(':id', String(planId)));
	};

	const handleDeletePlan = async (plan: TripPlanListItem) => {
		const confirmed = await confirm({
			title: 'Archive Trip Plan',
			message: (
				<>
					Archive <span className="font-semibold">"{plan.title}"</span>? It will be
					removed from your active trip plans.
				</>
			),
			confirmLabel: 'Archive Trip',
			variant: 'danger',
		});
		if (!confirmed) return;

		try {
			setDeletingPlanId(plan.id);
			await tripPlannerService.deleteTripPlan(plan.id);
			notification.success('Trip plan archived.');
			await fetchPlans();
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to archive trip plan',
			);
		} finally {
			setDeletingPlanId(null);
		}
	};

	return (
		<DashboardLayout>
			{/* Hero Section */}
			<section
				className="py-8 -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 border-b border-line-muted"
				style={{
					background:
						"linear-gradient(135deg, rgba(13,148,136,0.05) 0%, rgba(20,184,166,0.05) 100%), url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230d9488' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
				}}
			>
				<div className="text-center mb-6">
					<h1 className="page-heading text-ink mb-2">
						My Trip Plans
					</h1>
					<p className="page-subtext max-w-2xl mx-auto">
						Your personalized Nepal adventures
					</p>
				</div>

				{/* Quick Stats */}
				<div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
					<div className="bg-white/80 backdrop-blur-sm border border-line rounded-xl p-3 text-center">
						<div className="text-2xl font-bold text-teal-600 mb-0.5">{activeCount}</div>
						<div className="text-xs text-ink-muted font-medium">Active Trips</div>
					</div>
					<div className="bg-white/80 backdrop-blur-sm border border-line rounded-xl p-3 text-center">
						<div className="text-2xl font-bold text-teal-600 mb-0.5">{completedCount}</div>
						<div className="text-xs text-ink-muted font-medium">Completed</div>
					</div>
					<div className="bg-white/80 backdrop-blur-sm border border-line rounded-xl p-3 text-center">
						<div className="text-2xl font-bold text-teal-600 mb-0.5">{totalExperiences}</div>
						<div className="text-xs text-ink-muted font-medium">Experiences</div>
					</div>
				</div>
			</section>

			{/* Trips Grid */}
			<section className="py-8">
				<TripStatusTabs
					tabs={statusTabs}
					active={statusFilter}
					onChange={handleStatusChange}
				/>

				{loading ? (
					<div className="flex justify-center py-20">
						<Loader text="Loading trip plans..." />
					</div>
				) : plans.length === 0 && statusFilter === 'all' ? (
					// Empty state — no trips at all
					<div className="text-center py-16">
						<svg className="w-20 h-20 mx-auto text-line mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						<h3 className="section-heading text-ink-secondary mb-2">No trip plans yet</h3>
						<p className="text-ink-muted mb-6">Start planning your Nepal adventure!</p>
						<button
							onClick={() => setShowCreateModal(true)}
							className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-teal-500/30"
						>
							Create Your First Trip
						</button>
					</div>
				) : plans.length === 0 ? (
					// Empty for this filter
					<div className="text-center py-16">
						<p className="text-ink-muted">No trips with this status.</p>
					</div>
				) : (
					<>
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
							{/* Create New Trip Card */}
							<button
								onClick={() => setShowCreateModal(true)}
								className="rounded-3xl p-5 flex flex-col items-center justify-center cursor-pointer min-h-70
									border-2 border-dashed border-line hover:border-teal-600 transition-all hover:-translate-y-1
									bg-[linear-gradient(135deg,rgba(13,148,136,0.03)_0%,rgba(20,184,166,0.03)_100%)]
									hover:bg-[linear-gradient(135deg,rgba(13,148,136,0.05)_0%,rgba(20,184,166,0.05)_100%)]"
							>
								<div className="w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-teal-500/30">
									<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
									</svg>
								</div>
								<h3 className="card-heading text-ink mb-1">
									Create New Trip
								</h3>
								<p className="text-xs text-ink-muted">Start planning</p>
							</button>

							{plans.map((plan) => (
								<TripPlanCard
									key={plan.id}
									plan={plan}
									coverImageOverride={coverOverrides[plan.id]}
									onDelete={(target) => void handleDeletePlan(target)}
									deleting={deletingPlanId === plan.id}
								/>
							))}
						</div>

						{totalCount > ITEMS_PER_PAGE && (
							<div className="mt-8">
								<Pagination
									currentPage={page}
									totalCount={totalCount}
									pageSize={ITEMS_PER_PAGE}
									onPageChange={setPage}
								/>
							</div>
						)}
					</>
				)}
			</section>

			<CreateTripModal
				open={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onCreated={handleTripCreated}
			/>
		</DashboardLayout>
	);
};

export default TripPlansList;
