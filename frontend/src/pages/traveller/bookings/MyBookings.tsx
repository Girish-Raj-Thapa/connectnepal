import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, generatePath } from 'react-router-dom';
import { Package, AlertCircle, Eye, CreditCard, XCircle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import Pagination from '@components/common/Pagination';
import TableActionIcon from '@components/common/TableActionIcon';
import BookingStatsCards from '@components/bookings/BookingStatsCards';
import FilterTabs from '@components/common/FilterTabs';
import { TravellerBookingService } from '@services/bookings.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@utils/format';
import {
	BOOKING_STATUS_COLORS,
	BOOKING_STATUS_LABELS,
	type Booking,
	type BookingStatus,
} from '@/types/bookings';

type FilterTab = BookingStatus | 'all';

const TABS: { value: FilterTab; label: string }[] = [
	{ value: 'all', label: 'All Bookings' },
	{ value: 'pending_payment', label: 'Pending Payment' },
	{ value: 'confirmed', label: 'Confirmed' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'cancelled', label: 'Cancelled' },
];

const MyBookings = () => {
	const navigate = useNavigate();

	const [bookings, setBookings]     = useState<Booking[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [pageSize, setPageSize]     = useState(0);
	const [page, setPage]             = useState(1);
	const [filter, setFilter]         = useState<FilterTab>('all');
	const [loading, setLoading]       = useState(true);
	const [error, setError]           = useState('');

	const fetchIdRef = useRef(0);

	const fetchBookings = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await TravellerBookingService.list({
				status: filter === 'all' ? undefined : filter,
				page,
			});
			if (currentFetchId !== fetchIdRef.current) return;
			setBookings(data.results);
			setTotalCount(data.count);
			// Derive page size from a full page (next exists) or a single-page result
			if (data.next || !data.previous) {
				setPageSize(data.results.length);
			}
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const msg = err instanceof Error ? err.message : 'Failed to load bookings';
			setError(msg);
			notification.error(msg);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [filter, page]);

	useEffect(() => {
		void fetchBookings();
	}, [fetchBookings]);

	const handleFilterChange = (value: FilterTab) => {
		setFilter(value);
		setPage(1);
	};

	const stats = [
		{
			label:      'Total Bookings',
			value:      totalCount,
			colorClass: 'text-teal-600',
			icon:       <Package className="w-8 h-8" />,
		},
	];

	const tabsWithCount = TABS.map((t) => ({
		...t,
		count: t.value === 'all' ? totalCount : undefined,
	}));

	const viewDetail = (id: number) => {
		void navigate(generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(id) }));
	};

	// Cancel navigates to detail page where the cancel modal lives
	const handleCancel = (id: number) => {
		void navigate(generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(id) }));
	};

	const renderTableStatus = (status: BookingStatus) => {
		const { bg, text } = BOOKING_STATUS_COLORS[status];
		return (
			<span
				className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${bg} ${text}`}
				aria-label={`Booking status: ${BOOKING_STATUS_LABELS[status]}`}
			>
				{BOOKING_STATUS_LABELS[status]}
			</span>
		);
	};

	return (
		<DashboardLayout>
			{/* Header */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6">
					<h1 className="page-heading text-ink">
						My Bookings
					</h1>
					<p className="page-subtext mt-1">
						Track and manage your experience reservations
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
						onClick={() => void fetchBookings()}
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
			{!loading && !error && bookings.length === 0 && (
				<div className="text-center py-16">
					<Package className="w-16 h-16 mx-auto text-line mb-4" />
					<h3 className="card-heading text-ink-secondary mb-2">
						{filter === 'all'
							? 'No bookings yet'
							: `No ${filter.replace('_', ' ')} bookings`}
					</h3>
					<p className="text-ink-muted text-sm">
						{filter === 'all'
							? 'Explore experiences and make your first booking!'
							: 'Try a different filter to see your bookings.'}
					</p>
				</div>
			)}

			{/* Table */}
			{!loading && !error && bookings.length > 0 && (
				<div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full min-w-175">
							<thead>
								<tr className="bg-surface-muted border-b border-line">
									{[
										'Booking Ref',
										// 'Experiences',
										'Date',
										'Amount',
										'Status',
										'Actions',
									].map((h) => (
										<th
											key={h}
											className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wider px-5 py-3 whitespace-nowrap"
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-line-muted">
								{bookings.map((booking) => (
										<tr
											key={booking.id}
											className="hover:bg-surface-muted transition-colors"
										>
											<td className="px-5 py-4">
												<span className="text-sm font-semibold text-ink">
													{booking.reference}
												</span>
											</td>
										{/* <td className="px-5 py-4">
											<div className="max-w-xs">
												<p
													className="text-sm font-medium text-ink-secondary truncate"
													title={itemTitles.length > 0 ? itemTitles.join(', ') : undefined}
												>
													{primaryItemTitle}
												</p>
												{additionalItemsCount > 0 && (
													<p className="meta-text mt-0.5">
														+{additionalItemsCount} more
													</p>
												)}
											</div>
										</td> */}
										<td className="px-5 py-4">
											<span className="text-sm text-ink-muted">
												{formatDate(booking.createdAt)}
											</span>
										</td>
										<td className="px-5 py-4">
											<span className="text-sm font-semibold text-ink-secondary">
												NPR {Number(booking.quotedTotal).toLocaleString()}
											</span>
										</td>
										<td className="px-5 py-4">
											{renderTableStatus(booking.status)}
										</td>
										<td className="px-5 py-4">
											<div className="flex items-center gap-2">
												<TableActionIcon
													label={`View booking ${booking.reference}`}
													tooltip="View"
													onClick={() => viewDetail(booking.id)}
													icon={<Eye className="w-4 h-4" />}
													size="sm"
												/>

												{booking.status === 'pending_payment' && (
													<>
														<TableActionIcon
															label={`Pay for booking ${booking.reference}`}
															tooltip="Pay Now"
															to={generatePath(
																ROUTES.TRAVELLER_BOOKING_PAYMENT,
																{ id: String(booking.id) },
															)}
															icon={<CreditCard className="w-4 h-4" />}
															size="sm"
														/>
														<TableActionIcon
															label={`Cancel booking ${booking.reference}`}
															tooltip="Cancel"
															onClick={() => handleCancel(booking.id)}
															icon={<XCircle className="w-4 h-4" />}
															variant="danger"
															size="sm"
														/>
													</>
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

export default MyBookings;
