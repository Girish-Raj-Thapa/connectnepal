import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, generatePath } from 'react-router-dom';
import {
	Package,
	Clock,
	CheckCircle,
	XCircle,
	AlertCircle,
	Eye,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import Pagination from '@components/common/Pagination';
import TableActionIcon from '@components/common/TableActionIcon';
import BookingStatusBadge from '@components/bookings/BookingStatusBadge';
import BookingStatsCards from '@components/bookings/BookingStatsCards';
import FilterTabs from '@components/common/FilterTabs';
import { useConfirm } from '@context/ConfirmContext';
import { HostBookingService } from '@services/bookings.service';
import notification from '@utils/notifications';
import { formatDateRange } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import { getBookingItemTitle } from '@/utils/bookingItemHelpers';
import type { HostBookingItem, BookingStatus } from '@/types/bookings';

type FilterTab = BookingStatus | 'all';

const TABS: { value: FilterTab; label: string }[] = [
	{ value: 'all',             label: 'All' },
	{ value: 'pending_payment', label: 'Pending' },
	{ value: 'confirmed',       label: 'Confirmed' },
	{ value: 'completed',       label: 'Completed' },
	{ value: 'cancelled',       label: 'Cancelled' },
];

const ManageBookings = () => {
	const navigate = useNavigate();
	const confirm = useConfirm();

	const [items, setItems]           = useState<HostBookingItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [pageSize, setPageSize]     = useState(0);
	const [page, setPage]             = useState(1);
	const [filter, setFilter]         = useState<FilterTab>('all');
	const [loading, setLoading]       = useState(true);
	const [error, setError]           = useState('');

	// Stable counts from the last unfiltered ('all') fetch — don't reset on filter change
	const [statusCounts, setStatusCounts] = useState({
		pending: 0, confirmed: 0, completed: 0, cancelled: 0,
	});

	// Optimistic mark-completed — tracks which row is in-flight
	const [markingId, setMarkingId] = useState<number | null>(null);

	const fetchIdRef = useRef(0);

	const fetchItems = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await HostBookingService.listItems({
				status: filter === 'all' ? undefined : filter,
				page,
			});
			if (currentFetchId !== fetchIdRef.current) return;
			setItems(data.results);
			setTotalCount(data.count);
			if (data.next || !data.previous) {
				setPageSize(data.results.length);
			}
			// Only snapshot per-status counts from the unfiltered view
			if (filter === 'all') {
				setStatusCounts({
					pending:   data.results.filter((i) => i.status === 'pending_payment').length,
					confirmed: data.results.filter((i) => i.status === 'confirmed').length,
					completed: data.results.filter((i) => i.status === 'completed').length,
					cancelled: data.results.filter((i) => i.status === 'cancelled').length,
				});
			}
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const msg =
				err instanceof Error ? err.message : 'Failed to load bookings';
			setError(msg);
			notification.error(msg);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [filter, page]);

	useEffect(() => {
		void fetchItems();
	}, [fetchItems]);

	const handleFilterChange = (value: FilterTab) => {
		setFilter(value);
		setPage(1);
	};

	const handleMarkCompleted = async (itemId: number) => {
		const confirmed = await confirm({
			title: 'Mark as Completed',
			message: 'Confirm this booking is completed? This cannot be reversed.',
			confirmLabel: 'Mark Completed',
			variant: 'primary',
		});
		if (!confirmed) return;
		try {
			setMarkingId(itemId);
			await HostBookingService.markCompleted(itemId);
			notification.success('Booking marked as completed.');
			void fetchItems();
		} catch (err) {
			notification.error(
				err instanceof Error ? err.message : 'Failed to mark as completed',
			);
		} finally {
			setMarkingId(null);
		}
	};

	const stats = [
		{
			label:      'Pending',
			value:      statusCounts.pending,
			colorClass: 'text-amber-600',
			icon:       <Clock className="w-8 h-8" />,
		},
		{
			label:      'Confirmed',
			value:      statusCounts.confirmed,
			colorClass: 'text-emerald-600',
			icon:       <CheckCircle className="w-8 h-8" />,
		},
		{
			label:      'Completed',
			value:      statusCounts.completed,
			colorClass: 'text-teal-600',
			icon:       <Package className="w-8 h-8" />,
		},
		{
			label:      'Cancelled',
			value:      statusCounts.cancelled,
			colorClass: 'text-red-500',
			icon:       <XCircle className="w-8 h-8" />,
		},
	];

	const tabsWithCount = TABS.map((t) => ({
		...t,
		count: t.value === 'all' ? totalCount : undefined,
	}));

	const viewDetail = (id: number) => {
		void navigate(
			generatePath(ROUTES.HOST_BOOKING_DETAIL, { itemId: String(id) }),
		);
	};

	return (
		<DashboardLayout>
			{/* Header */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6">
					<h1 className="page-heading text-ink">
						Manage Bookings
					</h1>
					<p className="page-subtext mt-1">
						Track reservations across all your listings
					</p>
				</div>
			</div>

			<BookingStatsCards stats={stats} loading={loading} />
			<FilterTabs
				tabs={tabsWithCount}
				active={filter}
				onChange={handleFilterChange}
			/>

			{/* Error state */}
			{error && !loading && (
				<div className="flex flex-col items-center py-16 gap-4">
					<AlertCircle className="w-12 h-12 text-red-400" />
					<p className="text-ink-muted">{error}</p>
					<button
						onClick={() => void fetchItems()}
						className="px-5 py-2 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors"
					>
						Retry
					</button>
				</div>
			)}

			{/* Loading state */}
			{loading && (
				<div className="flex justify-center py-20">
					<Loader text="Loading bookings..." />
				</div>
			)}

			{/* Empty state */}
			{!loading && !error && items.length === 0 && (
				<div className="text-center py-16">
					<Package className="w-16 h-16 mx-auto text-line mb-4" />
					<h3 className="card-heading text-ink-secondary mb-2">
						{filter === 'all'
							? 'No bookings yet'
							: `No ${filter.replace('_', ' ')} bookings`}
					</h3>
					<p className="text-ink-muted text-sm">
						Bookings for your listings will appear here.
					</p>
				</div>
			)}

			{/* Table */}
			{!loading && !error && items.length > 0 && (
				<div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[900px]">
							<thead>
								<tr className="bg-surface-muted border-b border-line">
									{[
										'Booking Ref',
										'Guest',
										'Listing',
										'Date',
										'Travellers',
										'Amount',
										'Status',
										'Actions',
									].map((h) => (
										<th
											key={h}
											className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap"
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-line-muted">
									{items.map((item) => (
										<tr
											key={item.id}
											className="hover:bg-surface-muted transition-colors"
									>
										<td className="px-4 py-4">
											<span className="reference-code">
												{item.bookingReference}
											</span>
										</td>
										<td className="px-4 py-4">
											<p className="text-sm font-semibold text-ink-secondary">
												{item.travellerName}
											</p>
											{item.travellerEmail && (
												<p className="text-xs text-ink-muted">
													{item.travellerEmail}
												</p>
											)}
											</td>
											<td className="px-4 py-4">
												{item.durationType === 'package' ? (
													<div className="flex items-center gap-2 max-w-[220px]">
														<p className="text-sm text-ink-secondary max-w-[160px] truncate">
															{getBookingItemTitle(item)}
														</p>
														<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold border border-teal-200 uppercase tracking-wide">
															Package
														</span>
													</div>
												) : (
													<p className="text-sm text-ink-secondary max-w-[160px] truncate">
														{item.listingTitle}
													</p>
												)}
											</td>
										<td className="px-4 py-4 whitespace-nowrap">
											<p className="text-sm text-ink-muted">
												{formatDateRange(item.startDate, item.endDate)}
											</p>
										</td>
										<td className="px-4 py-4 text-sm text-ink-muted text-center">
											{item.travellerCount}
										</td>
										<td className="px-4 py-4 text-sm font-semibold text-ink-secondary whitespace-nowrap">
											NPR {Number(item.quotedTotal).toLocaleString()}
										</td>
										<td className="px-4 py-4">
											<BookingStatusBadge status={item.status} size="sm" />
										</td>
										<td className="px-4 py-4">
											<div className="flex items-center gap-2 justify-end">
												<TableActionIcon
													label={`View booking ${item.bookingReference}`}
													tooltip="View"
													onClick={() => viewDetail(item.id)}
													icon={<Eye className="w-4 h-4" />}
													size="sm"
												/>
												{item.status === 'confirmed' && (
													<button
														onClick={() => { void handleMarkCompleted(item.id); }}
														disabled={markingId === item.id}
														className="px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
														aria-label={`Mark ${item.bookingReference} as completed`}
													>
														{markingId === item.id ? '…' : 'Mark Done'}
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Pagination */}
			{pageSize > 0 && (
				<div className="mt-6">
					<Pagination
						currentPage={page}
						totalCount={totalCount}
						pageSize={pageSize}
						onPageChange={(p) => setPage(p)}
					/>
				</div>
			)}
		</DashboardLayout>
	);
};

export default ManageBookings;
