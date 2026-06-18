import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, Flag, MessageSquare } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import TableActionIcon from '@components/common/TableActionIcon';
import Loader from '@components/feedback/Loader';
import HostReviewViewModal from '@components/reviews/HostReviewViewModal';
import ReplyReviewModal from '@components/reviews/ReplyReviewModal';
import ReportReviewModal from '@components/reviews/ReportReviewModal';
import ReviewStars from '@components/reviews/ReviewStars';
import ReviewStatusBadge from '@components/reviews/ReviewStatusBadge';
import { getReviewItemTitle, getReviewItemType } from '@components/reviews/reviewDisplay';
import reviewsService from '@services/reviews.service';
import notification from '@utils/notifications';
import { formatDate } from '@utils/format';
import type { HostInboxReview } from '@/types/reviews';

type FilterTab = 'all' | 'awaiting' | 'replied';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
	{ value: 'all', label: 'All Reviews' },
	{ value: 'awaiting', label: 'Awaiting Reply' },
	{ value: 'replied', label: 'Replied' },
];

const PAGE_SIZE = 8;

const HostReviews = () => {
	const [reviews, setReviews] = useState<HostInboxReview[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [filter, setFilter] = useState<FilterTab>('all');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [reviewToView, setReviewToView] = useState<HostInboxReview | null>(null);
	const [reviewToReply, setReviewToReply] = useState<HostInboxReview | null>(null);
	const [reviewToReport, setReviewToReport] = useState<HostInboxReview | null>(null);

	const fetchIdRef = useRef(0);

	const fetchReviews = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await reviewsService.listHostReviews(page);
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
		if (filter === 'awaiting') return !review.hasReply;
		if (filter === 'replied') return review.hasReply;
		return true;
	});

	const handleReplySuccess = (updated: HostInboxReview) => {
		setReviews((prev) =>
			prev.map((review) => (review.id === updated.id ? updated : review)),
		);
		setReviewToReply(null);
		setReviewToView((prev) => (prev?.id === updated.id ? updated : prev));
	};

	const renderReplyStatus = (review: HostInboxReview) => {
		if (review.hasReply) {
			return (
				<span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
					Replied
				</span>
			);
		}

		if (review.canReply) {
			return (
				<span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
					Awaiting Reply
				</span>
			);
		}

		return (
			<span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-muted">
				Reply Unavailable
			</span>
		);
	};

	return (
		<DashboardLayout>
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6">
					<h1 className="page-heading text-ink">Reviews</h1>
					<p className="page-subtext mt-1">
						View and respond to guest reviews of your listings and packages.
					</p>
				</div>
			</div>

			<div>
				<div className="flex gap-2 mb-6 flex-wrap">
					{FILTER_TABS.map((tab) => (
						<button
							key={tab.value}
							type="button"
							onClick={() => {
								setFilter(tab.value);
								setPage(1);
							}}
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
						<p className="text-ink-muted">No reviews yet.</p>
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
							<table className="w-full min-w-[920px] table-fixed">
								<thead>
									<tr className="bg-surface-muted border-b border-line">
										<th className="w-[16%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Traveller
										</th>
										<th className="w-[26%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Item
										</th>
										<th className="w-[14%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Rating
										</th>
										<th className="w-[20%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Status
										</th>
										<th className="w-[12%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Date
										</th>
										<th className="w-[12%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line-muted">
									{filteredReviews.map((review) => {
										const itemTitle = getReviewItemTitle(review);
										const itemType = getReviewItemType(review);

										return (
											<tr
												key={review.id}
												className="transition-colors hover:bg-surface-muted"
											>
												<td className="px-5 py-4 align-top">
													<div className="min-w-0">
														<p className="text-sm font-semibold text-ink">
															{review.traveller.firstName}
														</p>
														{review.reportCount > 0 && (
															<p className="meta-text mt-1 text-red-600">
																{review.reportCount} report
																{review.reportCount === 1 ? '' : 's'}
															</p>
														)}
													</div>
												</td>
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
													<div className="flex flex-col gap-2">
														<ReviewStatusBadge status={review.status} />
														{renderReplyStatus(review)}
													</div>
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
														{review.canReply && (
															<TableActionIcon
																label={`${review.hasReply ? 'Edit reply to' : 'Reply to'} review for ${itemTitle}`}
																tooltip={review.hasReply ? 'Edit Reply' : 'Reply'}
																onClick={() => setReviewToReply(review)}
																icon={<MessageSquare className="w-4 h-4" />}
																size="sm"
															/>
														)}
														<TableActionIcon
															label={`Report review for ${itemTitle}`}
															tooltip="Report"
															onClick={() => setReviewToReport(review)}
															icon={<Flag className="w-4 h-4" />}
															size="sm"
														/>
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
				<HostReviewViewModal
					review={reviewToView}
					onClose={() => setReviewToView(null)}
					onReply={
						reviewToView.canReply
							? () => {
									setReviewToReply(reviewToView);
									setReviewToView(null);
								}
							: undefined
					}
				/>
			)}

			{reviewToReply && (
				<ReplyReviewModal
					review={reviewToReply}
					onSuccess={handleReplySuccess}
					onClose={() => setReviewToReply(null)}
				/>
			)}

			{reviewToReport && (
				<ReportReviewModal
					reviewId={reviewToReport.id}
					targetType="review"
					onSuccess={() => setReviewToReport(null)}
					onClose={() => setReviewToReport(null)}
				/>
			)}
		</DashboardLayout>
	);
};

export default HostReviews;
