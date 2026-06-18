import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import IconButton from '@components/button/IconButton';
import type { ListingImage } from '@/types/listings';

interface ListingLightboxProps {
	images: ListingImage[];
	title: string;
	initialIndex: number;
	onClose: () => void;
}

const ListingLightbox = ({
	images,
	title,
	initialIndex,
	onClose,
}: ListingLightboxProps) => {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [slideClass, setSlideClass] = useState('');
	const [animKey, setAnimKey] = useState(0);

	const navigate = useCallback(
		(direction: 'next' | 'prev') => {
			setSlideClass(
				direction === 'next'
					? 'lightbox-slide-next'
					: 'lightbox-slide-prev',
			);
			setAnimKey((k) => k + 1);
			setCurrentIndex((prev) =>
				direction === 'next'
					? (prev + 1) % images.length
					: (prev - 1 + images.length) % images.length,
			);
		},
		[images.length],
	);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
			if (e.key === 'ArrowRight') navigate('next');
			if (e.key === 'ArrowLeft') navigate('prev');
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, [onClose, navigate]);

	const image = images[currentIndex];

	return (
		<div
			className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
			onClick={onClose}
		>
			{/* Counter */}
			<div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full pointer-events-none select-none">
				{currentIndex + 1} / {images.length}
			</div>

			{/* Close */}
			<IconButton
				variant="dark"
				onClick={onClose}
				aria-label="Close gallery"
				className="absolute top-4 right-4 z-10 p-2! rounded-full bg-black/40"
			>
				<X className="w-5 h-5" />
			</IconButton>

			{/* Prev */}
			{images.length > 1 && (
				<IconButton
					variant="dark"
					onClick={(e) => {
						e.stopPropagation();
						navigate('prev');
					}}
					aria-label="Previous image"
					className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3! rounded-full bg-black/40"
				>
					<ChevronLeft className="w-6 h-6" />
				</IconButton>
			)}

			{/* Image */}
			<div
				className="overflow-hidden flex items-center justify-center w-full h-full px-20 py-16"
				onClick={(e) => e.stopPropagation()}
			>
				<img
					key={animKey}
					src={image.imageUrl}
					alt={image.altText || title}
					className={`max-w-full max-h-full object-contain rounded-lg ${slideClass}`}
				/>
			</div>

			{/* Next */}
			{images.length > 1 && (
				<IconButton
					variant="dark"
					onClick={(e) => {
						e.stopPropagation();
						navigate('next');
					}}
					aria-label="Next image"
					className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3! rounded-full bg-black/40"
				>
					<ChevronRight className="w-6 h-6" />
				</IconButton>
			)}
		</div>
	);
};

export default ListingLightbox;