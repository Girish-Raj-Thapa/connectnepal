import { useState } from 'react';
import { Clock, Users, Globe, Shield, Check } from 'lucide-react';
import { useNavigate, generatePath } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { ListingDetail } from '@/types/listings';
import AddToTripPlannerModal from '@components/trip-planner/AddToTripPlannerModal';

interface BookingSidebarProps {
	listing: ListingDetail;
}

const BookingSidebar = ({ listing }: BookingSidebarProps) => {
	const navigate = useNavigate();
	const [showTripModal, setShowTripModal] = useState(false);

	const handleBookNow = () => {
		void navigate(
			generatePath(ROUTES.LISTING_BOOKING_CHECKOUT, { slug: listing.slug }),
		);
	};

	return (
		<>
			<div className="sticky top-24 space-y-5">
				{/* Main Booking Card */}
				<div className="bg-surface border-2 border-line rounded-2xl p-5 shadow-lg">
					{/* Price */}
					<div className="mb-5">
						<div className="flex items-baseline gap-2 mb-1">
							<span className="text-3xl font-bold text-ink">
								NPR {Number(listing.pricePerPerson).toLocaleString()}
							</span>
							<span className="text-ink-muted text-sm">per person</span>
						</div>
					</div>

					{/* Availability */}
					{listing.isBookable && (
						<div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
							<div className="flex items-center gap-2">
								<Check className="w-5 h-5 text-emerald-600" />
								<span className="font-semibold text-emerald-700">
									Available Now
								</span>
							</div>
						</div>
					)}

					{/* Quick Info */}
					<div className="space-y-2.5 mb-5">
						<div className="flex items-center gap-3 text-sm">
							<Clock className="w-5 h-5 text-ink-muted" />
							<span className="text-ink-secondary">
								Duration:{' '}
								<span className="font-semibold">
									{listing.durationDisplay}
								</span>
							</span>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<Users className="w-5 h-5 text-ink-muted" />
							<span className="text-ink-secondary">
								Group size:{' '}
								<span className="font-semibold">
									{listing.minGroupSize}&ndash;{listing.maxGroupSize}{' '}
									people
								</span>
							</span>
						</div>
						{listing.languagesOffered.length > 0 && (
							<div className="flex items-center gap-3 text-sm">
								<Globe className="w-5 h-5 text-ink-muted" />
								<span className="text-ink-secondary">
									Languages:{' '}
									<span className="font-semibold">
										{listing.languagesOffered
											.map(
												(l) =>
													l.charAt(0).toUpperCase() +
													l.slice(1),
											)
											.join(', ')}
									</span>
								</span>
							</div>
						)}
					</div>

					{/* CTA Buttons */}
					<div className="space-y-3">
						<button
							type="button"
							onClick={handleBookNow}
							disabled={!listing.isBookable}
							className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{listing.instantBooking ? 'Book Now' : 'Request to Book'}
						</button>
						<button
							type="button"
							onClick={() => setShowTripModal(true)}
							className="w-full bg-surface border-2 border-line hover:border-teal-600 text-ink-secondary hover:text-teal-600 py-3 rounded-xl font-semibold text-sm transition-all"
						>
							Add to Trip Planner
						</button>
					</div>

					{/* Safety Info */}
					<div className="mt-5 pt-5 border-t border-line">
						<div className="flex items-center gap-2 text-sm text-ink-muted mb-2">
							<Shield className="w-4 h-4 text-emerald-600 shrink-0" />
							<span>{listing.cancellationPolicyDisplay}</span>
						</div>
						{listing.instantBooking && (
							<div className="flex items-center gap-2 text-sm text-ink-muted">
								<Check className="w-4 h-4 text-emerald-600 shrink-0" />
								<span>Instant confirmation</span>
							</div>
						)}
					</div>
				</div>

				{/* Safety Badge Card */}
				<div className="bg-gray-900 text-white rounded-2xl p-5">
					<div className="flex items-center gap-3 mb-3">
						<Shield className="w-6 h-6 text-teal-400" />
						<h3 className="font-bold text-lg">Safety First</h3>
					</div>
					<p className="text-sm text-gray-300 leading-relaxed">
						All experiences include verified hosts, safety guidelines, and
						24/7 support from our team.
					</p>
				</div>
			</div>

			<AddToTripPlannerModal
				open={showTripModal}
				listingId={listing.id}
				listingTitle={listing.title}
				durationType={listing.durationType}
				durationDays={listing.durationDays}
				onClose={() => setShowTripModal(false)}
			/>
		</>
	);
};

export default BookingSidebar;
