import { Package as PackageIcon } from 'lucide-react';

interface BookingSummaryCardProps {
	imageUrl?: string | null;
	imageAlt: string;
	badgeText: string;
	title: string;
	subtitle: string;
	pricePerPerson: number;
	gradientFallback?: boolean;
	formatPrice?: (price: number) => string;
}

const BookingSummaryCard = ({
	imageUrl,
	imageAlt,
	badgeText,
	title,
	subtitle,
	pricePerPerson,
	gradientFallback = false,
	formatPrice = (price) => Number(price).toLocaleString(),
}: BookingSummaryCardProps) => {
	return (
		<div className="bg-surface border border-line rounded-2xl p-5 flex gap-4 shadow-sm">
			{imageUrl ? (
				<img
					src={imageUrl}
					alt={imageAlt}
					className="w-24 h-24 rounded-xl object-cover shrink-0"
				/>
			) : gradientFallback ? (
				<div className="w-24 h-24 rounded-xl bg-linear-to-br from-teal-300 to-teal-700 flex items-center justify-center shrink-0">
					<PackageIcon className="w-10 h-10 text-white" />
				</div>
			) : (
				<div className="w-24 h-24 rounded-xl bg-surface-muted shrink-0" />
			)}
			<div className="min-w-0">
				<p className="meta-text text-teal-600 uppercase tracking-wide mb-1">
					{badgeText}
				</p>
				<h2 className="card-heading text-ink leading-tight mb-1 truncate">
					{title}
				</h2>
				<p className="text-sm text-ink-muted mb-2">{subtitle}</p>
				<p className="text-sm font-semibold text-ink-secondary">
					NPR {formatPrice(pricePerPerson)}
					<span className="font-normal text-ink-muted"> / person</span>
				</p>
			</div>
		</div>
	);
};

export default BookingSummaryCard;
