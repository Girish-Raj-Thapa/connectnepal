import { useState, type CSSProperties } from 'react';
import type { ListingImage } from '@/types/listings';
import ListingLightbox from './ListingLightbox';

interface ListingGalleryProps {
	images: ListingImage[];
	title: string;
}

const ListingGallery = ({ images, title }: ListingGalleryProps) => {
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	if (images.length === 0) {
		return (
			<div className="w-full h-80 bg-surface-muted rounded-2xl flex items-center justify-center">
				<p className="text-ink-muted">No photos available</p>
			</div>
		);
	}

	// Sort: primary first, then by order
	const sorted = [...images].sort((a, b) => {
		if (a.isPrimary) return -1;
		if (b.isPrimary) return 1;
		return a.order - b.order;
	});

	const main = sorted[0];

	// Single image — full width, no grid
	if (sorted.length === 1) {
		return (
			<>
				<div
					className="w-full h-96 rounded-2xl overflow-hidden cursor-pointer"
					onClick={() => setLightboxIndex(0)}
				>
					<img
						src={main.imageUrl}
						alt={main.altText || title}
						className="w-full h-full object-cover"
					/>
				</div>
				{lightboxIndex !== null && (
					<ListingLightbox
						images={sorted}
						title={title}
						initialIndex={lightboxIndex}
						onClose={() => setLightboxIndex(null)}
					/>
				)}
			</>
		);
	}

	// Up to 4 thumbnails (5 total with main); extras get a "+N more" overlay
	const thumbImages = sorted.slice(1, 5);
	const extraCount = Math.max(0, sorted.length - 5);
	const thumbCount = thumbImages.length;

	// Grid columns: 2-col for ≤3 images, 3-col for 4+
	const gridTemplateColumns =
		thumbCount <= 2 ? '2fr 1fr' : '2fr 1fr 1fr';

	// Per-thumbnail positioning overrides
	const getThumbStyle = (idx: number): CSSProperties => {
		// Only thumbnail — fill full right column height
		if (thumbCount === 1) return { gridRow: '1 / 3' };
		// 4 images total: 3rd thumb spans both right columns on bottom row
		if (thumbCount === 3 && idx === 2) return { gridColumn: '2 / 4' };
		return {};
	};

	return (
		<>
		<div
			className="grid gap-2 h-96 rounded-2xl overflow-hidden"
			style={{ gridTemplateColumns, gridTemplateRows: '1fr 1fr' }}
		>
			{/* Main image — spans full left column */}
			<div
				className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover:scale-[0.98] group"
				style={{ gridRow: '1 / 3', gridColumn: '1' }}
				onClick={() => setLightboxIndex(0)}
			>
				<img
					src={main.imageUrl}
					alt={main.altText || title}
					className="w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
				/>
			</div>

			{/* Thumbnails */}
			{thumbImages.map((img, idx) => {
				const isLast = idx === thumbImages.length - 1;
				const showOverlay = isLast && extraCount > 0;
				// sorted index: main is 0, thumbs start at 1
				const sortedIndex = idx + 1;
				// clicking the +N overlay opens at the first hidden image (index 5)
				const clickIndex = showOverlay ? 5 : sortedIndex;

				return (
					<div
						key={img.id}
						className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover:scale-[0.98] group"
						style={getThumbStyle(idx)}
						onClick={() => setLightboxIndex(clickIndex)}
					>
						<img
							src={img.imageUrl}
							alt={img.altText || title}
							className="w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
						/>
						{showOverlay && (
							<div className="absolute inset-0 bg-black/55 flex items-center justify-center rounded-xl">
								<span className="text-white font-bold text-xl">
									+{extraCount} more
								</span>
							</div>
						)}
					</div>
				);
			})}
		</div>

		{lightboxIndex !== null && (
			<ListingLightbox
				images={sorted}
				title={title}
				initialIndex={lightboxIndex}
				onClose={() => setLightboxIndex(null)}
			/>
		)}
		</>
	);
};

export default ListingGallery;
