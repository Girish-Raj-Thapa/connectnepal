import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, Flag, Pencil, Trash2 } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Button from '@components/button/Button';
import Pagination from '@components/common/Pagination';
import TableActionIcon from '@components/common/TableActionIcon';
import Loader from '@components/feedback/Loader';
import EditReviewModal from '@components/reviews/EditReviewModal';
import ReportReviewModal from '@components/reviews/ReportReviewModal';
import ReviewStars from '@components/reviews/ReviewStars';
import ReviewStatusBadge from '@components/reviews/ReviewStatusBadge';
import ViewReviewModal from '@components/reviews/ViewReviewModal';
import { getReviewItemTitle, getReviewItemType } from '@components/reviews/reviewDisplay';
import reviewsService from '@services/reviews.service';
import notification from '@utils/notifications';
import { formatDate } from '@utils/format';
import type { Review, ReviewStatus } from '@/types/reviews';

type FilterTab = 'all' | 'published' | 'under_review' | 'removed';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'published', label: 'Published' },
	{ value: 'under_review', label: 'Under Review' },
	{ value: 'removed', label: 'Removed' },
];

const PAGE_SIZE = 8;

const TravellerReviews = () => {
	const [reviews, setReviews] = useState<Review[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [filter, setFilter] = useState<FilterTab>('all');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [reviewToView, setReviewToView] = useState<Review | null>(null);
	const [reviewToEdit, setReviewToEdit] = useState<Review | null>(null);
	const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
	const [reviewToReportReply, setReviewToReportReply] = useState<Review | null>(
		null,
	);
	const [deleting, setDeleting] = useState(false);

	const fetchIdRef = useRef(0);

	const fetchReviews = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await reviewsService.listMyReviews(page);
			if (currentFetchId !== fetchIdRef.current) return;
			setReviews(data.results);
			setTotalCount(data.count);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const msg =
				err instanceof Error ? err.message : 'Failed to load reviews';
			setError(msg);
			notification.error(msg);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [page]);

	useEffect(() => {
		void fetchReviews();
	}, [fetchReviews]);

	const filteredReviews = reviews.filter((review) => {
		if (filter === 'all') return true;
		return review.status === (filter as ReviewStatus);
	});

	const removeReviewFromState = (reviewId: number) => {
		setReviews((prev) => prev.filter((review) => review.id !== reviewId));
		setTotalCount((prev) => Math.max(0, prev - 1));
		setReviewToDelete(null);
		setReviewToView((prev) => (prev?.id === reviewId ? null : prev));
		setReviewToEdit((prev) => (prev?.id === reviewId ? null : prev));
		setReviewToReportReply((prev) => (prev?.id === reviewId ? null : prev));
	};

	const handleConfirmDelete = async () => {
		if (!reviewToDelete) return;

		try {
			setDeleting(true);
			await reviewsService.deleteReview(reviewToDelete.id);
			notification.success('Review deleted.');
			removeReviewFromState(reviewToDelete.id);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : 'Failed to delete review';
			notification.error(msg);
		} finally {
			setDeleting(false);
		}
	};

	const handleEditSuccess = (updated: Review) => {
		setReviews((prev) =>
			prev.map((review) => (review.id === updated.id ? updated : review)),
		);
		setReviewToEdit(null);
		setReviewToView((prev) => (prev?.id === updated.id ? updated : prev));
		notification.success('Review updated.');
	};

	return (
		<DashboardLayout>
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6">
					<h1 className="page-heading text-ink">My Reviews</h1>
					<p className="page-subtext mt-1">
						View and manage reviews you&apos;ve written about listings and packages.
					</p>
				</div>
			</div>

			<div>
				<div className="flex gap-2 mb-6 flex-wrap">
					{FILTER_TABS.map((tab) => (
						<button
							key={tab.value}
							type="button"
							onClick={() => setFilter(tab.value)}
							className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
								filter === tab.value
									? 'bg-teal-600 text-white'
									: 'bg-surface border border-line text-ink-muted hover:border-teal-600'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{loading && reviews.length === 0 && (
					<div className="flex justify-center py-20">
						<Loader text="Loading reviews..." />
					</div>
				)}

				{error && !loading && (
					<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
						{error}
					</div>
				)}

				{!loading && reviews.length === 0 && !error && (
					<div className="text-center py-12">
						<p className="text-ink-muted">
							You haven&apos;t written any reviews yet. After completing a
							booking, you can share your experience.
						</p>
					</div>
				)}

				{!loading && reviews.length > 0 && filteredReviews.length === 0 && (
					<div className="text-center py-12">
						<p className="text-ink-muted">
							No reviews match the selected filter.
						</p>
					</div>
				)}

				{!loading && filteredReviews.length > 0 && (
					<div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm mb-6">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] table-fixed">
								<thead>
									<tr className="bg-surface-muted border-b border-line">
										<th className="w-[34%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Item
										</th>
										<th className="w-[18%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Rating
										</th>
										<th className="w-[18%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Status
										</th>
										<th className="w-[16%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Date
										</th>
										<th className="w-[14%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line-muted">
									{filteredReviews.map((review) => {
										const itemTitle = getReviewItemTitle(review);
										const itemType = getReviewItemType(review);
										const hasPublishedReply =
											review.hasReply &&
											Boolean(review.hostReply) &&
											review.hostReplyStatus === 'published';

										return (
											<tr
												key={review.id}
												className="transition-colors hover:bg-surface-muted"
											>
												<td className="px-5 py-4 align-top">
													<div className="min-w-0">
														<p
															className="truncate text-sm font-semibold text-ink"
															title={itemTitle}
														>
															{itemTitle}
														</p>
														<p className="meta-text mt-1">
															{itemType}
															{review.editCount > 0
																? ` • Edited ${review.editCount}x`
																: ''}
														</p>
													</div>
												</td>
												<td className="px-5 py-4 align-top">
													<div className="flex items-center gap-3">
														<ReviewStars rating={review.rating} size="sm" />
														<span className="text-sm font-semibold text-ink">
															{review.rating.toFixed(1)}
														</span>
													</div>
												</td>
												<td className="px-5 py-4 align-top">
													<ReviewStatusBadge status={review.status} />
												</td>
												<td className="px-5 py-4 align-top">
													<span className="text-sm text-ink-secondary">
														{formatDate(review.createdAt)}
													</span>
												</td>
												<td className="px-5 py-4 align-top">
													<div className="flex items-center gap-2">
														<TableActionIcon
															label={`View review for ${itemTitle}`}
															tooltip="View"
															onClick={() => setReviewToView(review)}
															icon={<Eye className="w-4 h-4" />}
															size="sm"
														/>

														{review.canEdit && (
															<TableActionIcon
																label={`Edit review for ${itemTitle}`}
																tooltip="Edit"
																onClick={() => setReviewToEdit(review)}
																icon={<Pencil className="w-4 h-4" />}
																size="sm"
															/>
														)}

														{hasPublishedReply && (
															<TableActionIcon
																label={`Report host reply for ${itemTitle}`}
																tooltip="Report Reply"
																onClick={() => setReviewToReportReply(review)}
																icon={<Flag className="w-4 h-4" />}
																size="sm"
															/>
														)}

														{review.canDelete && (
															<TableActionIcon
																label={`Delete review for ${itemTitle}`}
																tooltip="Delete"
																onClick={() => setReviewToDelete(review)}
																icon={<Trash2 className="w-4 h-4" />}
																variant="danger"
																size="sm"
															/>
														)}
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{!loading && totalCount > PAGE_SIZE && (
					<Pagination
						currentPage={page}
						totalCount={totalCount}
						pageSize={PAGE_SIZE}
						onPageChange={setPage}
					/>
				)}
			</div>

			{reviewToView && (
				<ViewReviewModal
					review={reviewToView}
					onClose={() => setReviewToView(null)}
					onEdit={
						reviewToView.canEdit
							? () => {
									setReviewToEdit(reviewToView);
									setReviewToView(null);
								}
							: undefined
					}
				/>
			)}

			{reviewToEdit && (
				<EditReviewModal
					review={reviewToEdit}
					onSuccess={handleEditSuccess}
					onClose={() => setReviewToEdit(null)}
				/>
			)}

			{reviewToReportReply && (
				<ReportReviewModal
					reviewId={reviewToReportReply.id}
					targetType="host_reply"
					onSuccess={() => setReviewToReportReply(null)}
					onClose={() => setReviewToReportReply(null)}
				/>
			)}

			{reviewToDelete && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="delete-review-modal-title"
				>
					<div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
						<h3
							id="delete-review-modal-title"
							className="section-heading text-ink mb-2"
						>
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
								onClick={() => setReviewToDelete(null)}
								disabled={deleting}
							>
								Keep Review
							</Button>
							<Button
								type="button"
								variant="danger"
								fullWidth
								onClick={() => void handleConfirmDelete()}
								loading={deleting}
								disabled={deleting}
							>
								Delete
							</Button>
						</div>
					</div>
				</div>
			)}
		</DashboardLayout>
	);
};

export default TravellerReviews;
