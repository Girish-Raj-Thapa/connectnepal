import type { MouseEventHandler } from 'react';
import { Link, type To } from 'react-router-dom';
import { Clock, Heart, BadgeCheck } from 'lucide-react';
import type { ListingCardListing } from '@/types/listings';

interface ListingCardProps {
	listing: ListingCardListing;
	to?: To;
	state?: unknown;
	onNavigate?: MouseEventHandler<HTMLAnchorElement>;
}

const CATEGORY_EMOJI: Record<string, string> = {
	trekking: '⛰️',
	adventure: '🚣',
	cultural: '🕉️',
	nature: '🌿',
	food_tours: '🍜',
	wellness: '🧘',
	photography: '📸',
	heritage: '🏛️',
	village: '🏠',
	festival: '🎉',
};

const DIFFICULTY_COLORS: Record<string, string> = {
	easy: 'bg-emerald-500',
	moderate: 'bg-amber-500',
	challenging: 'bg-red-500',
	difficult: 'bg-red-600',
	expert: 'bg-red-700',
};

const ListingCard = ({
	listing,
	to,
	state,
	onNavigate,
}: ListingCardProps) => {
	const difficultyColor =
		DIFFICULTY_COLORS[listing.difficultyLevel] || 'bg-gray-500';
	const categoryEmoji = CATEGORY_EMOJI[listing.category] || '✨';
	const listingPath = to ?? `/listings/${listing.slug}`;

	const linkProps = {
		to: listingPath,
		state,
		onClick: onNavigate,
	};

	const renderStars = () => {
		const rating = Math.round(Number(listing.ratingAverage));
		return '★'.repeat(rating) + '☆'.repeat(5 - rating);
	};

	return (
		<div className="bg-surface rounded-2xl shadow-sm border border-line hover:shadow-xl transition-all duration-300 overflow-hidden group">
			{/* Image */}
			<div className="relative h-40 bg-surface-raised overflow-hidden">
				<Link {...linkProps}>
					<img
						src={
							listing.primaryImageThumbnail ||
							'/placeholder-listing.jpg'
						}
						alt={listing.title}
						loading="lazy"
						className="w-full h-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-105"
					/>
				</Link>

				{/* Difficulty badge — top left */}
				{listing.difficultyDisplay && (
					<div className="absolute top-3 left-3">
						<span
							className={`px-2.5 py-1 ${difficultyColor} text-white rounded-lg text-xs font-bold uppercase tracking-wide`}
						>
							{listing.difficultyDisplay}
						</span>
					</div>
				)}

				{/* Wishlist — top right */}
				<button
					type="button"
					className="absolute top-2.5 right-2.5 w-8 h-8 bg-surface/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors shadow-lg"
					aria-label="Save to wishlist"
					onClick={(e) => e.stopPropagation()}
				>
					<Heart className="w-4 h-4 text-ink-muted" />
				</button>

				{/* Bottom row — category + verified */}
				<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
					<span className="px-3 py-1 bg-surface/95 backdrop-blur-sm rounded-lg text-xs font-semibold text-ink">
						{categoryEmoji} {listing.categoryDisplay}
					</span>
					{listing.hostIsVerified && (
						<span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
							<BadgeCheck className="w-3 h-3" />
						</span>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="p-3.5">
				<Link {...linkProps}>
					<h3 className="font-bold text-ink text-base mb-1 group-hover:text-teal-600 transition-colors line-clamp-1">
						{listing.title}
					</h3>
				</Link>
				<p className="text-xs text-ink-muted mb-3 line-clamp-2">
					{listing.shortDescription}
				</p>

				{/* Rating */}
				<div className="flex min-h-5 items-center gap-1.5 mb-3">
					{listing.ratingCount > 0 ? (
						<>
						<span className="text-amber-400 text-sm">
							{renderStars()}
						</span>
						<span className="text-sm font-bold text-ink">
							{listing.ratingAverage}
						</span>
						<span className="text-xs text-ink-muted">
							({listing.ratingCount})
						</span>
						</>
					) : (
						<span className="text-xs font-medium text-ink-muted">
							No ratings yet
						</span>
					)}
				</div>

				{/* Duration */}
				<div className="flex items-center gap-2 text-xs text-ink-muted mb-3 pb-3 border-b border-line-muted">
					<Clock className="w-3.5 h-3.5" />
					<span className="font-medium">
						{listing.durationDisplay}
					</span>
				</div>

				{/* Price + CTA */}
				<div className="flex items-center justify-between">
					<div>
						<span className="text-xs text-ink-muted">From</span>
						<div className="flex items-baseline gap-1">
							<span className="text-lg font-bold text-ink">
								{Number(
									listing.pricePerPerson,
								).toLocaleString()}
							</span>
							<span className="text-xs text-ink-muted">NPR</span>
						</div>
					</div>
					<Link
						{...linkProps}
						className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition-all"
					>
						View Details
					</Link>
				</div>
			</div>
		</div>
	);
};

export default ListingCard;
