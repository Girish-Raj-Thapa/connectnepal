import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
	LayoutGrid,
	CalendarCheck,
	DollarSign,
	Star,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import StatCard from '@components/dashboard/StatCard';
import TrendChart from '@components/dashboard/TrendChart';
import BookingStatusBadge from '@components/bookings/BookingStatusBadge';
import type { BookingStatus } from '@/types/bookings';
import { useAnalytics } from '@/hooks/useAnalytics';
import { HostAnalyticsService } from '@services/analytics.service';
import { formatNPR, formatRating, formatDateRange } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import type {
	HostRecentBookingPreview,
	HostTopPerformingListing,
} from '@/types/analytics';


// ─── Recent Bookings Table ─────────────────────────────────────────

const RecentBookingsTable = ({
	bookings,
}: {
	bookings: HostRecentBookingPreview[];
}) => {
	if (bookings.length === 0) {
		return (
			<div className="bg-surface rounded-2xl border border-line p-8 text-center">
				<CalendarCheck className="w-10 h-10 text-line mx-auto mb-3" />
				<p className="text-ink-muted text-sm">No bookings yet.</p>
			</div>
		);
	}

	return (
		<div className="bg-surface rounded-2xl border border-line overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead className="bg-surface-muted border-b border-line">
						<tr>
							{[
								'Booking ID',
								'Listing',
								'Guest',
								'Date',
								'Amount',
								'Status',
							].map((h) => (
								<th
									key={h}
									className="th-cell"
								>
									{h}
								</th>
							))}
						</tr>
					</thead>

					<tbody className="divide-y divide-line">
						{bookings.map((b) => (
							<tr key={b.bookingItemId} className="hover:bg-surface-muted">
								<td className="px-6 py-4 text-sm font-medium text-ink">
									{b.bookingReference}
								</td>
								<td className="px-6 py-4 text-sm text-ink">
									{b.title}
								</td>
								<td className="px-6 py-4 text-sm text-ink-muted">
									{b.travellerName ?? b.travellerEmail ?? '—'}
								</td>
								<td className="px-6 py-4 text-sm text-ink-muted">
									{formatDateRange(b.startDate, b.endDate)}
								</td>
								<td className="px-6 py-4 text-sm font-semibold text-ink">
									{formatNPR(b.quotedTotal)}
								</td>
								<td className="px-6 py-4">
									<BookingStatusBadge status={b.status as BookingStatus} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

// ─── Top Performing Listings ───────────────────────────────────────

const TopListingsSection = ({
	listings,
}: {
	listings: HostTopPerformingListing[];
}) => {
	if (listings.length === 0) return null;

	return (
		<div className="bg-surface rounded-2xl border border-line overflow-hidden">
			<div className="divide-y divide-line">
				{listings.map((l) => (
					<div
						key={l.listingId}
						className="p-4 hover:bg-surface-muted flex items-center justify-between"
					>
						<div className="flex-1">
							<h3 className="font-bold text-ink">{l.title}</h3>
							<p className="text-sm text-ink-muted">{l.destination}</p>
						</div>

						<div className="text-right">
							<div className="flex items-center gap-1 text-sm mb-1">
								<Star className="w-4 h-4 text-amber-400 fill-amber-400" />
								<span className="font-semibold text-ink">
									{formatRating(l.ratingAverage)}
								</span>
							</div>
							<div className="text-xs text-ink-muted">
								{l.bookingCount} bookings
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

// ─── Page Component ────────────────────────────────────────────────

const HostDashboard = () => {
	const { user } = useAuth();

	const fetchOverview = useCallback(
		() => HostAnalyticsService.getOverview(),
		[],
	);

	const { data, loading, error, refetch } =
		useAnalytics(fetchOverview);

	const displayName = user?.firstName || user?.email || 'Host';

	return (
		<DashboardLayout>
			{loading && (
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading dashboard..." />
				</div>
			)}

			{!loading && error && (
				<DashboardError
					message={error}
					onRetry={refetch}
				/>
			)}

			{!loading && !error && data && (
				<>
					{/* Header */}
					<div className="mb-8">
						<h1 className="page-heading text-ink mb-2">
							Welcome back, {displayName}!
						</h1>
						<p className="page-subtext">
							Here's what's happening with your listings today
						</p>
					</div>

					{/* Stat Cards */}
					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
						<StatCard
							label="Active Listings"
							value={data.summary.activeListings}
							icon={<LayoutGrid className="w-5 h-5" />}
							color="blue"
						/>
						<StatCard
							label="Total Bookings"
							value={data.summary.totalBookings}
							icon={<CalendarCheck className="w-5 h-5" />}
							color="green"
						/>
						<StatCard
							label="This Month"
							value={formatNPR(data.summary.thisMonthEarnings)}
							icon={<DollarSign className="w-5 h-5" />}
							color="teal"
						/>
						<StatCard
							label="Average Rating"
							value={formatRating(data.summary.averageRating)}
							subtitle={`${data.summary.reviewCount} reviews`}
							icon={<Star className="w-5 h-5" />}
							color="amber"
						/>
					</div>

					{/* Charts */}
					<div className="mb-8">
						<h2 className="section-heading text-ink mb-4">
							Analytics
						</h2>

						<div className="grid lg:grid-cols-2 gap-6">
							<TrendChart
								title="Monthly Earnings"
								type="bar"
								data={data.trends.monthlyEarnings.map((p) => ({
									month: p.month,
									value: Number(p.amount),
								}))}
								yFormatter={(v) => formatNPR(String(v), true)}
							/>
							<TrendChart
								title="Bookings Trend"
								type="area"
								data={data.trends.monthlyBookings.map((p) => ({
									month: p.month,
									value: p.count,
								}))}
							/>
						</div>
					</div>

					{/* Recent Bookings */}
					<div className="mb-8">
						<div className="flex items-center justify-between mb-4">
							<h2 className="section-heading text-ink">
								Recent Bookings
							</h2>
							<Link
								to={ROUTES.HOST_BOOKINGS}
								className="text-sm font-semibold text-teal-600 hover:text-teal-700"
							>
								View All →
							</Link>
						</div>

						<RecentBookingsTable bookings={data.previews.recentBookings.slice(0, 3)} />
					</div>

					{/* Top Performing Listings */}
					{data.previews.topPerformingListings.length > 0 && (
						<div>
							<h2 className="section-heading text-ink mb-4">
								Top Performing Listings
							</h2>
							<TopListingsSection
								listings={data.previews.topPerformingListings.slice(0, 3)}
							/>
						</div>
					)}
				</>
			)}
		</DashboardLayout>
	);
};

export default HostDashboard;
