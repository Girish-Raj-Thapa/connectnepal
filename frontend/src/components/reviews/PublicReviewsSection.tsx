/**
 * PublicReviewsSection Component
 * ------------------------------
 * Reusable public reviews list for listing or package detail pages.
 * Shows rating summary, reviewer name, stars, comment, date, optional host reply.
 * Loads reviews in small batches with a "View more reviews" button.
 * Mounted on PublicListingDetails and PublicPackageDetail.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Flag } from 'lucide-react';
import Loader from '@components/feedback/Loader';
import ReviewStars from './ReviewStars';
import ReviewReplyBlock from './ReviewReplyBlock';
import ReportReviewModal from './ReportReviewModal';
import reviewsService from '@services/reviews.service';
import type { Review, PaginatedResponse } from '@/types/reviews';

interface PublicReviewsSectionProps {
	targetType: 'listing' | 'package';
	targetId: number;
	ratingAverage?: number;
	ratingCount?: number;
	showRatingSummary?: boolean;
}

const REVIEWS_BATCH_SIZE = 3;

const PublicReviewsSection = ({
	targetType,
	targetId,
	ratingAverage,
	ratingCount,
	showRatingSummary = true,
}: PublicReviewsSectionProps) => {
	const [reviews, setReviews] = useState<Review[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState('');
	const [reportingReviewId, setReportingReviewId] = useState<number | null>(
		null,
	);

	const fetchIdRef = useRef(0);

	const fetchReviews = useCallback(async (pageToLoad: number, append = false) => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			if (append) {
				setLoadingMore(true);
			} else {
				setLoading(true);
			}
			setError('');

			let data: PaginatedResponse<Review>;
			if (targetType === 'listing') {
				data = await reviewsService.listListingReviews(
					targetId,
					pageToLoad,
					REVIEWS_BATCH_SIZE,
				);
			} else {
				data = await reviewsService.listPackageReviews(
					targetId,
					pageToLoad,
					REVIEWS_BATCH_SIZE,
				);
			}
			if (currentFetchId !== fetchIdRef.current) return;

			setReviews((prev) =>
				append ? [...prev, ...data.results] : data.results,
			);
			setTotalCount(data.count);
			setPage(pageToLoad);
			setHasMore(data.next !== null);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const msg =
				err instanceof Error ? err.message : 'Failed to load reviews';
			setError(msg);
		} finally {
			if (currentFetchId === fetchIdRef.current) {
				setLoading(false);
				setLoadingMore(false);
			}
		}
	}, [targetType, targetId]);

	useEffect(() => {
		setReviews([]);
		setTotalCount(0);
		setPage(1);
		setHasMore(false);
		setError('');
		setLoadingMore(false);
		setReportingReviewId(null);
		void fetchReviews(1);
	}, [fetchReviews]);

	const handleLoadMore = () => {
		if (loadingMore || !hasMore) return;
		void fetchReviews(page + 1, true);
	};

	if (loading && reviews.length === 0) {
		return (
			<div className="flex justify-center py-12">
				<Loader text="Loading reviews..." />
			</div>
		);
	}

	if (error && reviews.length === 0) {
		return (
			<div className="text-center py-8">
				<p className="text-ink-muted">{error}</p>
			</div>
		);
	}

	if (reviews.length === 0) {
		return (
			<div className="text-center py-8">
				<p className="text-ink-muted">
					No reviews yet. Be the first to share your experience!
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Rating Summary (only if ratingCount provided and >= 3) */}
			{showRatingSummary &&
				ratingCount != null &&
				ratingCount >= 3 &&
				ratingAverage != null && (
					<div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-2">
						<div className="flex items-center gap-3">
							<span className="text-2xl font-bold text-ink">
								{ratingAverage.toFixed(1)}
							</span>
						<ReviewStars rating={Math.round(ratingAverage)} size="md" />
					</div>
						<p className="text-sm text-ink-muted mt-1">
							Based on {ratingCount} verified review
							{ratingCount !== 1 ? 's' : ''}
						</p>
					</div>
				)}

			{/* "New" label when < 3 reviews */}
			{showRatingSummary &&
				ratingCount != null &&
				ratingCount > 0 &&
				ratingCount < 3 && (
					<div className="bg-surface-muted border border-line rounded-xl p-3 mb-2">
						<p className="text-sm text-ink-muted">
							New &middot; {ratingCount} review{ratingCount !== 1 ? 's' : ''}
						</p>
					</div>
				)}

			{/* Review cards */}
			{reviews.map((review) => {
				const formattedDate = formatDistanceToNow(
					new Date(review.createdAt),
					{
						addSuffix: true,
					},
				);

				return (
					<div
						key={review.id}
						className="bg-surface-muted rounded-xl border border-line p-4"
					>
						{/* Reviewer info */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-xs">
									{review.traveller.firstName[0]}
								</div>
								<div>
									<p className="font-semibold text-sm text-ink">
										{review.traveller.firstName}
									</p>
									<p className="text-xs text-ink-muted">{formattedDate}</p>
								</div>
							</div>
							<ReviewStars rating={review.rating} size="sm" />
						</div>

						{/* Comment */}
						<p className="text-sm text-ink-secondary leading-relaxed mb-3">
							{review.comment}
						</p>

						{/* Host reply if exists and published */}
						{review.hasReply &&
							review.hostReply &&
							review.hostReplyStatus === 'published' && (
								<ReviewReplyBlock
									reply={review.hostReply}
									repliedAt={review.hostRepliedAt!}
								/>
							)}

						{/* Report button */}
						<div className="mt-3 pt-3 border-t border-line-muted">
							<button
								type="button"
								onClick={() => setReportingReviewId(review.id)}
								className="flex items-center gap-1 text-ink-muted hover:text-ink-secondary text-xs font-medium"
							>
								<Flag className="w-3 h-3" />
								Report
							</button>
						</div>
					</div>
				);
				})}

			{/* Load more */}
			{reviews.length > 0 && (
				<div className="mt-6 space-y-3">
					{totalCount > reviews.length && (
						<p className="text-sm text-ink-muted">
							Showing {reviews.length} of {totalCount} review
							{totalCount !== 1 ? 's' : ''}
						</p>
					)}
					{error && (
						<p className="text-sm text-red-600">{error}</p>
					)}
					{hasMore && (
						<button
							type="button"
							onClick={handleLoadMore}
							disabled={loadingMore}
							className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:border-teal-600 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{loadingMore ? 'Loading more reviews...' : 'View more reviews'}
						</button>
					)}
				</div>
			)}

			{/* Report Modal */}
			{reportingReviewId !== null && (
				<ReportReviewModal
					reviewId={reportingReviewId}
					targetType="review"
					onSuccess={() => setReportingReviewId(null)}
					onClose={() => setReportingReviewId(null)}
				/>
			)}
		</div>
	);
};

export default PublicReviewsSection;
