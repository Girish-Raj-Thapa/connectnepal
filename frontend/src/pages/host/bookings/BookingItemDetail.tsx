import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
	ArrowLeft,
	AlertCircle,
	Calendar,
	Clock,
	Users,
	CheckCircle,
	MapPin,
	User,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import BookingStatusBadge from '@components/bookings/BookingStatusBadge';
import { HostBookingService } from '@services/bookings.service';
import notification from '@utils/notifications';
import { formatDate, formatNPR } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import { getBookingItemImage } from '@/utils/bookingItemHelpers';
import type { HostBookingItem } from '@/types/bookings';

const BookingItemDetail = () => {
	const { itemId } = useParams<{ itemId: string }>();

	const [item, setItem]       = useState<HostBookingItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError]     = useState('');

	// Mark completed — two-step confirm
	const [confirmingComplete, setConfirmingComplete] = useState(false);
	const [marking, setMarking]                       = useState(false);
	const [markError, setMarkError]                   = useState('');

	const fetchIdRef = useRef(0);

	const fetchItem = useCallback(async () => {
		if (!itemId) return;
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await HostBookingService.getItemDetail(Number(itemId));
			if (currentFetchId !== fetchIdRef.current) return;
			setItem(data);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			setError(
				err instanceof Error ? err.message : 'Failed to load booking item',
			);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [itemId]);

	useEffect(() => {
		void fetchItem();
	}, [fetchItem]);

	const handleMarkCompleted = async () => {
		if (!item) return;
		try {
			setMarking(true);
			setMarkError('');
			await HostBookingService.markCompleted(item.id);
			notification.success('Booking marked as completed.');
			setConfirmingComplete(false);
			void fetchItem();
		} catch (err) {
			setMarkError(
				err instanceof Error ? err.message : 'Failed to mark as completed',
			);
		} finally {
			setMarking(false);
		}
	};


	// ── Render: loading ───────────────────────────────────────────────────────
	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex justify-center py-20">
					<Loader text="Loading booking..." />
				</div>
			</DashboardLayout>
		);
	}

	// ── Render: error ─────────────────────────────────────────────────────────
	if (error || !item) {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<p className="text-ink-muted mb-4">{error || 'Booking not found.'}</p>
					<button
						onClick={() => void fetchItem()}
						className="px-5 py-2 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors"
					>
						Retry
					</button>
				</div>
			</DashboardLayout>
		);
	}

	const canComplete = item.status === 'confirmed';
	const isPackageItem = item.durationType === 'package';
	const itemImage = getBookingItemImage(item);

	return (
		<DashboardLayout>
			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-3 flex items-center gap-2 text-sm">
					<Link
						to={ROUTES.HOST_BOOKINGS}
						className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" /> Manage Bookings
					</Link>
					<span className="text-line">/</span>
					<span className="reference-code">
						{item.bookingReference}
					</span>
				</div>
			</div>

			<div className="max-w-2xl mx-auto space-y-6">

				{/* Header card */}
				<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<p className="meta-text uppercase tracking-wider mb-1">
								Booking Reference
							</p>
							<h2 className="reference-code-lg mb-3">
								{item.bookingReference}
							</h2>
							<BookingStatusBadge status={item.status} />
						</div>
						<p className="text-sm text-ink-muted">
							Created {formatDate(item.createdAt)}
						</p>
					</div>

					{canComplete && !confirmingComplete && (
						<div className="mt-4 pt-4 border-t border-line-muted">
							<button
								onClick={() => setConfirmingComplete(true)}
								className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20"
							>
								Mark as Completed
							</button>
						</div>
					)}

					{confirmingComplete && (
						<div className="mt-4 pt-4 border-t border-line-muted space-y-3">
							<p className="text-sm text-ink-secondary">
								Confirm that this experience has been delivered to the guest?
							</p>
							{markError && (
								<p role="alert" className="text-red-600 text-sm">
									{markError}
								</p>
							)}
							<div className="flex gap-3">
								<button
									onClick={() => {
										setConfirmingComplete(false);
										setMarkError('');
									}}
									disabled={marking}
									className="px-4 py-2 border border-line rounded-xl text-sm font-semibold text-ink-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									onClick={() => void handleMarkCompleted()}
									disabled={marking}
									className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
								>
									<CheckCircle className="w-4 h-4" />
									{marking ? 'Saving…' : 'Yes, mark completed'}
								</button>
							</div>
						</div>
					)}

					{item.completedAt && (
						<div className="mt-4 pt-4 border-t border-line-muted flex items-center gap-2 text-sm text-emerald-700">
							<CheckCircle className="w-4 h-4" />
							Completed on {formatDate(item.completedAt)}
						</div>
					)}
				</div>

				{/* Guest info */}
				<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
					<h3 className="card-heading text-ink mb-4 flex items-center gap-2">
						<User className="w-5 h-5 text-teal-600" />
						Guest Information
					</h3>
					<div className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-ink-muted">Name</span>
							<span className="font-semibold text-ink-secondary">
								{item.travellerName}
							</span>
						</div>
						{item.travellerEmail && (
							<div className="flex justify-between">
								<span className="text-ink-muted">Email</span>
								<span className="font-semibold text-ink-secondary">
									{item.travellerEmail}
								</span>
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-ink-muted">Travellers</span>
							<span className="font-semibold text-ink-secondary">
								{item.travellerCount}
							</span>
						</div>
					</div>
				</div>

					{/* Listing snapshot */}
					{item.snapshot && !isPackageItem && (
						<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
							<h3 className="card-heading text-ink mb-4 flex items-center gap-2">
								<MapPin className="w-5 h-5 text-teal-600" />
								Experience (Snapshot at Booking Time)
							</h3>
							<div className="flex gap-4">
								{itemImage && (
									<img
										src={itemImage}
										alt={item.snapshot.title}
										className="w-20 h-20 rounded-xl object-cover shrink-0"
									/>
								)}
								<div className="space-y-1.5 text-sm">
									<p className="font-bold text-ink">{item.snapshot.title}</p>
									<p className="text-ink-muted">{item.snapshot.destination}</p>
									<p className="text-ink-muted">
										NPR {Number(item.snapshot.pricePerPerson).toLocaleString()} /{' '}
										person
									</p>
									<p className="text-xs text-ink-muted mt-2 leading-relaxed">
										{item.snapshot.cancellationPolicy}
									</p>
								</div>
							</div>
							<p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
								This snapshot is frozen at booking creation time and will not change
								if the listing is later edited.
							</p>
						</div>
					)}

					{/* Package context */}
					{isPackageItem && (
						<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
							<h3 className="card-heading text-ink mb-4 flex items-center gap-2">
								<Calendar className="w-5 h-5 text-teal-600" />
								Package Booking Context
							</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between gap-4">
									<span className="text-ink-muted">Package Title</span>
									<span className="font-semibold text-ink-secondary text-right">
										{item.snapshot?.packageTitle ?? 'Package Booking'}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-ink-muted">Slot Dates</span>
									<span className="font-semibold text-ink-secondary text-right">
										{formatDate(item.startDate)}
										{item.endDate ? ` - ${formatDate(item.endDate)}` : ''}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-ink-muted">Travellers</span>
									<span className="font-semibold text-ink-secondary">{item.travellerCount}</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-ink-muted">Price per person (snapshot)</span>
									<span className="font-semibold text-ink-secondary">
										{item.snapshot?.totalPrice
											? formatNPR(item.snapshot.totalPrice)
											: '—'}
									</span>
								</div>
							</div>
							<p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
								This package snapshot is frozen at booking creation time and will not
								change if the package is later edited.
							</p>
						</div>
					)}

					{/* Schedule */}
					<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
						<h3 className="card-heading text-ink mb-4 flex items-center gap-2">
							<Calendar className="w-5 h-5 text-teal-600" />
							Schedule
						</h3>
						<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<p className="text-ink-muted mb-1">Start Date</p>
							<p className="font-semibold text-ink-secondary">
								{formatDate(item.startDate)}
							</p>
						</div>
						{item.endDate && (
							<div>
								<p className="text-ink-muted mb-1">End Date</p>
								<p className="font-semibold text-ink-secondary">
									{formatDate(item.endDate)}
								</p>
							</div>
						)}
						{item.startTime && (
							<div className="col-span-2 flex items-center gap-2">
								<Clock className="w-4 h-4 text-teal-600" />
								<span className="text-ink-secondary">
									{item.startTime} – {item.endTime}
								</span>
							</div>
						)}
						{item.days !== undefined && (
							<div>
								<p className="text-ink-muted mb-1">Duration</p>
								<p className="font-semibold text-ink-secondary">
									{item.days} day{item.days !== 1 ? 's' : ''}
									{item.nights
										? ` / ${item.nights} night${item.nights !== 1 ? 's' : ''}`
										: ''}
								</p>
							</div>
						)}
						<div>
							<p className="text-ink-muted mb-1">Travellers</p>
							<p className="font-semibold text-ink-secondary flex items-center gap-1">
								<Users className="w-4 h-4 text-teal-600" />
								{item.travellerCount}
							</p>
						</div>
					</div>
				</div>

				{/* Price breakdown */}
				<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
					<h3 className="card-heading text-ink mb-4">
						Price Breakdown
					</h3>
					<div className="space-y-2 text-sm">
						{item.pricePerPerson && (
							<div className="flex justify-between text-ink-muted">
								<span>Price per person</span>
								<span>NPR {Number(item.pricePerPerson).toLocaleString()}</span>
							</div>
						)}
						{item.subtotal && (
							<div className="flex justify-between text-ink-muted">
								<span>Subtotal ({item.travellerCount} travellers)</span>
								<span>NPR {Number(item.subtotal).toLocaleString()}</span>
							</div>
						)}
						{item.feeAmount && Number(item.feeAmount) > 0 && (
							<div className="flex justify-between text-ink-muted">
								<span>Platform fee</span>
								<span>NPR {Number(item.feeAmount).toLocaleString()}</span>
							</div>
						)}
						{item.taxAmount && Number(item.taxAmount) > 0 && (
							<div className="flex justify-between text-ink-muted">
								<span>Tax</span>
								<span>NPR {Number(item.taxAmount).toLocaleString()}</span>
							</div>
						)}
						{item.discountAmount && Number(item.discountAmount) > 0 && (
							<div className="flex justify-between text-emerald-700">
								<span>Discount</span>
								<span>
									− NPR {Number(item.discountAmount).toLocaleString()}
								</span>
							</div>
						)}
						<div className="flex justify-between font-bold text-ink text-base border-t border-line pt-2">
							<span>Total</span>
							<span>NPR {Number(item.quotedTotal).toLocaleString()}</span>
						</div>
					</div>
				</div>

				{/* Status history */}
				{item.history && item.history.length > 0 && (
					<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
						<h3 className="card-heading text-ink mb-4">
							Status History
						</h3>
						<ol className="relative border-l border-line space-y-4 ml-3">
							{item.history.map((h) => (
								<li key={h.id} className="pl-5">
									<span className="absolute -left-1.5 w-3 h-3 bg-teal-600 rounded-full" />
									<p className="text-sm font-semibold text-ink-secondary">
										{h.fromStatus ? `${h.fromStatus} → ` : ''}
										{h.toStatus}
									</p>
									{h.note && (
										<p className="text-xs text-ink-muted mt-0.5">{h.note}</p>
									)}
									<p className="text-xs text-ink-muted mt-0.5">
										{new Date(h.changedAt).toLocaleString('en-NP')}
									</p>
								</li>
							))}
						</ol>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
};

export default BookingItemDetail;
