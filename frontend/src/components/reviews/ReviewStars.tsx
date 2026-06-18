interface ReviewStarsProps {
	rating: number;
	interactive?: boolean;
	onSelect?: (rating: number) => void;
	size?: 'sm' | 'md' | 'lg';
}

const ReviewStars = ({
	rating,
	interactive = false,
	onSelect,
	size = 'md',
}: ReviewStarsProps) => {
	const sizeClass =
		size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl';
	const hoverClass = interactive
		? 'cursor-pointer hover:scale-110 transition-transform'
		: '';

	return (
		<div className="flex gap-1">
			{[1, 2, 3, 4, 5].map((star) => (
				<span
					key={star}
					className={`${sizeClass} ${hoverClass} ${
						star <= rating ? 'text-amber-400' : 'text-line'
					}`}
					onClick={() => {
						if (interactive && onSelect) {
							onSelect(star);
						}
					}}
					role={interactive ? 'button' : undefined}
					tabIndex={interactive ? 0 : -1}
					onKeyDown={(e) => {
						if (interactive && onSelect && e.key === 'Enter') {
							onSelect(star);
						}
					}}
				>
					{star <= rating ? '★' : '☆'}
				</span>
			))}
		</div>
	);
};

export default ReviewStars;
