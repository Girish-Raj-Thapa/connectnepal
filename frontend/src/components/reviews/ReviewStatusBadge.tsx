import type { ReviewStatus } from '@/types/reviews';

interface ReviewStatusBadgeProps {
	status: ReviewStatus;
}

const STATUS_CONFIG: Record<
	ReviewStatus,
	{ label: string; classes: string } | null
> = {
	published: {
		label: 'Published',
		classes: 'bg-emerald-50 text-emerald-700',
	},
	under_review: {
		label: 'Under Review',
		classes: 'bg-amber-50 text-amber-700',
	},
	removed: {
		label: 'Removed',
		classes: 'bg-red-50 text-red-700',
	},
	user_deleted: {
		label: 'Deleted',
		classes: 'bg-surface-muted text-ink-muted',
	},
};


const ReviewStatusBadge = ({ status }: ReviewStatusBadgeProps) => {
	const config = STATUS_CONFIG[status];

	if (!config) {
		return null;
	}

	const { label, classes } = config;

	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
		>
			{label}
		</span>
	);
};

export default ReviewStatusBadge;
