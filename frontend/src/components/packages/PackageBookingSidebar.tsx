import { CalendarDays, Users, Check } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { useNavigate, generatePath } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { PublicPackageDetail } from '@/types/packages';

interface PackageBookingSidebarProps {
	pkg: PublicPackageDetail;
}

const formatPrice = (price: string): string => parseInt(price, 10).toLocaleString('en-NP');

const formatDisplayDate = (value: string): string => {
	const parsed = parseISO(value);
	return isValid(parsed) ? format(parsed, 'd MMM yyyy') : value;
};

const PackageBookingSidebar = ({ pkg }: PackageBookingSidebarProps) => {
	const navigate = useNavigate();
	const hasDeparture = pkg.hasUpcomingSlots && !!pkg.nextAvailableSlot;

	const handleBookNow = () => {
		void navigate(
			generatePath(ROUTES.PACKAGE_BOOKING_CHECKOUT, { id: String(pkg.id) }),
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
							<span className="text-3xl font-bold text-ink">NPR {formatPrice(pkg.totalPrice)}</span>
							<span className="text-ink-muted text-sm">per person</span>
						</div>
						{pkg.discountLabel && (
							<span className="inline-flex mt-3 px-2.5 py-1 rounded-full bg-amber-400 text-amber-900 text-xs font-semibold">
								{pkg.discountLabel}
							</span>
						)}
					</div>

					{/* Availability */}
					{hasDeparture && (
						<div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
							<div className="flex items-center gap-2">
								<Check className="w-5 h-5 text-emerald-600" />
								<span className="font-semibold text-emerald-700">Available Now</span>
							</div>
						</div>
					)}

					{/* Quick Info */}
					<div className="space-y-2.5 mb-5">
						<div className="flex items-center gap-3 text-sm">
							<CalendarDays className="w-5 h-5 text-ink-muted" />
							<span className="text-ink-secondary">
								Duration: <span className="font-semibold">{pkg.durationDays}D / {pkg.durationNights}N</span>
							</span>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<Users className="w-5 h-5 text-ink-muted" />
							<span className="text-ink-secondary">
								Group size: <span className="font-semibold">Max {pkg.maxGroupSize} people</span>
							</span>
						</div>
					</div>

					{/* Next Departure */}
					{hasDeparture && (
						<div className="mb-5 p-3 bg-teal-50 border border-teal-100 rounded-xl">
							<p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Next Departure</p>
							<p className="text-sm font-semibold text-ink mt-1">
								{formatDisplayDate(pkg.nextAvailableSlot!.startDate)} – {formatDisplayDate(pkg.nextAvailableSlot!.endDate)}
							</p>
							<p className="text-xs text-ink-muted mt-1">{pkg.bookingCount} booking{pkg.bookingCount !== 1 ? 's' : ''} so far</p>
						</div>
					)}

					{/* CTA Button */}
					<div className="space-y-3">
						<button
							type="button"
							onClick={handleBookNow}
							disabled={!hasDeparture}
							className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{hasDeparture ? 'Book Now' : 'No Departures Available'}
						</button>
					</div>

					<div className="bg-teal-50 rounded-xl p-3 text-xs text-teal-700 mt-3">
						<p className="font-medium">Secure booking | Free cancellation* | Instant confirmation</p>
						<p className="text-[11px] text-teal-600/80 mt-1">* Cancellation policy varies by host</p>
					</div>
				</div>
			</div>
		</>
	);
};

export default PackageBookingSidebar;
