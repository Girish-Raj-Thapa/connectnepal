import { useCallback } from 'react';
import {
	Users,
	Briefcase,
	LayoutGrid,
	DollarSign,
	CalendarCheck,
	Package,
	Star,
	AlertTriangle,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import StatCard from '@components/dashboard/StatCard';
import TrendChart from '@components/dashboard/TrendChart';
import CategoryBar from '@components/dashboard/CategoryBar';
import ActivityItem from '@components/dashboard/ActivityItem';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AdminAnalyticsService } from '@services/analytics.service';
import { formatNPR, formatRating, getInitials } from '@utils/format';
import type { AdminTopListing, AdminTopHost } from '@/types/analytics';

// ─── Top Listings Table ────────────────────────────────────────────

const TopListingsSection = ({ listings }: { listings: AdminTopListing[] }) => {
	if (listings.length === 0) return null;

	return (
		<div className="bg-surface rounded-xl border border-line p-5">
			<h3 className="font-bold text-ink mb-4">
				Top Performing Listings
			</h3>

			<div className="space-y-3">
				{listings.map((l) => (
					<div
						key={l.listingId}
						className="flex items-center justify-between p-3 bg-surface-muted rounded-lg"
					>
						<div className="flex-1">
							<div className="font-semibold text-ink text-sm">
								{l.title}
							</div>
							<div className="text-xs text-ink-muted">
								{l.bookingCount} bookings &bull;{' '}
								{formatRating(l.ratingAverage)} rating
							</div>
						</div>

						<div className="text-right">
							<div className="text-xs text-ink-muted">
								by {l.hostName}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

// ─── Top Hosts Table ───────────────────────────────────────────────

/** Gradient color cycle for host avatars. */
const avatarGradients = [
	'from-teal-400 to-teal-600',
	'from-purple-400 to-purple-600',
	'from-blue-400 to-blue-600',
	'from-orange-400 to-orange-600',
	'from-amber-400 to-amber-600',
];

const TopHostsSection = ({ hosts }: { hosts: AdminTopHost[] }) => {
	if (hosts.length === 0) return null;

	return (
		<div className="bg-surface rounded-xl border border-line p-5">
			<h3 className="font-bold text-ink mb-4">
				Top Performing Hosts
			</h3>

			<div className="space-y-3">
				{hosts.map((h, idx) => (
					<div
						key={h.hostId}
						className="flex items-center justify-between p-3 bg-surface-muted rounded-lg"
					>
						<div className="flex items-center gap-3">
							<div
								className={`w-10 h-10 bg-linear-to-br ${
									avatarGradients[idx % avatarGradients.length]
								} rounded-full flex items-center justify-center text-white font-bold text-sm`}
							>
								{getInitials(h.hostName)}
							</div>

							<div>
								<div className="font-semibold text-ink text-sm">
									{h.hostName}
								</div>
								<div className="text-xs text-ink-muted">
									{h.bookingCount} bookings &bull;{' '}
									{formatRating(h.averageRating)} avg rating
								</div>
							</div>
						</div>

						<div className="text-right">
							<div className="text-xs text-ink-muted">
								{h.reviewCount} reviews
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

// ─── Page Component ────────────────────────────────────────────────

const AdminDashboard = () => {
	const fetchOverview = useCallback(
		() => AdminAnalyticsService.getOverview(),
		[],
	);

	const { data, loading, error, refetch } =
		useAnalytics(fetchOverview);

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
					<div className="mb-6">
						<h1 className="page-heading text-ink mb-1">
							System Overview
						</h1>
						<p className="page-subtext">
							Complete analytics and monitoring dashboard
						</p>
					</div>

					{/* KPI Row 1 — Gradient cards */}
					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
						<StatCard
							label="Total Users"
							value={data.summary.totalUsers.toLocaleString()}
							icon={<Users className="w-4 h-4" />}
							color="blue"
						/>
						<StatCard
							label="Active Hosts"
							value={data.summary.activeHosts.toLocaleString()}
							icon={<Briefcase className="w-4 h-4" />}
							color="purple"
						/>
						<StatCard
							label="Total Listings"
							value={data.summary.totalListings.toLocaleString()}
							icon={<LayoutGrid className="w-4 h-4" />}
							color="teal"
						/>
						<StatCard
							label="Total Revenue"
							value={formatNPR(data.summary.totalRevenue, true)}
							icon={<DollarSign className="w-4 h-4" />}
							color="green"
						/>
					</div>

					{/* KPI Row 2 — Plain cards */}
					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
						<StatCard
							label="Total Bookings"
							value={data.summary.totalBookings.toLocaleString()}
							icon={<CalendarCheck className="w-4 h-4" />}
							color="orange"
							variant="plain"
						/>
						<StatCard
							label="Active Packages"
							value={data.summary.activePackages.toLocaleString()}
							icon={<Package className="w-4 h-4" />}
							color="indigo"
							variant="plain"
						/>
						<StatCard
							label="Total Reviews"
							value={data.summary.totalReviews.toLocaleString()}
							subtitle={`Avg: ${formatRating(data.summary.averagePlatformRating)} / 5.0`}
							icon={<Star className="w-4 h-4" />}
							color="amber"
							variant="plain"
						/>
						<StatCard
							label="Open Complaints"
							value={
								data.summary.openComplaints !== null
									? data.summary.openComplaints.toLocaleString()
									: '—'
							}
							subtitle={
								data.summary.openComplaints === null
									? 'Coming soon'
									: undefined
							}
							icon={<AlertTriangle className="w-4 h-4" />}
							color="red"
							variant="plain"
						/>
					</div>

					{/* Charts Row */}
					<div className="grid lg:grid-cols-2 gap-6 mb-6">
						<TrendChart
							title="Monthly Revenue (Last 6 Months)"
							type="bar"
							data={data.trends.monthlyRevenue.map((p) => ({
								month: p.month,
								value: Number(p.amount),
							}))}
							yFormatter={(v) => formatNPR(String(v), true)}
						/>
						<TrendChart
							title="Bookings Trend (Last 6 Months)"
							type="area"
							data={data.trends.monthlyBookings.map((p) => ({
								month: p.month,
								value: p.count,
							}))}
						/>
					</div>

					{/* Category Distribution + Recent Activity */}
					<div className="grid lg:grid-cols-2 gap-6 mb-6">
						<div className="bg-surface rounded-xl border border-line p-5">
							<h3 className="font-bold text-ink mb-4">
								Listings by Category
							</h3>

							<CategoryBar
								items={data.distributions.listingsByCategory.map(
									(c) => ({
										label: c.categoryDisplay,
										count: c.count,
									}),
								)}
							/>
						</div>

						<div className="bg-surface rounded-xl border border-line p-5">
							<h3 className="font-bold text-ink mb-4">
								Recent Activity
							</h3>

							{data.previews.recentActivity.length === 0 ? (
								<p className="text-sm text-ink-muted">
									No recent activity.
								</p>
							) : (
								<div className="space-y-3">
									{data.previews.recentActivity.map((item, idx) => (
										<ActivityItem key={idx} item={item} />
									))}
								</div>
							)}
						</div>
					</div>

					{/* Top Listings + Top Hosts */}
					<div className="grid lg:grid-cols-2 gap-6">
						<TopListingsSection listings={data.topPerformance.listings} />
						<TopHostsSection hosts={data.topPerformance.hosts} />
					</div>
				</>
			)}
		</DashboardLayout>
	);
};

export default AdminDashboard;
