import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, generatePath, Link } from 'react-router-dom';
import {
	ArrowLeft,
	ShieldCheck,
	CheckCircle2,
	Clock,
	AlertTriangle,
	AlertCircle,
	Users,
	Calendar,
} from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import Loader from '@components/feedback/Loader';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import { TravellerBookingService } from '@services/bookings.service';
import { PaymentService } from '@services/payments.service';
import { submitToEsewa } from '@utils/esewaFormSubmit';
import notification from '@utils/notifications';
import { formatDate } from '@utils/format';
import { ROUTES } from '@/constants/routes';
import {
	getBookingItemDateRange,
	getBookingItemImage,
	getBookingItemKind,
	getBookingItemTimeDisplay,
	getBookingItemTitle,
} from '@/utils/bookingItemHelpers';
import type { Booking } from '@/types/bookings';


// ── Expiry countdown helper ───────────────────────────────────────────────────

function getMinutesLeft(expiresAt: string): number {
	const diff = new Date(expiresAt).getTime() - Date.now();
	return Math.floor(diff / 60000);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const BookingPayment = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const [booking, setBooking]   = useState<Booking | null>(null);
	const [loading, setLoading]   = useState(true);
	const [fetchError, setFetchError] = useState('');
	const [payError, setPayError] = useState('');
	const [paying, setPaying]     = useState(false);
	const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

	const fetchIdRef = useRef(0);
	const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// ── Fetch booking ──────────────────────────────────────────────────────────
	const fetchBooking = useCallback(async () => {
		if (!id) return;
		const currentFetch = ++fetchIdRef.current;
		try {
			setLoading(true);
			setFetchError('');
			const data = await TravellerBookingService.getDetail(Number(id));
			if (currentFetch !== fetchIdRef.current) return;

			// Guard: only pending_payment bookings can be paid
			if (data.status !== 'pending_payment') {
				notification.error(
					data.status === 'confirmed'
						? 'This booking has already been paid.'
						: 'This booking cannot be paid at this time.',
				);
				void navigate(
					generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(data.id) }),
					{ replace: true },
				);
				return;
			}

			setBooking(data);

			// Initialise expiry countdown
			if (data.expiresAt) {
				setMinutesLeft(getMinutesLeft(data.expiresAt));
			}
		} catch (err) {
			if (currentFetch !== fetchIdRef.current) return;
			setFetchError(err instanceof Error ? err.message : 'Failed to load booking.');
		} finally {
			if (currentFetch === fetchIdRef.current) setLoading(false);
		}
	}, [id, navigate]);

	useEffect(() => {
		void fetchBooking();
	}, [fetchBooking]);

	// ── Expiry countdown ticker ────────────────────────────────────────────────
	useEffect(() => {
		if (!booking?.expiresAt) return;

		expiryTimerRef.current = setInterval(() => {
			setMinutesLeft(getMinutesLeft(booking.expiresAt!));
		}, 30000); // refresh every 30s

		return () => {
			if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
		};
	}, [booking?.expiresAt]);

	// ── Pay handler ───────────────────────────────────────────────────────────
	const handlePayWithEsewa = async () => {
		if (!booking) return;
		setPayError('');
		setPaying(true);

		try {
			const { formUrl, fields } = await PaymentService.initiateEsewaPayment(booking.id);
			// This triggers a full-page navigation — no further JS runs.
			submitToEsewa(formUrl, fields);
		} catch (err) {
			setPaying(false);
			setPayError(err instanceof Error ? err.message : 'Payment initiation failed. Please try again.');
		}
	};


	// ── Render: loading ────────────────────────────────────────────────────────
	if (loading) {
		return (
			<>
				<Navbar />
				<div className="min-h-screen bg-surface-muted flex justify-center items-center py-20">
					<Loader text="Loading booking..." />
				</div>
			</>
		);
	}

	// ── Render: error ──────────────────────────────────────────────────────────
	if (fetchError || !booking) {
		return (
			<>
				<Navbar />
				<div className="min-h-screen bg-surface-muted flex justify-center items-center py-20">
					<div className="max-w-sm text-center">
						<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
						<p className="text-ink-muted mb-4">{fetchError || 'Booking not found.'}</p>
						<Button onClick={() => void fetchBooking()}>Retry</Button>
					</div>
				</div>
			</>
		);
	}

	const showExpiryWarning = minutesLeft !== null && minutesLeft <= 5 && minutesLeft > 0;
	const firstItem = booking.items?.[0];
	const firstItemImage = firstItem ? getBookingItemImage(firstItem) : null;
	const firstItemTitle = firstItem ? getBookingItemTitle(firstItem) : 'Booking item';

	return (
		<>
			<Navbar />
			<div className="min-h-screen bg-surface-muted">
				<section className="py-10">
					<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

						{/* Back link */}
						<div className="mb-6">
							<Link
								to={generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(booking.id) })}
								className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-teal-600 transition-colors"
							>
								<ArrowLeft className="w-4 h-4" />
								Back to Booking Details
							</Link>
						</div>

						{/* Expiry warning */}
						{showExpiryWarning && (
							<div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
								<AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
								<span>
									Your booking expires in{' '}
									<strong>{minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}</strong>.
									Complete payment soon or you will need to create a new booking.
								</span>
							</div>
						)}

						<div className="grid lg:grid-cols-3 gap-8">

							{/* ── Left column ─────────────────────────────────────────────── */}
							<div className="lg:col-span-2 space-y-6">
								<div>
									<h1 className="page-heading text-ink">
										Complete Payment
									</h1>
									<p className="page-subtext mt-1">
										Review your booking and select a payment method
									</p>
								</div>

								{/* Booking Summary card */}
									<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
										<h2 className="card-heading text-ink mb-5">Booking Summary</h2>

										<div className="flex items-start gap-3 mb-5 pb-5 border-b border-line-muted">
											{/* Thumbnail from first booking item */}
											{firstItemImage && (
												<img
													src={firstItemImage}
													alt={firstItemTitle}
													className="w-24 h-24 rounded-xl object-cover shrink-0"
												/>
											)}
										<div className="flex-1 min-w-0">
											<p className="meta-text uppercase tracking-wider mb-1 text-teal-600">
												Booking Reference
											</p>
											<p className="reference-code">
												{booking.reference}
											</p>
											<p className="text-sm text-ink-muted mt-1">
												{booking.itemCount ?? booking.items?.length ?? 0}{' '}
												{(booking.itemCount ?? booking.items?.length ?? 0) === 1
													? 'experience'
													: 'experiences'}{' '}
												booked
											</p>
										</div>
									</div>

									{/* Items list */}
										{booking.items && booking.items.length > 0 && (
											<div className="space-y-4">
												{booking.items.map((item) => {
													const itemKind = getBookingItemKind(item);
													const itemTitle = getBookingItemTitle(item);
													const timeDisplay = getBookingItemTimeDisplay(item);

													return (
														<div key={item.id} className="flex flex-col sm:flex-row sm:items-start gap-3">
															<div className="flex-1">
																<p className="font-semibold text-ink text-sm">{itemTitle}</p>
																{itemKind === 'listing' && item.snapshot?.destination && (
																	<p className="text-xs text-ink-muted mt-0.5">
																		{item.snapshot.destination}
																	</p>
																)}
																<div className="flex items-center gap-4 mt-2 text-xs text-ink-muted">
																	<span className="flex items-center gap-1">
																		<Calendar className="w-3.5 h-3.5 text-teal-600" />
																		{itemKind === 'package' ? (
																			<>
																				<span className="text-teal-700 font-medium">Departure:</span>{' '}
																				{getBookingItemDateRange(item)}
																			</>
																		) : (
																			<>
																				{formatDate(item.startDate)}
																				{item.endDate && ` - ${formatDate(item.endDate)}`}
																			</>
																		)}
																	</span>
																	{itemKind === 'listing' && timeDisplay && (
																		<span className="flex items-center gap-1">
																			<Clock className="w-3.5 h-3.5 text-teal-600" />
																			{timeDisplay}
																		</span>
																	)}
																	<span className="flex items-center gap-1">
																		<Users className="w-3.5 h-3.5 text-teal-600" />
																		{item.travellerCount} traveller{item.travellerCount !== 1 ? 's' : ''}
																	</span>
																</div>
															</div>
															<p className="text-sm font-semibold text-ink-secondary whitespace-nowrap">
																NPR {Number(item.quotedTotal).toLocaleString()}
															</p>
														</div>
													);
												})}
											</div>
										)}

									{/* Expiry */}
									{booking.expiresAt && (
										<div className="flex items-center gap-2 mt-5 pt-4 border-t border-line-muted text-xs text-ink-muted">
											<Clock className="w-3.5 h-3.5" />
											Payment expires:{' '}
											<span className="font-medium text-amber-600">
												{new Date(booking.expiresAt).toLocaleString('en-NP')}
											</span>
										</div>
									)}
								</div>

								{/* Payment Method card */}
								<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
									<h2 className="card-heading text-ink mb-4">
										Payment Method
									</h2>
									<div className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-teal-600 bg-teal-50">
										<div>
											<p className="font-semibold text-sm text-teal-800">
												eSewa
											</p>
											<p className="text-xs text-ink-muted mt-0.5">
												Fast & secure digital wallet
											</p>
										</div>
										<CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
									</div>
								</div>

								{/* Error banner */}
								{payError && (
									<FormErrorBanner>{payError}</FormErrorBanner>
								)}

								{/* CTA */}
								<Button
									variant="primary"
									fullWidth
									loading={paying}
									disabled={paying}
									onClick={() => void handlePayWithEsewa()}
									className="py-4 text-base"
								>
									{paying ? 'Preparing payment...' : 'Proceed to Payment'}
								</Button>

								<p className="text-center text-xs text-ink-muted">
									By proceeding, you agree to our{' '}
									<a href="#" className="text-teal-600 hover:underline">
										Terms &amp; Conditions
									</a>{' '}
									and{' '}
									<a href="#" className="text-teal-600 hover:underline">
										Privacy Policy
									</a>
								</p>
							</div>

							{/* ── Right column (sticky) ────────────────────────────────────── */}
							<div className="lg:col-span-1">
								<div className="sticky top-6 space-y-4">
									<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
										<h2 className="card-heading text-ink mb-5">
											Payment Summary
										</h2>

										{/* Price breakdown */}
										<div className="space-y-2 text-sm mb-5">
											{booking.subtotal && (
												<div className="flex justify-between text-ink-muted">
													<span>Subtotal</span>
													<span className="font-semibold text-ink">
														NPR {Number(booking.subtotal).toLocaleString()}
													</span>
												</div>
											)}
											{booking.feeAmount && Number(booking.feeAmount) > 0 && (
												<div className="flex justify-between text-ink-muted">
													<span>Platform fee</span>
													<span className="font-semibold text-ink">
														NPR {Number(booking.feeAmount).toLocaleString()}
													</span>
												</div>
											)}
											{booking.taxAmount && Number(booking.taxAmount) > 0 && (
												<div className="flex justify-between text-ink-muted">
													<span>Tax</span>
													<span className="font-semibold text-ink">
														NPR {Number(booking.taxAmount).toLocaleString()}
													</span>
												</div>
											)}
											{booking.discountAmount && Number(booking.discountAmount) > 0 && (
												<div className="flex justify-between text-emerald-700">
													<span>Discount</span>
													<span className="font-semibold">
														− NPR {Number(booking.discountAmount).toLocaleString()}
													</span>
												</div>
											)}
										</div>

										<div className="border-t-2 border-line pt-4 mb-5">
											<div className="flex justify-between items-center">
												<span className="text-base font-bold text-ink">Total Amount</span>
												<span className="text-xl font-bold text-teal-600">
													NPR {Number(booking.quotedTotal).toLocaleString()}
												</span>
											</div>
										</div>

										{/* Security notice */}
										<div className="bg-green-50 border border-green-200 rounded-xl p-4">
											<div className="flex items-start gap-3">
												<ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
												<div className="text-sm text-green-800">
													<p className="font-semibold mb-0.5">Secure Payment</p>
													<p className="text-xs">
														Your payment information is encrypted and secure
													</p>
												</div>
											</div>
										</div>

										{/* Trust badges */}
										<div className="mt-5 pt-5 border-t border-line space-y-2">
											<div className="flex items-center gap-2 text-xs text-ink-muted">
												<CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
												<span>Free cancellation within 24 hours</span>
											</div>
											<div className="flex items-center gap-2 text-xs text-ink-muted">
												<CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
												<span>Instant confirmation</span>
											</div>
										</div>
									</div>
								</div>
							</div>

						</div>
					</div>
				</section>
			</div>
		</>
	);
};

export default BookingPayment;
