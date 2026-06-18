import { useCallback } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import {
	ClipboardList,
	Calendar,
	BadgeCheck,
	Star,
	Plus,
	AlertTriangle,
	Eye,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@context/AuthContext';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import StatCard from '@components/dashboard/StatCard';
import TableActionIcon from '@components/common/TableActionIcon';
import type { StatCardColor } from '@components/dashboard/StatCard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TravellerAnalyticsService } from '@services/analytics.service';
import { formatNPR } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import type {
	TravellerUpcomingBookingPreview,
	TravellerTripPlanPreview,
} from '@/types/analytics';
import {
	BOOKING_STATUS_LABELS,
	type BookingStatus,
} from '@/types/bookings';

// Sub-components (local to this file)

/** Status badge for trip plan statuses (not a BookingStatus). */
const TripStatusBadge = ({ status }: { status: string }) => {
	const colors: Record<string, string> = {
		planning: 'bg-blue-100 text-blue-700',
		active: 'bg-teal-100 text-teal-700',
		completed: 'bg-emerald-100 text-emerald-700',
		cancelled: 'bg-red-100 text-red-700',
	};
	const cls = colors[status] ?? 'bg-surface-muted text-ink-secondary';
	return (
		<span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide ${cls}`}>
			{status.replace(/_/g, ' ')}
		</span>
	);
};

const upcomingBookingStatusClasses: Record<BookingStatus, string> = {
	pending_payment: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100',
	confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
	completed: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100',
	cancelled: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100',
	expired: 'bg-surface-muted text-ink-muted ring-1 ring-inset ring-line',
};

const UpcomingBookingStatusBadge = ({ status }: { status: BookingStatus }) => {
	const label =
		status === 'pending_payment'
			? 'Awaiting Payment'
			: BOOKING_STATUS_LABELS[status];
	const mobileLabel =
		status === 'pending_payment'
			? 'Awaiting'
			: label;

	return (
		<span
			className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap sm:px-2.5 sm:text-[11px] ${upcomingBookingStatusClasses[status]}`}
			aria-label={`Booking status: ${label}`}
		>
			<span className="sm:hidden">{mobileLabel}</span>
			<span className="hidden sm:inline">{label}</span>
		</span>
	);
};

const UpcomingBookingsPreviewTable = ({
	bookings,
}: {
	bookings: TravellerUpcomingBookingPreview[];
}) => {
	const previewBookings = [...bookings]
		.sort((a, b) => (a.startDate ?? '9999-12-31').localeCompare(b.startDate ?? '9999-12-31'))
		.slice(0, 3);

	const previewCount = previewBookings.length;
	const subtitle =
		previewCount === 0
			? 'Showing next 3 bookings'
			: `Showing next ${previewCount} ${previewCount === 1 ? 'booking' : 'bookings'}`;

	return (
		<div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
				<div className="flex items-start justify-between gap-4 border-b border-line-muted px-5 py-5 sm:px-6">
					<div>
						<h2 className="section-heading text-ink">
							Upcoming Bookings
						</h2>
						<p className="meta-text mt-1">
							{subtitle}
						</p>
				</div>

				<Link
					to={ROUTES.TRAVELLER_BOOKINGS}
					className="shrink-0 text-sm font-semibold text-teal-600 hover:text-teal-700"
				>
					View all
				</Link>
			</div>

			{previewCount === 0 ? (
				<div className="px-6 py-10 text-center">
					<Calendar className="w-10 h-10 text-line mx-auto mb-3" />
					<p className="text-sm text-ink-muted">
						No upcoming bookings yet.
					</p>
					<Link
						to={ROUTES.PUBLIC_LISTINGS}
						className="inline-block mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700"
					>
						Discover experiences
					</Link>
				</div>
			) : (
				<div className="px-2 py-2 sm:px-3">
					<table className="w-full table-fixed">
						<thead>
							<tr className="border-b border-line-muted text-left">
								<th className="w-[38%] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:w-[42%] sm:px-4">
									Trip
								</th>
								<th className="w-[18%] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:w-[18%] sm:px-3">
									Date
								</th>
								<th className="w-[18%] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:w-[16%] sm:px-3">
									Price
								</th>
								<th className="w-[18%] px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:w-[16%] sm:px-3">
									Status
								</th>
								<th className="w-[8%] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:w-[8%] sm:px-4">
									View
								</th>
							</tr>
						</thead>

						<tbody className="divide-y divide-line-muted">
							{previewBookings.map((booking) => {
								let bookingDateLabel = 'TBD';

								if (booking.startDate) {
									const startDate = parseISO(booking.startDate);

									if (!booking.endDate || booking.startDate === booking.endDate) {
										bookingDateLabel = format(startDate, 'MMM d');
									} else {
										const endDate = parseISO(booking.endDate);
										const sameYear = startDate.getFullYear() === endDate.getFullYear();
										const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

										if (sameMonth) {
											bookingDateLabel = `${format(startDate, 'MMM d')}-${format(endDate, 'd')}`;
										} else if (sameYear) {
											bookingDateLabel = `${format(startDate, 'MMM d')}-${format(endDate, 'MMM d')}`;
										} else {
											bookingDateLabel = `${format(startDate, 'MMM d, yyyy')}-${format(endDate, 'MMM d, yyyy')}`;
										}
									}
								}

								return (
									<tr
										key={booking.bookingItemId}
										className="group hover:bg-surface-muted/80 transition-colors"
									>
										<td className="px-3 py-3 sm:px-4">
											<Link
												to={ROUTES.TRAVELLER_BOOKING_DETAIL.replace(':id', String(booking.bookingId))}
												className="block min-w-0"
												title={booking.title}
											>
												<span className="block truncate text-xs font-semibold text-ink sm:text-sm">
													{booking.title}
												</span>
											</Link>
										</td>
										<td className="px-2 py-3 text-xs text-ink-muted whitespace-nowrap sm:px-3 sm:text-sm">
											{bookingDateLabel}
										</td>
										<td className="px-2 py-3 text-xs font-semibold text-ink whitespace-nowrap sm:px-3 sm:text-sm">
											{formatNPR(booking.quotedTotal)}
										</td>
										<td className="px-2 py-3 sm:px-3">
										<UpcomingBookingStatusBadge status={booking.status as BookingStatus} />
										</td>
										<td className="px-2 py-3 text-right sm:px-4">
											<div className="flex justify-end">
												<TableActionIcon
													label={`View booking for ${booking.title}`}
													tooltip="View"
													to={ROUTES.TRAVELLER_BOOKING_DETAIL.replace(':id', String(booking.bookingId))}
													icon={<Eye className="w-4 h-4" />}
													size="sm"
												/>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

/** Single trip plan row. */
const TripPlanRow = ({ t }: { t: TravellerTripPlanPreview }) => (
	<Link
		to={ROUTES.TRAVELLER_TRIP_DETAIL.replace(':id', String(t.id))}
		className="block bg-surface rounded-xl border border-line p-4 hover:shadow-md transition-all"
	>
		<div className="flex items-center justify-between mb-2">
			<h3 className="card-heading text-ink">
				{t.title}
			</h3>
			<TripStatusBadge status={t.status} />
		</div>

		<div className="flex items-center justify-between text-xs text-ink-muted">
			<span>{t.statusDisplay}</span>
			<span className="font-semibold text-teal-600">
				{formatNPR(t.estimatedCost)}
			</span>
		</div>
	</Link>
);

// Stat card configs

const statCardConfigs: {
	key: 'activeTripPlans' | 'upcomingBookings' | 'completedTrips' | 'reviewsWritten';
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	color: StatCardColor;
}[] = [
	{ key: 'activeTripPlans',  label: 'Active Trip Plans',   icon: ClipboardList, color: 'teal'   },
	{ key: 'upcomingBookings', label: 'Upcoming Bookings',   icon: Calendar,      color: 'amber'  },
	{ key: 'completedTrips',   label: 'Completed Trips',     icon: BadgeCheck,    color: 'green'  },
	{ key: 'reviewsWritten',   label: 'Reviews Written',     icon: Star,          color: 'purple' },
];

// ─── Quick action configs ──────────────────────────────────────────

const quickActions = [
	{
		label: 'Plan a Trip',
		sub: 'Create itinerary',
		to: ROUTES.TRAVELLER_TRIPS,
		iconBg: 'bg-teal-600',
		icon: Plus,
	},
	{
		label: 'View Bookings',
		sub: 'Check status',
		to: ROUTES.TRAVELLER_BOOKINGS,
		iconBg: 'bg-amber-600',
		icon: Calendar,
	},
	{
		label: 'My Reviews',
		sub: 'Share experience',
		to: ROUTES.TRAVELLER_REVIEWS,
		iconBg: 'bg-purple-600',
		icon: Star,
	},
	{
		label: 'Report Issue',
		sub: 'Submit complaint',
		to: ROUTES.TRAVELLER_COMPLAINTS,
		iconBg: 'bg-red-600',
		icon: AlertTriangle,
	},
];

// Page Component

const TravellerDashboard = () => {
	const { user } = useAuth();

	const fetchOverview = useCallback(
		() => TravellerAnalyticsService.getOverview(),
		[],
	);

	const { data, loading, error, refetch } =
		useAnalytics(fetchOverview);

	const displayName =
		user?.firstName || user?.email || 'Traveller';

	return (
		<DashboardLayout>
			{/* ── Loading ── */}
			{loading && (
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading dashboard..." />
				</div>
			)}

			{/* ── Error ── */}
			{!loading && error && (
				<DashboardError
					message={error}
					onRetry={refetch}
				/>
			)}

			{/* ── Loaded ── */}
			{!loading && !error && data && (
				<>
					{/* Header */}
					<div className="mb-8">
						<h1 className="page-heading text-ink mb-2">
							Welcome back, {displayName}!
						</h1>
						<p className="page-subtext">
							Here's what's happening with your Nepal adventures
						</p>
					</div>

					{/* Stat Cards */}
					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
						{statCardConfigs.map((cfg) => {
							const Icon = cfg.icon;
							return (
								<StatCard
									key={cfg.key}
									label={cfg.label}
									value={data.summary[cfg.key]}
									icon={<Icon className="w-5 h-5" />}
									color={cfg.color}
									variant="plain"
								/>
							);
						})}
					</div>

					{/* Quick Actions */}
					<div className="bg-surface rounded-2xl border border-line p-6 mb-8">
						<h2 className="section-heading text-ink mb-4">
							Quick Actions
						</h2>

						<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{quickActions.map((qa) => {
								const Icon = qa.icon;

								return (
									<Link
										key={qa.label}
										to={qa.to}
										className="flex items-center gap-3 p-4 border-2 border-line rounded-xl hover:border-teal-600 hover:bg-teal-50 transition-all group"
									>
										<div
											className={`w-10 h-10 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform ${qa.iconBg}`}
										>
											<Icon className="w-5 h-5" />
										</div>

										<div>
											<div className="font-semibold text-ink text-sm">
												{qa.label}
											</div>
											<div className="text-xs text-ink-muted">
												{qa.sub}
											</div>
										</div>
									</Link>
								);
							})}
						</div>
					</div>

					{/* Bottom Grid */}
					<div className="grid lg:grid-cols-3 gap-8">
						{/* Upcoming Bookings */}
						<div className="lg:col-span-2">
							<UpcomingBookingsPreviewTable bookings={data.previews.upcomingBookings} />
						</div>

						{/* Right Side */}
						<div className="space-y-8">
							<div>
								<h2 className="section-heading text-ink mb-4">
									My Trip Plans
								</h2>

								<div className="space-y-3">
									{data.previews.tripPlans.length === 0 ? (
										<p className="text-sm text-ink-muted">
											No active trip plans.
										</p>
									) : (
										data.previews.tripPlans.slice(0, 2).map((t) => (
											<TripPlanRow key={t.id} t={t} />
										))
									)}

									<Link
										to={ROUTES.TRAVELLER_TRIPS}
										className="block text-center py-3 border-2 border-dashed border-line rounded-xl text-sm font-semibold text-ink-muted hover:border-teal-600 hover:text-teal-600 transition-all"
									>
										+ Create New Trip
									</Link>
								</div>
							</div>

							{/* Support Card */}
							{/* <div className="bg-surface border border-line rounded-2xl p-5">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
										<AlertTriangle className="w-5 h-5 text-teal-600" />
									</div>
									<div>
										<h3 className="card-heading text-ink">
											Need Help?
										</h3>
										<p className="text-xs text-ink-muted">
											24/7 support available
										</p>
									</div>
								</div>

								<Link
									to={ROUTES.TRAVELLER_COMPLAINTS}
									className="block text-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors w-full"
								>
									Contact Support
								</Link>
							</div> */}
						</div>
					</div>
				</>
			)}
		</DashboardLayout>
	);
};

export default TravellerDashboard;
