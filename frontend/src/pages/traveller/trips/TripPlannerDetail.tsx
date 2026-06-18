import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import TripPlannerHeader from '@components/trip-planner/TripPlannerHeader';
import JourneyTimeline from '@components/trip-planner/JourneyTimeline';
import TripStatsGrid from '@components/trip-planner/TripStatsGrid';
import AddExperienceModal from '@components/trip-planner/AddExperienceModal';
import TripPlanModal from '@components/trip-planner/TripPlanModal';
import Loader from '@components/feedback/Loader';
import { useConfirm } from '@context/ConfirmContext';
import tripPlannerService from '@services/tripPlanner.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import { computeBlockedDays } from '@/types/tripPlanner';
import type { TripPlanDetail, TripPlannerItem } from '@/types/tripPlanner';

const TripPlannerDetailPage = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const confirm = useConfirm();

	const [plan, setPlan] = useState<TripPlanDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showAddModal, setShowAddModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showEditPlanModal, setShowEditPlanModal] = useState(false);
	const [editingItem, setEditingItem] = useState<TripPlannerItem | null>(null);
	const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
	const [deletingPlan, setDeletingPlan] = useState(false);
	const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

	// Race-condition guard
	const fetchIdRef = useRef(0);

	const planId = Number(id);

	const fetchPlan = useCallback(async () => {
		if (!planId || isNaN(planId)) {
			setError('Invalid trip plan ID');
			setLoading(false);
			return;
		}

		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await tripPlannerService.getTripPlan(planId);
			if (currentFetchId !== fetchIdRef.current) return;
			setPlan(data);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const message = err instanceof Error ? err.message : 'Failed to load trip plan';
			setError(message);
				if (message.includes('Not found')) {
					notification.error('Trip plan not found');
					void navigate(ROUTES.TRAVELLER_TRIPS, { replace: true });
				}
		} finally {
			if (currentFetchId === fetchIdRef.current) {
				setLoading(false);
			}
		}
	}, [planId, navigate]);

	useEffect(() => {
		void fetchPlan();
	}, [fetchPlan]);

	// delete item
	const handleDeleteItem = async (itemId: number) => {
		if (!plan) return;
		try {
			setDeletingItemId(itemId);
			await tripPlannerService.deleteTripItem(plan.id, itemId);
			notification.success('Experience removed');
			// Refetch to get updated estimated_cost and item_count
			void fetchPlan();
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to remove item',
			);
		} finally {
			setDeletingItemId(null);
		}
	};

	// item added callback
	const handleItemAdded = () => {
		setShowAddModal(false);
		notification.success('Experience added to trip!');
		void fetchPlan();
	};

	// item updated callback
	const handleItemUpdated = () => {
		setShowEditModal(false);
		setEditingItem(null);
		notification.success('Experience updated');
		void fetchPlan();
	};

	const handlePlanUpdated = (updated: TripPlanDetail) => {
		setShowEditPlanModal(false);
		setPlan(updated);
		notification.success('Trip updated');
	};

	const handleEditItem = (item: TripPlannerItem) => {
		setEditingItem(item);
		setShowEditModal(true);
	};

	const handleDeletePlan = async () => {
		if (!plan) return;
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
			setDeletingPlan(true);
			await tripPlannerService.deleteTripPlan(plan.id);
			notification.success('Trip plan archived.');
			void navigate(ROUTES.TRAVELLER_TRIPS, { replace: true });
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to archive trip plan',
			);
		} finally {
			setDeletingPlan(false);
		}
	};

	const removeItemFromItemsByDay = (
		itemsByDay: TripPlanDetail['itemsByDay'],
		itemId: number,
	) => {
		const filtered: TripPlanDetail['itemsByDay'] = {};
		Object.entries(itemsByDay).forEach(([day, items]) => {
			filtered[day] = items.filter((item) => item.id !== itemId);
		});
		return filtered;
	};

	// move item to another day (append to end of that day)
	const handleMoveItem = async (itemId: number, targetDay: number) => {
		if (!plan) return;
		try {
			setUpdatingItemId(itemId);
			const targetItems = plan.itemsByDay[String(targetDay)] ?? [];
			const nextOrder =
				targetItems.reduce((max, item) => Math.max(max, item.order), -1) + 1;
			await tripPlannerService.updateTripItem(plan.id, itemId, {
				dayNumber: targetDay,
				order: nextOrder,
			});
			notification.success('Experience moved');
			void fetchPlan();
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to move item',
			);
		} finally {
			setUpdatingItemId(null);
		}
	};


	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex justify-center py-20">
					<Loader text="Loading trip plan..." />
				</div>
			</DashboardLayout>
		);
	}

	if (error || !plan) {
		return (
			<DashboardLayout>
				<div className="text-center py-20">
					<p className="text-ink-muted">{error || 'Trip plan not found'}</p>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<TripPlannerHeader
				plan={plan}
				onEdit={() => setShowEditPlanModal(true)}
				onDelete={() => void handleDeletePlan()}
				deleting={deletingPlan}
			/>

			{/* Journey Timeline */}
			<div className="mb-8">
				<JourneyTimeline
					itemsByDay={plan.itemsByDay}
					onDeleteItem={(itemId) => void handleDeleteItem(itemId)}
					onMoveItem={(itemId, targetDay) => void handleMoveItem(itemId, targetDay)}
					onEditItem={handleEditItem}
					onAddExperience={() => setShowAddModal(true)}
					deletingItemId={deletingItemId}
					updatingItemId={updatingItemId}
					totalDays={plan.totalDays}
				/>
			</div>

			{/* Trip Stats */}
			<TripStatsGrid plan={plan} />

			{/* Add Experience Modal */}
			<AddExperienceModal
				open={showAddModal}
				onClose={() => setShowAddModal(false)}
				planId={plan.id}
				totalDays={plan.totalDays}
				blockedDays={computeBlockedDays(plan.itemsByDay)}
				itemsByDay={plan.itemsByDay}
				onAdded={handleItemAdded}
			/>

			{/* Edit Experience Modal */}
			<AddExperienceModal
				open={showEditModal}
				onClose={() => {
					setShowEditModal(false);
					setEditingItem(null);
				}}
				mode="edit"
				initialItem={editingItem}
				planId={plan.id}
				totalDays={plan.totalDays}
				blockedDays={
					editingItem
						? computeBlockedDays(
								removeItemFromItemsByDay(plan.itemsByDay, editingItem.id),
							)
						: computeBlockedDays(plan.itemsByDay)
				}
				itemsByDay={
					editingItem
						? removeItemFromItemsByDay(plan.itemsByDay, editingItem.id)
						: plan.itemsByDay
				}
				onAdded={handleItemAdded}
				onUpdated={handleItemUpdated}
			/>

			{/* Edit Trip Modal */}
			<TripPlanModal
				open={showEditPlanModal}
				mode="edit"
				plan={plan}
				onClose={() => setShowEditPlanModal(false)}
				onUpdated={handlePlanUpdated}
			/>
		</DashboardLayout>
	);
};

export default TripPlannerDetailPage;
