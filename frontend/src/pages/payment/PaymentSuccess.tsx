import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, generatePath } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Calendar, Users } from 'lucide-react';
import { FEATURE_FLAGS } from '@config/features';
import Navbar from '@components/layout/Navbar';
import Loader from '@components/feedback/Loader';
import Button from '@components/button/Button';
import { TravellerBookingService } from '@services/bookings.service';
import { formatDate } from '@utils/format';
import { useSimilarListings } from '@/hooks/useRecommendations';
import RecommendationGrid from '@components/listings/RecommendationGrid';
import { ROUTES } from '@/constants/routes';
import type { Booking } from '@/types/bookings';

const PaymentSuccess = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const bookingIdParam = searchParams.get('booking_id');

	const [booking, setBooking] = useState<Booking | null>(null);
	const [loading, setLoading] = useState(true);

	const firstItemListingId = booking?.items?.[0]?.listingId ?? null;
	const {
		listings: similarListings,
		meta: similarMeta,
		loading: similarLoading,
		error: similarError,
	} = useSimilarListings(firstItemListingId, 4);

	useEffect(() => {
		if (!bookingIdParam) {
			void navigate(ROUTES.HOME, { replace: true });
			return;
		}

		void TravellerBookingService.getDetail(Number(bookingIdParam))
			.then((data) => setBooking(data))
			.catch(() => {/* show fallback UI with partial info */})
			.finally(() => setLoading(false));
	}, [bookingIdParam, navigate]);


	// ── Loading ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<>
				<Navbar />
				<div className="min-h-screen bg-surface-muted flex justify-center items-center">
					<Loader text="Loading confirmation..." />
				</div>
			</>
		);
	}

	// ── Main success page ─────────────────────────────────────────────────────
	return (
		<>
			<Navbar />
			<div className="min-h-screen bg-surface-muted py-12">
				<div className="max-w-xl mx-auto px-4 sm:px-6">

					{/* Success header */}
					<div className="text-center mb-8">
						<div className="flex justify-center mb-4">
							<div className="w-20 h-20 bg-teal-50 border-4 border-teal-100 rounded-full flex items-center justify-center">
								<CheckCircle2 className="w-10 h-10 text-teal-600" />
							</div>
						</div>
						<h1 className="page-heading text-ink mb-2">
							Payment Successful!
						</h1>
						<p className="page-subtext">
							Your booking has been confirmed. A confirmation email has been sent to your
							registered email address.
						</p>
					</div>

					{/* Booking details card */}
					{booking ? (
						<div className="bg-surface border border-line rounded-2xl shadow-sm p-6 mb-6">
							<div className="flex items-center gap-2 mb-5">
								<CheckCircle2 className="w-5 h-5 text-teal-600" />
								<h2 className="card-heading text-ink">Booking Confirmed</h2>
							</div>

							<div className="space-y-3 text-sm mb-5">
								<div className="flex justify-between">
									<span className="text-ink-muted">Booking Reference</span>
									<span className="reference-code">
										{booking.reference}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-muted">Status</span>
									<span className="font-semibold text-emerald-700 capitalize">
										{booking.status}
									</span>
								</div>
								<div className="flex justify-between border-t border-line-muted pt-3">
									<span className="font-bold text-ink">Total Paid</span>
									<span className="font-bold text-teal-600 text-base">
										NPR {Number(booking.quotedTotal).toLocaleString()}
									</span>
								</div>
							</div>

							{/* Items */}
							{booking.items && booking.items.length > 0 && (
								<>
									<h3 className="card-heading text-ink mb-3">
										Your Experiences
									</h3>
									<div className="space-y-3">
										{booking.items.map((item) => (
											<div
												key={item.id}
												className="flex flex-col gap-1 bg-surface-muted rounded-xl p-4"
											>
												<p className="font-semibold text-ink text-sm">
													{item.listingTitle}
												</p>
												<div className="flex items-center gap-4 text-xs text-ink-muted">
													<span className="flex items-center gap-1">
														<Calendar className="w-3.5 h-3.5 text-teal-600" />
														{formatDate(item.startDate)}
													</span>
													<span className="flex items-center gap-1">
														<Users className="w-3.5 h-3.5 text-teal-600" />
														{item.travellerCount} traveller{item.travellerCount !== 1 ? 's' : ''}
													</span>
												</div>
											</div>
										))}
									</div>
								</>
							)}
						</div>
					) : (
						/* Fallback if booking detail fetch failed */
						<div className="bg-surface border border-line rounded-2xl shadow-sm p-6 mb-6 text-center">
							<AlertCircle className="w-8 h-8 text-ink-muted mx-auto mb-2" />
							<p className="text-ink-muted text-sm">
								Payment was successful! Your booking details will be available shortly.
							</p>
						</div>
					)}

					{/* Actions */}
					<div className="flex flex-col sm:flex-row gap-3">
						{booking && (
							<Button
								variant="primary"
								fullWidth
								onClick={() =>
									void navigate(
										generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, {
											id: String(booking.id),
										}),
									)
								}
							>
								View Booking Details
							</Button>
						)}
						<Button
							variant="secondary"
							fullWidth
							onClick={() => void navigate(ROUTES.HOME)}
						>
							Back to Home
						</Button>
					</div>

					{/* Post-booking upsell */}
					{FEATURE_FLAGS.recommendations && (
						<RecommendationGrid
							title="Explore Similar Activities"
							listings={similarListings}
							meta={similarMeta}
							surface="similar"
							loading={similarLoading}
							error={similarError}
							columns={3}
							skeletonCount={3}
						/>
					)}

				</div>
			</div>
		</>
	);
};

export default PaymentSuccess;
