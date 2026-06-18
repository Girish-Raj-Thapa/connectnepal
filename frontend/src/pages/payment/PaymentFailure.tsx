import { useEffect, useMemo, useState } from 'react';
import { generatePath, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import Button from '@components/button/Button';
import { TravellerBookingService } from '@services/bookings.service';
import { ROUTES } from '@/constants/routes';
import { BOOKING_STATUS_LABELS } from '@/types/bookings';
import type { BookingStatus } from '@/types/bookings';
import type { FailureReason } from '@/types/payments';

/**
 * User-facing messages for each allowlisted failure reason.
 * Source: docs/payment_api_guide.md §2.2
 */
const REASON_MESSAGES: Record<FailureReason, string> = {
	canceled:
		'Payment was canceled before confirmation. Please create a new booking if you still want to continue.',
	not_found:
		'The payment could not be completed or the session ended before confirmation.',
	payment_not_completed:
		'Payment was not completed or the session ended before confirmation.',
	refunded:
		'This payment has been refunded by eSewa.',
	signature_mismatch:
		'A security check failed. Please try again. If the problem persists, contact support.',
	verification_failed:
		'We could not confirm the payment result. Please check your booking status and create a new booking if needed.',
	verification_pending:
		'Your payment is still being verified. Please check your booking status.',
	expired:
		'Your payment session ended before confirmation. Please create a new booking if you still want to continue.',
	unknown:
		'We could not complete payment confirmation. Please check your booking status and create a new booking if needed.',
};

const DEFAULT_MESSAGE = 'We could not complete payment confirmation. Please check your booking status.';

const PaymentFailure = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const bookingId = searchParams.get('booking_id');
	const attemptId = searchParams.get('attempt_id');
	const rawReason = searchParams.get('reason') ?? 'unknown';
	const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);

	// Only trust allowlisted reason codes; fall back to 'unknown' for anything else
	const reason: FailureReason = (rawReason in REASON_MESSAGES)
		? (rawReason as FailureReason)
		: 'unknown';

	useEffect(() => {
		if (!bookingId) return;

		let cancelled = false;

		void TravellerBookingService.getDetail(Number(bookingId))
			.then((booking) => {
				if (!cancelled) {
					setBookingStatus(booking.status);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setBookingStatus(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [bookingId]);

	const heading = reason === 'payment_not_completed'
		? 'Payment Not Completed'
		: 'Payment Failed';

	const message = useMemo(() => {
		if (reason === 'payment_not_completed') {
			if (bookingStatus === 'expired') {
				return 'Payment was not completed and this booking session has ended. Please create a new booking if you still want to continue.';
			}
			if (bookingStatus === 'pending_payment') {
				return 'Payment was not completed. This booking is still awaiting payment. Review it from your bookings and pay again only if it is still active.';
			}
			return 'Payment was not completed or the session ended before confirmation. Please check your booking status and create a new booking if needed.';
		}

		if (reason === 'expired' && bookingStatus === 'expired') {
			return 'Your payment session ended and this booking has expired. Please create a new booking if you still want to continue.';
		}

		return REASON_MESSAGES[reason] ?? DEFAULT_MESSAGE;
	}, [bookingStatus, reason]);

	const primaryAction = bookingId && bookingStatus === 'pending_payment'
		? {
			label: 'View Booking',
			onClick: () => void navigate(
				generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: bookingId }),
			),
		}
		: {
			label: 'View My Bookings',
			onClick: () => void navigate(ROUTES.TRAVELLER_BOOKINGS),
		};

	return (
		<>
			<Navbar />
			<div className="min-h-screen bg-surface-muted py-12">
				<div className="max-w-md mx-auto px-4 sm:px-6">

					{/* Failure header */}
					<div className="text-center mb-8">
						<div className="flex justify-center mb-4">
							<div className="w-20 h-20 bg-red-50 border-4 border-red-100 rounded-full flex items-center justify-center">
								<XCircle className="w-10 h-10 text-red-500" />
							</div>
						</div>
						<h1 className="page-heading text-ink mb-2">
							{heading}
						</h1>
						<p className="page-subtext">{message}</p>
					</div>

					{/* Special case: verification_pending — offer link to polling page */}
					{reason === 'verification_pending' && attemptId && (
						<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 text-center">
							Your payment may still be processing.{' '}
							<Link
								to={`${ROUTES.PAYMENT_PROCESSING}?attempt_id=${attemptId}`}
								className="font-semibold text-amber-700 hover:underline"
							>
								Check payment status
							</Link>
						</div>
					)}

					{/* Attempt reference */}
					{attemptId && (
						<div className="bg-surface border border-line rounded-xl p-4 mb-6 text-center">
							<p className="text-xs text-ink-muted mb-1">Payment Reference</p>
							<p className="reference-code">
								{attemptId}
							</p>
						</div>
					)}

					{bookingStatus && (
						<div className="bg-surface-muted border border-line rounded-xl p-4 mb-6 text-center">
							<p className="text-xs text-ink-muted mb-1">Booking Status</p>
							<p className="reference-code">{BOOKING_STATUS_LABELS[bookingStatus]}</p>
						</div>
					)}

					{/* Actions */}
					<div className="flex flex-col gap-3">
						<Button
							variant="primary"
							fullWidth
							onClick={primaryAction.onClick}
						>
							{primaryAction.label}
						</Button>
						<Button
							variant="secondary"
							fullWidth
							onClick={() => void navigate(ROUTES.HOME)}
						>
							Back to Home
						</Button>
					</div>

					<p className="text-center text-xs text-ink-muted mt-6">
						If you need help, please{' '}
						<a href="#" className="text-teal-600 hover:underline">
							contact our support team
						</a>
						.
					</p>

				</div>
			</div>
		</>
	);
};

export default PaymentFailure;
