import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripPlannerDetailPage from '@pages/traveller/trips/TripPlannerDetail';
import { ROUTES } from '@/constants/routes';
import { ConfirmProvider } from '@context/ConfirmContext';
import type { TripPlanDetail } from '@/types/tripPlanner';

const tripPlannerServiceMock = vi.hoisted(() => ({
	getTripPlan: vi.fn(),
	deleteTripItem: vi.fn(),
	updateTripItem: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/tripPlanner.service', () => ({
	default: tripPlannerServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
}));

vi.mock('@components/trip-planner/TripPlannerHeader', () => ({
	default: ({
		plan,
		onEdit,
		onDelete,
	}: {
		plan: TripPlanDetail;
		onEdit: () => void;
		onDelete?: () => void;
	}) => (
		<div>
			<div>trip header:{plan.title}</div>
			<button type="button" onClick={onEdit}>
				edit trip
			</button>
			{onDelete && (
				<button type="button" onClick={onDelete}>
					archive trip
				</button>
			)}
		</div>
	),
}));

vi.mock('@components/trip-planner/JourneyTimeline', () => ({
	default: ({
		onDeleteItem,
		onMoveItem,
		onEditItem,
		onAddExperience,
	}: {
		onDeleteItem: (itemId: number) => void;
		onMoveItem: (itemId: number, targetDay: number) => void;
		onEditItem: (item: { id: number }) => void;
		onAddExperience: () => void;
	}) => (
		<div>
			<button type="button" onClick={() => onDeleteItem(201)}>
				delete item
			</button>
			<button type="button" onClick={() => onMoveItem(201, 3)}>
				move item
			</button>
			<button type="button" onClick={() => onEditItem({ id: 201 })}>
				edit item
			</button>
			<button type="button" onClick={onAddExperience}>
				open add modal
			</button>
		</div>
	),
}));

vi.mock('@components/trip-planner/TripStatsGrid', () => ({
	default: ({ plan }: { plan: TripPlanDetail }) => <div>trip stats:{plan.estimatedCost}</div>,
}));

vi.mock('@components/trip-planner/AddExperienceModal', () => ({
	default: ({
		open,
		mode = 'create',
		onAdded,
		onUpdated,
	}: {
		open: boolean;
		mode?: 'create' | 'edit';
		onAdded?: () => void;
		onUpdated?: () => void;
	}) =>
		open ? (
			<div>
				<div>{mode === 'edit' ? 'edit experience modal' : 'add experience modal'}</div>
				{mode === 'edit' ? (
					<button type="button" onClick={onUpdated}>
						save item
					</button>
				) : (
					<button type="button" onClick={onAdded}>
						confirm add
					</button>
				)}
			</div>
		) : null,
	}));

vi.mock('@components/trip-planner/TripPlanModal', () => ({
	default: ({
		open,
		onUpdated,
		plan,
	}: {
		open: boolean;
		onUpdated: (plan: TripPlanDetail) => void;
		plan: TripPlanDetail;
	}) =>
		open ? (
			<div>
				<div>edit trip modal</div>
				<button
					type="button"
					onClick={() => onUpdated({ ...plan, title: `${plan.title} Updated` })}
				>
					save trip
				</button>
			</div>
		) : null,
	}));

const renderTripPlannerDetail = (entry = '/traveller/trip-planners/12') =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<ConfirmProvider>
				<Routes>
					<Route path={ROUTES.TRAVELLER_TRIP_DETAIL} element={<TripPlannerDetailPage />} />
					<Route path={ROUTES.TRAVELLER_TRIPS} element={<div>trip list page</div>} />
				</Routes>
			</ConfirmProvider>
		</MemoryRouter>,
	);

const buildPlan = (overrides: Partial<TripPlanDetail> = {}): TripPlanDetail => ({
	id: 12,
	title: 'Spring Nepal Adventure',
	status: 'planning',
	statusDisplay: 'Planning',
	startDate: '2026-05-10',
	endDate: '2026-05-14',
	totalDays: 5,
	travellersCount: 2,
	estimatedCost: '15000',
	coverImage: '',
	itemCount: 1,
	createdAt: '2026-04-01T00:00:00Z',
	updatedAt: '2026-04-02T00:00:00Z',
	itemsByDay: {
		'1': [
			{
				id: 201,
				listing: {
					id: 91,
					title: 'Pokhara Walk',
					slug: 'pokhara-walk',
					destination: 'Pokhara',
					category: 'adventure',
					categoryDisplay: 'Adventure',
					durationType: 'full_day',
					pricePerPerson: '2000',
					durationDisplay: '1 day',
					primaryImageThumbnail: null,
					isBookable: true,
					isActive: true,
				},
				dayNumber: 1,
				order: 0,
				priceSnapshot: '2000',
				durationHoursSnapshot: '6',
				durationTypeSnapshot: 'full_day',
				durationDaysSnapshot: 1,
				durationNightsSnapshot: 0,
				notes: '',
				addedAt: '2026-04-01T00:00:00Z',
				isAvailableForBooking: true,
				availabilityMessage: null,
			},
		],
	},
	...overrides,
});

describe('Trip planner detail page', () => {
	beforeEach(() => {
		tripPlannerServiceMock.getTripPlan.mockReset();
		tripPlannerServiceMock.deleteTripItem.mockReset();
		tripPlannerServiceMock.updateTripItem.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
	});

	it('loads the plan, supports add/edit item flows, and updates the local plan title from the edit modal', async () => {
		tripPlannerServiceMock.getTripPlan.mockResolvedValue(buildPlan());

		const user = userEvent.setup();
		renderTripPlannerDetail();

		expect(await screen.findByText('trip header:Spring Nepal Adventure')).toBeInTheDocument();
		expect(screen.getByText('trip stats:15000')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'open add modal' }));
		expect(screen.getByText('add experience modal')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'confirm add' }));
		expect(notificationMock.success).toHaveBeenCalledWith('Experience added to trip!');
		expect(tripPlannerServiceMock.getTripPlan).toHaveBeenCalledTimes(2);

		await user.click(screen.getByRole('button', { name: 'edit item' }));
		expect(await screen.findByText('edit experience modal')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'save item' }));
		expect(notificationMock.success).toHaveBeenCalledWith('Experience updated');

		await user.click(screen.getByRole('button', { name: 'edit trip' }));
		expect(screen.getByText('edit trip modal')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'save trip' }));
		expect(notificationMock.success).toHaveBeenCalledWith('Trip updated');
		expect(screen.getByText('trip header:Spring Nepal Adventure Updated')).toBeInTheDocument();
	});

	it('deletes and moves items from the journey timeline', async () => {
		tripPlannerServiceMock.getTripPlan.mockResolvedValue(buildPlan());
		tripPlannerServiceMock.deleteTripItem.mockResolvedValue(undefined);
		tripPlannerServiceMock.updateTripItem.mockResolvedValue(buildPlan().itemsByDay['1'][0]);

		const user = userEvent.setup();
		renderTripPlannerDetail();

		expect(await screen.findByText('trip header:Spring Nepal Adventure')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'delete item' }));
		await waitFor(() => {
			expect(tripPlannerServiceMock.deleteTripItem).toHaveBeenCalledWith(12, 201);
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Experience removed');

		await user.click(screen.getByRole('button', { name: 'move item' }));
		await waitFor(() => {
			expect(tripPlannerServiceMock.updateTripItem).toHaveBeenCalledWith(12, 201, {
				dayNumber: 3,
				order: 0,
			});
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Experience moved');
	});

	it('redirects back to the trip list when the plan is not found', async () => {
		tripPlannerServiceMock.getTripPlan.mockRejectedValueOnce(new Error('Not found'));

		renderTripPlannerDetail();

		await waitFor(() => {
			expect(notificationMock.error).toHaveBeenCalledWith('Trip plan not found');
		});
		await waitFor(() => {
			expect(screen.getByText('trip list page')).toBeInTheDocument();
		});
	});
});
