import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, generatePath } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
	ArrowLeft,
	AlertCircle,
	AlertTriangle,
	Calendar,
	Users,
	Clock,
	XCircle,
	CheckCircle,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import Dropdown from '@components/form/Dropdown';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import BookingStatusBadge from '@components/bookings/BookingStatusBadge';
import PaymentStatusBadge from '@components/bookings/PaymentStatusBadge';
import { TravellerBookingService } from '@services/bookings.service';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { formatDate } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import {
	cancelBookingSchema,
	type CancelBookingFormData,
} from '@utils/validators/bookings';
import {
	getBookingItemDateRange,
	getBookingItemImage,
	getBookingItemKind,
	getBookingItemTimeDisplay,
	getBookingItemTitle,
} from '@/utils/bookingItemHelpers';
import type { Booking, CancellationReason } from '@/types/bookings';
import { CANCELLATION_REASON_LABELS } from '@/types/bookings';
import CreateReviewModal from '@components/reviews/CreateReviewModal';
import ReviewStars from '@components/reviews/ReviewStars';

// Only the reasons a traveller can self-service cancel
const TRAVELLER_CANCEL_OPTIONS = (
	['traveller_request', 'other'] as CancellationReason[]
).map((v) => ({ value: v, label: CANCELLATION_REASON_LABELS[v] }));

const BookingDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const [booking, setBooking]     = useState<Booking | null>(null);
	const [loading, setLoading]     = useState(true);
	const [error, setError]         = useState('');
	const [showCancel, setShowCancel] = useState(false);
	const [showCreateReview, setShowCreateReview] = useState(false);
	const [reviewTarget, setReviewTarget] = useState<{
		bookingItemId: number;
		title: string;
	} | null>(null);

	const fetchIdRef = useRef(0);

	// ── Cancel form ───────────────────────────────────────────────────────────
	const {
		control: cancelControl,
		handleSubmit: cancelHandleSubmit,
		reset: resetCancelForm,
		formState: { errors: cancelErrors, isSubmitting: cancelIsSubmitting },
	} = useForm<CancelBookingFormData>({
		resolver: yupResolver(cancelBookingSchema),
		defaultValues: { reason: 'traveller_request', note: '' },
	});

	const {
		apiError: cancelApiError,
		submitting: cancelSubmitting,
		handleSubmit: handleCancelApiSubmit,
		clearError: clearCancelError,
	} = useApiSubmit<CancelBookingFormData>(async (data) => {
		if (!booking) return;
		await TravellerBookingService.cancel(booking.id, {
			reason: data.reason as CancellationReason,
			note: data.note || undefined,
		});
		notification.success('Booking cancelled successfully.');
		setShowCancel(false);
		resetCancelForm();
		void fetchBooking();
	});

	// ── Fetch booking ─────────────────────────────────────────────────────────
	const fetchBooking = useCallback(async () => {
		if (!id) return;
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await TravellerBookingService.getDetail(Number(id));
			if (currentFetchId !== fetchIdRef.current) return;
			setBooking(data);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			setError(err instanceof Error ? err.message : 'Failed to load booking');
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void fetchBooking();
	}, [fetchBooking]);

	const onCancelSubmit = (data: CancelBookingFormData) => {
		void (async () => {
			await handleCancelApiSubmit(data);
		})();
	};

	const cancelLoading = cancelIsSubmitting || cancelSubmitting;


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
	if (error || !booking) {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<p className="text-ink-muted mb-4">{error || 'Booking not found.'}</p>
					<Button onClick={() => void fetchBooking()}>Retry</Button>
				</div>
			</DashboardLayout>
		);
	}

	const canCancel = booking.status === 'pending_payment';

	return (
		<DashboardLayout>
			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-3 flex items-center gap-2 text-sm">
					<Link
						to={ROUTES.TRAVELLER_BOOKINGS}
						className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" /> My Bookings
					</Link>
					<span className="text-line">/</span>
					<span className="reference-code">
						{booking.reference}
					</span>
				</div>
			</div>

			<div className="max-w-3xl mx-auto space-y-6">
				{/* Booking header */}
				<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<p className="meta-text uppercase tracking-wider mb-1">
								Booking Reference
							</p>
							<h2 className="reference-code-lg mb-3">
								{booking.reference}
							</h2>
							<div className="flex flex-wrap gap-2">
								<BookingStatusBadge status={booking.status} />
								{booking.paymentStatus && (
									<PaymentStatusBadge status={booking.paymentStatus} />
								)}
							</div>
						</div>
						<div className="text-right text-sm space-y-1">
							<p className="text-ink-muted">Created</p>
							<p className="font-semibold text-ink-secondary">
								{formatDate(booking.createdAt)}
							</p>
							{booking.expiresAt && booking.status === 'pending_payment' && (
								<>
									<p className="text-ink-muted mt-2">Payment expires</p>
									<p className="font-semibold text-amber-600">
										{new Date(booking.expiresAt).toLocaleString('en-NP')}
									</p>
								</>
							)}
						</div>
					</div>

					{canCancel && (
						<div className="mt-4 pt-4 border-t border-line-muted flex flex-wrap gap-3">
							<Button
								variant="secondary"
								onClick={() =>
									void navigate(
										generatePath(ROUTES.TRAVELLER_BOOKING_PAYMENT, {
											id: String(booking.id),
										}),
									)
								}
							>
								Pay Now
							</Button>
							<Button variant="danger" onClick={() => setShowCancel(true)}>
								Cancel Booking
							</Button>
						</div>
					)}
				</div>

				{/* Items */}
					{booking.items && booking.items.length > 0 && (
						<section>
							<h3 className="card-heading text-ink mb-3">
								Booked Items ({booking.items.length})
							</h3>
							<div className="space-y-4">
								{booking.items.map((item) => {
									const itemKind = getBookingItemKind(item);
									const itemTitle = getBookingItemTitle(item);
									const itemImage = getBookingItemImage(item);
									const timeDisplay = getBookingItemTimeDisplay(item);

									return (
										<div
											key={item.id}
											className="bg-surface border border-line rounded-2xl p-5 shadow-sm"
										>
											<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
												<div className="flex items-start gap-3 min-w-0">
													{itemImage && (
														<img
															src={itemImage}
															alt={itemTitle}
															className="w-14 h-14 rounded-lg object-cover shrink-0"
														/>
													)}
													<div className="min-w-0">
														<div className="flex items-center gap-2 flex-wrap">
															<p className="font-bold text-ink truncate">{itemTitle}</p>
															{itemKind === 'package' && (
																<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700">
																	Package Departure
																</span>
															)}
														</div>
														{itemKind === 'listing' && item.snapshot?.destination && (
															<p className="text-sm text-ink-muted">
																{item.snapshot.destination}
															</p>
														)}
													</div>
												</div>
												<BookingStatusBadge status={item.status} size="sm" />
											</div>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
												<div className="flex items-center gap-2 text-ink-muted">
													<Calendar className="w-4 h-4 text-teal-600" />
													<span>
														{itemKind === 'package'
															? getBookingItemDateRange(item)
															: `${formatDate(item.startDate)}${item.endDate ? ` - ${formatDate(item.endDate)}` : ''}`}
													</span>
												</div>
												{itemKind === 'listing' && timeDisplay && (
													<div className="flex items-center gap-2 text-ink-muted">
														<Clock className="w-4 h-4 text-teal-600" />
														<span>{timeDisplay}</span>
													</div>
												)}
												<div className="flex items-center gap-2 text-ink-muted">
													<Users className="w-4 h-4 text-teal-600" />
													<span>
														{item.travellerCount} traveller
														{item.travellerCount !== 1 ? 's' : ''}
													</span>
												</div>
											</div>
											<div className="mt-3 flex items-center justify-between gap-3">
												<div>
													{/* Already reviewed — show status card */}
													{item.status === 'completed' && item.hasReview && (
														<div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
															<div className="flex items-center gap-2 mb-1">
																<CheckCircle className="w-4 h-4 text-teal-600" />
																<span className="text-sm font-semibold text-teal-900">
																	You reviewed this
																</span>
															</div>
															<ReviewStars rating={0} size="sm" />
															<button
																type="button"
																onClick={() => void navigate(ROUTES.TRAVELLER_REVIEWS)}
																className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1"
															>
																View my reviews
															</button>
														</div>
													)}

													{/* Can review — show button */}
													{item.status === 'completed' && !item.hasReview && item.canReview && (
														<Button
															variant="secondary"
															className="px-3 py-1.5 text-sm rounded-lg"
															onClick={() => {
																setReviewTarget({
																	bookingItemId: item.id,
																	title: getBookingItemTitle(item),
																});
																setShowCreateReview(true);
															}}
														>
															Write a Review
														</Button>
													)}

													{/* Cannot review — show disabled with reason */}
													{item.status === 'completed' && !item.hasReview && !item.canReview && item.cannotReviewReason && (
														<p className="text-xs text-ink-muted italic">
															{item.cannotReviewReason}
														</p>
													)}

													{/* File a complaint — available for confirmed and completed items */}
													{(item.status === 'confirmed' || item.status === 'completed') && (
														<Link
															to={generatePath(ROUTES.TRAVELLER_COMPLAINT_CREATE, { bookingItemId: String(item.id) })}
															className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium mt-1"
														>
															<AlertTriangle className="w-3.5 h-3.5" />
															File a Complaint
														</Link>
													)}
												</div>
												<p className="font-semibold text-ink-secondary text-sm">
													NPR {Number(item.quotedTotal).toLocaleString()}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</section>
					)}

				{/* Price breakdown */}
				<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
					<h3 className="font-bold text-ink mb-4 text-base">
						Price Breakdown
					</h3>
					<div className="space-y-2 text-sm">
						{booking.subtotal && (
							<div className="flex justify-between text-ink-muted">
								<span>Subtotal</span>
								<span>NPR {Number(booking.subtotal).toLocaleString()}</span>
							</div>
						)}
						{booking.feeAmount && Number(booking.feeAmount) > 0 && (
							<div className="flex justify-between text-ink-muted">
								<span>Platform fee</span>
								<span>NPR {Number(booking.feeAmount).toLocaleString()}</span>
							</div>
						)}
						{booking.taxAmount && Number(booking.taxAmount) > 0 && (
							<div className="flex justify-between text-ink-muted">
								<span>Tax</span>
								<span>NPR {Number(booking.taxAmount).toLocaleString()}</span>
							</div>
						)}
						{booking.discountAmount && Number(booking.discountAmount) > 0 && (
							<div className="flex justify-between text-emerald-700">
								<span>Discount</span>
								<span>
									− NPR {Number(booking.discountAmount).toLocaleString()}
								</span>
							</div>
						)}
						<div className="flex justify-between font-bold text-ink text-base border-t border-line pt-2">
							<span>Total</span>
							<span>NPR {Number(booking.quotedTotal).toLocaleString()}</span>
						</div>
						{booking.paidAmount && (
							<div className="flex justify-between text-emerald-700 font-semibold">
								<span>Paid</span>
								<span>NPR {Number(booking.paidAmount).toLocaleString()}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ── Cancel Modal ─────────────────────────────────────────────────── */}
			{showCancel && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="cancel-modal-title"
				>
					<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
						<div className="flex items-center gap-3 mb-5">
							<XCircle className="w-6 h-6 text-red-500 shrink-0" />
							<h3
								id="cancel-modal-title"
								className="font-bold text-ink text-lg"
							>
								Cancel Booking
							</h3>
						</div>

							<form
								onSubmit={(e) => {
									void cancelHandleSubmit(onCancelSubmit)(e);
								}}
								className="space-y-4"
								noValidate
							>
							{cancelApiError && (
								<FormErrorBanner>{cancelApiError}</FormErrorBanner>
							)}

							<Controller
								name="reason"
								control={cancelControl}
								render={({ field }) => (
									<Dropdown
										name={field.name}
										value={field.value}
										onChange={field.onChange}
										label="Reason"
										options={TRAVELLER_CANCEL_OPTIONS}
										error={cancelErrors.reason?.message}
										required
									/>
								)}
							/>

							<Controller
								name="note"
								control={cancelControl}
								render={({ field }) => (
									<TextAreaField
										{...field}
										label="Note (optional)"
										placeholder="Any additional details..."
										rows={3}
										error={cancelErrors.note?.message}
									/>
								)}
							/>

							<div className="flex gap-3 pt-2">
								<Button
									type="button"
									variant="secondary"
									onClick={() => {
										setShowCancel(false);
										clearCancelError();
										resetCancelForm();
									}}
									disabled={cancelLoading}
								>
									Keep Booking
								</Button>
								<Button
									type="submit"
									variant="danger"
									fullWidth
									loading={cancelLoading}
									disabled={cancelLoading}
								>
									Confirm Cancel
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Create Review Modal */}
			{showCreateReview && reviewTarget && reviewTarget.bookingItemId > 0 && (
				<CreateReviewModal
					bookingItemId={reviewTarget.bookingItemId}
					targetTitle={reviewTarget.title}
					onSuccess={() => {
						setShowCreateReview(false);
						notification.success('Review posted successfully!');
						void fetchBooking(); // Refetch to update hasReview/canReview flags
					}}
					onClose={() => setShowCreateReview(false)}
				/>
			)}
		</DashboardLayout>
	);
};

export default BookingDetail;
