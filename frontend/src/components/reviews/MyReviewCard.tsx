import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Pencil, Flag } from 'lucide-react';
import Button from '@components/button/Button';
import ReviewStars from './ReviewStars';
import ReviewReplyBlock from './ReviewReplyBlock';
import ReviewStatusBadge from './ReviewStatusBadge';
import EditReviewModal from './EditReviewModal';
import ReportReviewModal from './ReportReviewModal';
import type { Review } from '@/types/reviews';

interface MyReviewCardProps {
	review: Review;
	onDeleteSuccess: () => void;
	onEditSuccess?: (updated: Review) => void;
}

const MyReviewCard = ({ review, onDeleteSuccess, onEditSuccess }: MyReviewCardProps) => {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showReportModal, setShowReportModal] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const targetLabel = review.listingId ? 'Listing' : 'Package';
	const targetId = review.listingId || review.packageId;
	const formattedDate = formatDistanceToNow(new Date(review.createdAt), {
		addSuffix: true,
	});

	const handleDelete = () => {
		try {
			setDeleting(true);
			onDeleteSuccess();
			setShowDeleteConfirm(false);
		} finally {
			setDeleting(false);
		}
	};

	const isActionable =
		review.status === 'published' || review.status === 'under_review';

	return (
		<>
			<div
				className={`bg-surface rounded-2xl border p-5 shadow-sm ${
					review.status === 'removed'
						? 'border-red-200 bg-red-50/30'
						: review.status === 'user_deleted'
							? 'border-line bg-surface-muted/30'
							: 'border-line'
				}`}
			>
				{/* Header */}
				<div className="flex items-start justify-between gap-4 mb-3">
					<div>
						<ReviewStars rating={review.rating} size="sm" />
						<p className="text-xs text-ink-muted mt-2">
							{targetLabel} #{targetId}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ReviewStatusBadge status={review.status} />
						<p className="text-xs text-ink-muted whitespace-nowrap">
							{formattedDate}
						</p>
					</div>
				</div>

				{/* Edited indicator */}
				{review.editCount > 0 && (
					<p className="text-xs text-ink-muted mb-2">
						(edited {review.editCount} time{review.editCount !== 1 ? 's' : ''})
					</p>
				)}

				{/* Comment */}
				<p className="text-sm text-ink-secondary leading-relaxed mb-3">
					{review.comment}
				</p>

				{/* Status-specific info messages */}
				{review.status === 'under_review' && (
					<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
						<p className="text-xs text-amber-800">
							Your review is under moderation. Thank you for your feedback!
						</p>
					</div>
				)}

				{review.status === 'removed' && (
					<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
						<p className="text-xs text-red-800">
							This review was removed for not following community guidelines. If
							you think this is a mistake, please contact support.
						</p>
					</div>
				)}

				{/* Host reply if exists and visible */}
				{review.hasReply &&
					review.hostReply &&
					review.hostReplyStatus === 'published' && (
						<ReviewReplyBlock
							reply={review.hostReply}
							repliedAt={review.hostRepliedAt!}
						/>
					)}

				{/* Host reply removed notice */}
				{review.hasReply && review.hostReplyStatus === 'removed' && (
					<div className="bg-surface-muted border border-line rounded-lg p-3 mb-3">
						<p className="text-xs text-ink-muted italic">
							Host reply was removed by moderation.
						</p>
					</div>
				)}

				{/* Action buttons */}
				{isActionable && (
					<div className="mt-4 pt-4 border-t border-line-muted flex flex-wrap gap-3">
						{/* Edit button */}
						{review.canEdit && (
							<button
								type="button"
								onClick={() => setShowEditModal(true)}
								className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm"
							>
								<Pencil className="w-4 h-4" />
								Edit Review
							</button>
						)}

						{/* Report host reply button (only if reply is published) */}
						{review.hasReply && review.hostReplyStatus === 'published' && (
							<button
								type="button"
								onClick={() => setShowReportModal(true)}
								className="flex items-center gap-2 text-ink-muted hover:text-ink-secondary font-medium text-sm"
							>
								<Flag className="w-4 h-4" />
								Report Reply
							</button>
						)}

						{/* Delete button */}
						{review.canDelete && (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm"
							>
								<Trash2 className="w-4 h-4" />
								Delete Review
							</button>
						)}
					</div>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					role="dialog"
					aria-modal="true"
				>
					<div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
						<h3 className="font-bold text-ink text-lg mb-2">
							Delete This Review?
						</h3>
						<p className="text-sm text-ink-muted mb-5">
							Your review will be removed from public view. You will not be able
							to write a new review for this item.
						</p>
						<div className="flex gap-3">
							<Button
								type="button"
								variant="secondary"
								fullWidth
								onClick={() => setShowDeleteConfirm(false)}
								disabled={deleting}
							>
								Keep Review
							</Button>
							<Button
								type="button"
								variant="danger"
								fullWidth
								onClick={handleDelete}
								loading={deleting}
								disabled={deleting}
							>
								Delete
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Modal */}
			{showEditModal && (
				<EditReviewModal
					review={review}
					onSuccess={(updated) => {
						setShowEditModal(false);
						onEditSuccess?.(updated);
					}}
					onClose={() => setShowEditModal(false)}
				/>
			)}

			{/* Report Host Reply Modal */}
			{showReportModal && (
				<ReportReviewModal
					reviewId={review.id}
					targetType="host_reply"
					onSuccess={() => setShowReportModal(false)}
					onClose={() => setShowReportModal(false)}
				/>
			)}
		</>
	);
};

export default MyReviewCard;
