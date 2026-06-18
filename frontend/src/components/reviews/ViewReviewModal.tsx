import { X as XIcon } from 'lucide-react';
import Button from '@components/button/Button';
import { formatDate } from '@utils/format';
import ReviewReplyBlock from './ReviewReplyBlock';
import ReviewStars from './ReviewStars';
import ReviewStatusBadge from './ReviewStatusBadge';
import { getReviewItemTitle, getReviewItemType } from './reviewDisplay';
import type { Review } from '@/types/reviews';

interface ViewReviewModalProps {
	review: Review;
	onClose: () => void;
	onEdit?: () => void;
}

const ViewReviewModal = ({
	review,
	onClose,
	onEdit,
}: ViewReviewModalProps) => {
	const itemTitle = getReviewItemTitle(review);
	const itemType = getReviewItemType(review);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="view-review-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
				<div className="flex items-start justify-between gap-4 border-b border-line-muted px-6 py-5">
					<div className="min-w-0">
						<p className="meta-text uppercase tracking-[0.24em]">{itemType}</p>
						<h3
							id="view-review-modal-title"
							className="section-heading text-ink mt-2 truncate"
							title={itemTitle}
						>
							{itemTitle}
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-ink-muted hover:text-ink-muted"
						aria-label="Close"
					>
						<XIcon className="w-5 h-5" />
					</button>
				</div>

				<div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-5 space-y-5">
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Rating</p>
							<div className="mt-2 flex items-center gap-3">
								<ReviewStars rating={review.rating} size="sm" />
								<span className="text-sm font-semibold text-ink">
									{review.rating.toFixed(1)}
								</span>
							</div>
						</div>

						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Status</p>
							<div className="mt-2">
								<ReviewStatusBadge status={review.status} />
							</div>
						</div>

						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Submitted</p>
							<p className="mt-2 text-sm font-medium text-ink">
								{formatDate(review.createdAt)}
							</p>
							{review.editedAt && (
								<p className="meta-text mt-1">
									Edited {formatDate(review.editedAt)}
								</p>
							)}
						</div>
					</div>

					<div>
						<p className="meta-text mb-2">Review</p>
						<div className="rounded-xl border border-line bg-surface px-4 py-4">
							<p className="text-sm leading-7 text-ink-secondary whitespace-pre-wrap">
								{review.comment}
							</p>
						</div>
					</div>

					{review.status === 'under_review' && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
							<p className="text-sm text-amber-800">
								Your review is under moderation. It may take a little time before
								it becomes visible publicly.
							</p>
						</div>
					)}

					{review.status === 'removed' && (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
							<p className="text-sm text-red-800">
								This review was removed for not following community guidelines.
								If you think this is incorrect, please contact support.
							</p>
						</div>
					)}

					{review.hasReply &&
						review.hostReply &&
						review.hostReplyStatus === 'published' && (
							<div>
								<p className="meta-text mb-2">Host Reply</p>
								<ReviewReplyBlock
									reply={review.hostReply}
									repliedAt={review.hostRepliedAt!}
								/>
							</div>
						)}

					{review.hasReply && review.hostReplyStatus === 'removed' && (
						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="text-sm italic text-ink-muted">
								Host reply was removed by moderation.
							</p>
						</div>
					)}
				</div>

				<div className="flex gap-3 border-t border-line-muted px-6 py-4">
					<Button type="button" variant="secondary" onClick={onClose}>
						Close
					</Button>
					{review.canEdit && onEdit && (
						<Button type="button" onClick={onEdit}>
							Edit Review
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};

export default ViewReviewModal;
