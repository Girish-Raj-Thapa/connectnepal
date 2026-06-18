import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Flag } from 'lucide-react';
import Button from '@components/button/Button';
import ReviewStars from './ReviewStars';
import ReviewReplyBlock from './ReviewReplyBlock';
import ReplyReviewModal from './ReplyReviewModal';
import ReportReviewModal from './ReportReviewModal';
import type { HostInboxReview } from '@/types/reviews';

interface HostReviewCardProps {
	review: HostInboxReview;
	onReplySuccess: (updated: HostInboxReview) => void;
}

const HostReviewCard = ({ review, onReplySuccess }: HostReviewCardProps) => {
	const [showReplyModal, setShowReplyModal] = useState(false);
	const [showReportModal, setShowReportModal] = useState(false);

	const targetTitle = review.listingTitle || review.packageTitle;
	const targetType = review.listingTitle ? 'Listing' : 'Package';
	const formattedDate = formatDistanceToNow(new Date(review.createdAt), {
		addSuffix: true,
	});

	const initials = review.traveller.firstName
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

	const gradients = [
		'from-teal-400 to-teal-600',
		'from-blue-400 to-blue-600',
		'from-purple-400 to-purple-600',
		'from-orange-400 to-orange-600',
	];
	const gradientIndex = review.id % gradients.length;

	return (
		<div className="bg-surface rounded-2xl border border-line p-5 shadow-sm">
			{/* Header: Avatar, name, target */}
			<div className="flex items-start justify-between gap-4 mb-3">
				<div className="flex items-start gap-3 flex-1 min-w-0">
					<div
						className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center text-white text-xs font-bold shrink-0`}
					>
						{initials}
					</div>
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-ink text-sm">
							{review.traveller.firstName}
						</p>
						<p className="text-xs text-ink-muted">
							{targetType}: {targetTitle || '(No title)'}
						</p>
					</div>
				</div>
				<div className="flex gap-2 shrink-0">
					{/* Report count badge */}
					{review.reportCount > 0 && (
						<span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-lg whitespace-nowrap flex items-center gap-1">
							<AlertCircle className="w-3 h-3" />
							{review.reportCount} reported
						</span>
					)}
					{review.hasReply ? (
						<span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg whitespace-nowrap">
							Replied
						</span>
					) : (
						<span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg whitespace-nowrap">
							Need Response
						</span>
					)}
				</div>
			</div>

			{/* Rating and date */}
			<div className="flex items-center justify-between mb-3">
				<ReviewStars rating={review.rating} size="sm" />
				<p className="text-xs text-ink-muted">{formattedDate}</p>
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

			{/* Host reply if exists */}
			{review.hasReply &&
				review.hostReply &&
				review.hostReplyStatus === 'published' && (
					<ReviewReplyBlock
						reply={review.hostReply}
						repliedAt={review.hostRepliedAt!}
					/>
				)}

			{/* Action buttons */}
			<div className="mt-4 pt-4 border-t border-line-muted flex flex-wrap gap-2">
				{/* Reply/Edit Reply — only if canReply is true */}
					{review.canReply && (
						<Button
							variant={review.hasReply ? 'secondary' : 'primary'}
							className="px-3 py-1.5 text-sm rounded-lg"
							onClick={() => setShowReplyModal(true)}
						>
							{review.hasReply ? 'Edit Reply' : 'Reply'}
						</Button>
					)}

				{/* Cannot reply message */}
				{!review.canReply && !review.hasReply && (
					<p className="text-xs text-ink-muted italic self-center">
						Cannot reply (review is not published)
					</p>
				)}

				{/* Report review button */}
				<button
					type="button"
					onClick={() => setShowReportModal(true)}
					className="flex items-center gap-1 text-ink-muted hover:text-ink-secondary font-medium text-sm px-2 py-1"
				>
					<Flag className="w-3.5 h-3.5" />
					Report
				</button>
			</div>

			{/* Reply Modal */}
			{showReplyModal && (
				<ReplyReviewModal
					review={review}
					onSuccess={(updated) => {
						onReplySuccess(updated);
						setShowReplyModal(false);
					}}
					onClose={() => setShowReplyModal(false)}
				/>
			)}

			{/* Report Modal */}
			{showReportModal && (
				<ReportReviewModal
					reviewId={review.id}
					targetType="review"
					onSuccess={() => setShowReportModal(false)}
					onClose={() => setShowReportModal(false)}
				/>
			)}
		</div>
	);
};

export default HostReviewCard;
