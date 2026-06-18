import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Search, AlertTriangle } from 'lucide-react';
import { useDebounce } from '@hooks/useDebounce';
import Button from '@components/button/Button';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import FilterTabs from '@components/common/FilterTabs';
import BookingStatusBadge from '@components/bookings/BookingStatusBadge';
import PaymentStatusBadge from '@components/bookings/PaymentStatusBadge';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { AdminBookingService } from '@services/admin.service';
import { formatDate, formatNPR } from '@utils/format';
import notification from '@utils/notifications';
import type { AdminBookingListItem } from '@/types/admin';

type BookingFilter = 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled';

const BOOKING_TABS: { value: BookingFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'confirmed', label: 'Confirmed' },
	{ value: 'pending', label: 'Pending' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'cancelled', label: 'Cancelled' },
];

const filterToStatus = (filter: BookingFilter): string | undefined => {
	if (filter === 'all') return undefined;
	return filter;
};

const AdminBookings = () => {
	const [filter, setFilter] = useState<BookingFilter>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const debouncedSearch = useDebounce(searchQuery);
	const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [cancelTarget, setCancelTarget] = useState<{ id: number; note: string } | null>(null);
	const [cancellingId, setCancellingId] = useState<number | null>(null);

	const fetchBookings = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await AdminBookingService.list({
				page,
				status: filterToStatus(filter),
				search: debouncedSearch.trim() || undefined,
			});
			setBookings(data.results);
			setTotalCount(data.count);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load bookings');
		} finally {
			setLoading(false);
		}
	}, [filter, page, debouncedSearch]);

	useEffect(() => {
		void fetchBookings();
	}, [fetchBookings]);

	const handleFilterChange = (newFilter: BookingFilter) => {
		setFilter(newFilter);
		setPage(1);
	};

	const handleCancel = (bookingId: number) => {
		setCancelTarget({ id: bookingId, note: '' });
	};

	const handleCancelConfirm = async () => {
		if (!cancelTarget) return;
		try {
			setCancellingId(cancelTarget.id);
			await AdminBookingService.cancel(
				cancelTarget.id,
				cancelTarget.note.trim() ? { note: cancelTarget.note.trim() } : undefined,
			);
			notification.success('Booking cancelled');
			setCancelTarget(null);
			void fetchBookings();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to cancel booking');
		} finally {
			setCancellingId(null);
		}
	};


	return (
		<DashboardLayout>
			{/* Header */}
			<div className="mb-6">
				<h1 className="page-heading text-ink flex items-center gap-2">
					<CalendarDays className="w-6 h-6 text-teal-600" />
					Manage Bookings
				</h1>
				<p className="page-subtext mt-1">
					Monitor and manage all platform bookings
				</p>
			</div>

			{/* Search Bar */}
			<div className="mb-4">
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setPage(1);
						}}
						placeholder="Search by booking reference or traveller..."
						className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none"
					/>
				</div>
			</div>

			{/* Filter tabs */}
			<FilterTabs tabs={BOOKING_TABS} active={filter} onChange={handleFilterChange} />

			{/* Content */}
			{loading && (
				<div className="py-16">
					<Loader size="lg" text="Loading bookings..." />
				</div>
			)}

			{!loading && error && <DashboardError message={error} onRetry={() => void fetchBookings()} />}

			{!loading && !error && bookings.length === 0 && (
				<div className="text-center py-16">
					<CalendarDays className="w-12 h-12 text-line mx-auto mb-4" />
					<h3 className="card-heading text-ink mb-1">No bookings found</h3>
					<p className="text-ink-muted text-sm">No bookings match the current filter.</p>
				</div>
			)}

			{!loading && !error && bookings.length > 0 && (
				<>
					<div className="bg-surface rounded-2xl border border-line overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-surface-muted border-b border-line">
									<tr>
										<th className="th-cell">
											Reference
										</th>
										<th className="th-cell">
											Traveller
										</th>
										<th className="th-cell">
											Items
										</th>
										<th className="th-cell">
											Total
										</th>
										<th className="th-cell">
											Status
										</th>
										<th className="th-cell">
											Payment
										</th>
										<th className="th-cell">
											Date
										</th>
										<th className="th-cell">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line">
									{bookings.map((b) => {
										const isCancellable =
											b.status !== 'cancelled' && b.status !== 'completed';

										return (
											<tr key={b.id} className="hover:bg-surface-muted">
												<td className="px-6 py-4">
													<span className="reference-code">
														{b.reference}
													</span>
												</td>
												<td className="px-6 py-4">
													<div className="text-sm font-medium text-ink">
														{b.travellerName}
													</div>
													<div className="text-xs text-ink-muted">{b.travellerEmail}</div>
												</td>
												<td className="px-6 py-4 text-sm text-ink-muted">{b.itemCount}</td>
												<td className="px-6 py-4 text-sm font-semibold text-ink">
													{formatNPR(b.quotedTotal)}
												</td>
												<td className="px-6 py-4">
													<BookingStatusBadge status={b.status} />
												</td>
												<td className="px-6 py-4">
													<PaymentStatusBadge status={b.paymentStatus} />
												</td>
												<td className="px-6 py-4 text-sm text-ink-muted">
													{formatDate(b.createdAt)}
												</td>
												<td className="px-6 py-4">
													{isCancellable && (
														<button
															type="button"
															onClick={() => handleCancel(b.id)}
															disabled={cancellingId === b.id}
															className="text-red-600 hover:text-red-700 font-semibold text-sm disabled:opacity-50"
														>
															{cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
														</button>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>

					{/* Pagination */}
					<div className="mt-6">
						<Pagination
							currentPage={page}
							totalCount={totalCount}
							onPageChange={setPage}
						/>
					</div>
				</>
			)}
			{/* Cancel Confirmation Modal */}
			{cancelTarget && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
								<AlertTriangle className="w-5 h-5 text-red-600" />
							</div>
							<h3 className="card-heading text-ink">Cancel Booking</h3>
						</div>
						<p className="text-sm text-ink-muted mb-4">
							This will cancel the booking and notify the traveller. This action cannot be undone.
						</p>
						<div className="mb-6">
							<label className="block text-sm font-medium text-ink-secondary mb-1">
								Cancellation note <span className="text-ink-muted font-normal">(optional)</span>
							</label>
							<textarea
								value={cancelTarget.note}
								onChange={(e) => setCancelTarget({ ...cancelTarget, note: e.target.value })}
								placeholder="Reason for cancellation..."
								rows={3}
								className="w-full border-2 border-line rounded-lg px-3 py-2 text-sm focus:border-teal-600 focus:outline-none resize-none"
							/>
						</div>
						<div className="flex gap-3">
							<Button
								variant="secondary"
								fullWidth
								onClick={() => setCancelTarget(null)}
								disabled={cancellingId !== null}
							>
								Keep Booking
							</Button>
							<Button
								variant="danger"
								fullWidth
								loading={cancellingId !== null}
								onClick={() => { void handleCancelConfirm(); }}
							>
								Cancel Booking
							</Button>
						</div>
					</div>
				</div>
			)}
		</DashboardLayout>
	);
};

export default AdminBookings;
