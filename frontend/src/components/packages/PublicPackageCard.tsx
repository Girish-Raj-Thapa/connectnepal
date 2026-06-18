import { Link } from 'react-router-dom';
import { CalendarDays, Package } from 'lucide-react';
import type { PublicPackageSummary } from '@/types/packages';
import { ROUTES } from '@/constants/routes';

interface PublicPackageCardProps {
	pkg: PublicPackageSummary;
}

const formatPrice = (price: string) =>
	parseInt(price).toLocaleString('en-NP');

const PublicPackageCard = ({ pkg }: PublicPackageCardProps) => {
	const to = ROUTES.PUBLIC_PACKAGE_DETAIL.replace(':id', String(pkg.id));

	return (
		<Link to={to} className="block">
			<div className="rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 bg-surface overflow-hidden relative">

				{/* Image */}
				<div className="aspect-video relative overflow-hidden">
					{pkg.coverImageUrl ? (
						<img
							src={pkg.coverImageUrl}
							alt={pkg.title}
							loading="lazy"
							className="object-cover w-full h-full"
						/>
					) : (
						<div className="w-full h-full bg-linear-to-br from-teal-400 to-teal-700 flex items-center justify-center">
							<Package className="w-12 h-12 text-white" />
						</div>
					)}

					{/* Discount badge — top right */}
					{pkg.discountLabel && (
						<span className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded-full">
							{pkg.discountLabel}
						</span>
					)}

				</div>

				{/* Unavailable overlay — sits over the full card */}
				{!pkg.hasUpcomingSlots && (
					<div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
						<span className="text-sm font-semibold text-ink-muted">
							No Departures Available
						</span>
					</div>
				)}

				{/* Body */}
				<div className="p-4">
					<h3 className="text-sm font-semibold text-ink line-clamp-2 mb-2">
						{pkg.title}
					</h3>

					<div className="flex items-center gap-1.5 mb-1">
						<CalendarDays className="w-3.5 h-3.5 text-teal-600 shrink-0" />
						<span className="text-xs text-ink-muted">
							{pkg.durationDays} days / {pkg.durationNights} nights
						</span>
					</div>

					<div className="flex items-center gap-1.5 mb-2">
						<Package className="w-3.5 h-3.5 text-teal-600 shrink-0" />
						<span className="text-xs text-ink-muted">
							{pkg.listingCount} experience{pkg.listingCount !== 1 ? 's' : ''} included
						</span>
					</div>

					<p className="text-xs text-ink-muted">By {pkg.hostName}</p>
				</div>

				{/* Footer */}
				<div className="px-4 pb-4 pt-2 border-t border-line-muted">
					<div>
						<span className="text-sm font-bold text-ink">
							NPR {formatPrice(pkg.totalPrice)}
						</span>
						<span className="text-xs text-ink-muted ml-1">/ person</span>
					</div>
				</div>
			</div>
		</Link>
	);
};

export default PublicPackageCard;
