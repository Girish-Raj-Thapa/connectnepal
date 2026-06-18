import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import Button from '@components/button/Button';
import { PaymentService } from '@services/payments.service';
import { ROUTES } from '@/constants/routes';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

const PaymentProcessing = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const attemptId = searchParams.get('attempt_id');

	const [statusMessage, setStatusMessage] = useState('Checking your payment status...');
	const [timedOut, setTimedOut] = useState(false);
	const [bookingIdForTimeout, setBookingIdForTimeout] = useState<number | null>(null);

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

	useEffect(() => {
		if (!attemptId) {
			void navigate(ROUTES.HOME, { replace: true });
			return;
		}

		const poll = async () => {
			try {
				const data = await PaymentService.getAttemptStatus(Number(attemptId));
				setBookingIdForTimeout(data.bookingId);

				if (data.status === 'verified') {
					clearInterval(intervalRef.current!);
					clearTimeout(timeoutRef.current!);
					void navigate(
						`${ROUTES.PAYMENT_SUCCESS}?booking_id=${data.bookingId}&attempt_id=${attemptId}`,
						{ replace: true },
					);
					return;
				}

				if (data.status === 'failed') {
					clearInterval(intervalRef.current!);
					clearTimeout(timeoutRef.current!);
					void navigate(
						`${ROUTES.PAYMENT_FAILURE}?booking_id=${data.bookingId}&attempt_id=${attemptId}&reason=verification_failed`,
						{ replace: true },
					);
					return;
				}

				if (data.status === 'expired') {
					clearInterval(intervalRef.current!);
					clearTimeout(timeoutRef.current!);
					void navigate(
						`${ROUTES.PAYMENT_FAILURE}?booking_id=${data.bookingId}&attempt_id=${attemptId}&reason=expired`,
						{ replace: true },
					);
					return;
				}

				// Still in-flight
				if (data.status === 'pending') {
					setStatusMessage('Waiting for confirmation from eSewa...');
				}
			} catch {
				// Network hiccup — keep polling; transient error
			}
		};

		// Poll immediately, then on interval
		void poll();
		intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

		// Hard timeout
		timeoutRef.current = setTimeout(() => {
			clearInterval(intervalRef.current!);
			setTimedOut(true);
		}, TIMEOUT_MS);

		return () => {
			clearInterval(intervalRef.current!);
			clearTimeout(timeoutRef.current!);
		};
	}, [attemptId, navigate]);

	// ── Timed-out state ───────────────────────────────────────────────────────
	if (timedOut) {
		return (
			<>
				<Navbar />
				<div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
					<div className="bg-surface border border-line rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
						<Clock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
						<h1 className="page-heading text-ink mb-3">
							Still checking your payment
						</h1>
						<p className="page-subtext mb-2">
							We have not received final confirmation from eSewa yet. This can occasionally take a few minutes.
						</p>
						{bookingIdForTimeout && (
							<p className="page-subtext mb-6">
								Your booking ID is:{' '}
								<span className="reference-code">
									{bookingIdForTimeout}
								</span>
							</p>
						)}
						<p className="text-ink-muted text-xs mb-6">
							If you completed payment on eSewa, check your bookings again in a few minutes.
						</p>
						<Button
							variant="primary"
							fullWidth
							onClick={() => void navigate(ROUTES.TRAVELLER_BOOKINGS)}
						>
							View My Bookings
						</Button>
					</div>
				</div>
			</>
		);
	}

	// ── Polling state ─────────────────────────────────────────────────────────
	return (
		<>
			<Navbar />
			<div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
				<div className="bg-surface border border-line rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
					{/* Spinner */}
					<div className="flex justify-center mb-6">
						<svg
							className="animate-spin h-12 w-12 text-teal-600"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="3"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					</div>
					<h1 className="page-heading text-ink mb-2">{statusMessage}</h1>
					<p className="page-subtext">
						We&apos;re confirming the payment result with eSewa. This may take a moment.
					</p>
				</div>
			</div>
		</>
	);
};

export default PaymentProcessing;
