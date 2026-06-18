import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, Eye, Shield } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import TableActionIcon from '@components/common/TableActionIcon';
import Loader from '@components/feedback/Loader';
import AdminReviewReportModal from '@components/reviews/AdminReviewReportModal';
import ReviewStatusBadge from '@components/reviews/ReviewStatusBadge';
import ReviewStars from '@components/reviews/ReviewStars';
import { AdminReviewsService } from '@services/admin.reviews.service';
import notification from '@utils/notifications';
import { formatDate } from '@utils/format';
import type { ReviewReport } from '@/types/reviews';

type FilterTab = 'open' | 'resolved' | 'dismissed';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
	{ value: 'open', label: 'Open' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'dismissed', label: 'Dismissed' },
];

const PAGE_SIZE = 8;

const REPORT_STATUS_CLASSES = {
	open: 'bg-amber-50 text-amber-700',
	resolved: 'bg-emerald-50 text-emerald-700',
	dismissed: 'bg-surface-muted text-ink-muted',
} as const;

const ModerationDashboard = () => {
	const [reports, setReports] = useState<ReviewReport[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [filter, setFilter] = useState<FilterTab>('open');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selectedReport, setSelectedReport] = useState<ReviewReport | null>(null);

	const fetchIdRef = useRef(0);

	const fetchReports = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await AdminReviewsService.listReports({
				status: filter,
				page,
			});
			if (currentFetchId !== fetchIdRef.current) return;
			setReports(data.results);
			setTotalCount(data.count);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			const msg =
				err instanceof Error ? err.message : 'Failed to load reports';
			setError(msg);
			notification.error(msg);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [filter, page]);

	useEffect(() => {
		void fetchReports();
	}, [fetchReports]);

	const handleModerate = async (
		report: ReviewReport,
		action: string,
		note: string,
	) => {
		try {
			if (report.targetType === 'review') {
				await AdminReviewsService.moderateReview(report.reviewId, {
					action: action as 'mark_published' | 'mark_under_review' | 'mark_removed',
					note: note || undefined,
				});
			} else {
				await AdminReviewsService.moderateReply(report.reviewId, {
					action: action as 'remove_reply' | 'keep_reply',
					note: note || undefined,
				});
			}

			notification.success('Moderation action applied.');
			setReports((prev) => prev.filter((item) => item.id !== report.id));
			setTotalCount((prev) => Math.max(0, prev - 1));
			setSelectedReport(null);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : 'Failed to moderate';
			notification.error(msg);
			throw err;
		}
	};

	return (
		<DashboardLayout>
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6">
					<div className="flex items-center gap-3">
						<Shield className="w-7 h-7 text-teal-600" />
						<h1 className="page-heading text-ink">Review Moderation</h1>
					</div>
					<p className="page-subtext mt-1">
						Review and act on reported reviews and host replies.
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

				{loading && reports.length === 0 && (
					<div className="flex justify-center py-20">
						<Loader text="Loading reports..." />
					</div>
				)}

				{error && !loading && (
					<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
						{error}
					</div>
				)}

				{!loading && reports.length === 0 && !error && (
					<div className="text-center py-12">
						<CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
						<p className="text-ink-muted">No {filter} reports. All clear!</p>
					</div>
				)}

				{!loading && reports.length > 0 && (
					<div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm mb-6">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[980px] table-fixed">
								<thead>
									<tr className="bg-surface-muted border-b border-line">
										<th className="w-[16%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Target
										</th>
										<th className="w-[16%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Reporter
										</th>
										<th className="w-[14%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Reason
										</th>
										<th className="w-[14%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Rating
										</th>
										<th className="w-[22%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Status
										</th>
										<th className="w-[10%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Date
										</th>
										<th className="w-[8%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line-muted">
									{reports.map((report) => (
										<tr
											key={report.id}
											className="transition-colors hover:bg-surface-muted"
										>
											<td className="px-5 py-4 align-top">
												<div className="min-w-0">
													<p className="text-sm font-semibold text-ink">
														{report.targetType === 'review'
															? 'Review'
															: 'Host Reply'}
													</p>
													<p className="meta-text mt-1">
														Review #{report.reviewId}
													</p>
												</div>
											</td>
											<td className="px-5 py-4 align-top">
												<p className="break-all text-sm text-ink-secondary">
													{report.reporterEmail}
												</p>
											</td>
											<td className="px-5 py-4 align-top">
												<p className="text-sm capitalize text-ink-secondary">
													{report.reason.replace(/_/g, ' ')}
												</p>
											</td>
											<td className="px-5 py-4 align-top">
												<ReviewStars rating={report.reviewRating} size="sm" />
											</td>
											<td className="px-5 py-4 align-top">
												<div className="flex flex-col gap-2">
													<span
														className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${REPORT_STATUS_CLASSES[report.status]}`}
													>
														{report.status}
													</span>
													<ReviewStatusBadge status={report.reviewStatus} />
												</div>
											</td>
											<td className="px-5 py-4 align-top">
												<span className="text-sm text-ink-secondary">
													{formatDate(report.createdAt)}
												</span>
											</td>
											<td className="px-5 py-4 align-top">
												<TableActionIcon
													label={`View report ${report.id}`}
													tooltip="View"
													onClick={() => setSelectedReport(report)}
													icon={<Eye className="w-4 h-4" />}
													size="sm"
												/>
											</td>
										</tr>
									))}
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

			{selectedReport && (
				<AdminReviewReportModal
					report={selectedReport}
					onClose={() => setSelectedReport(null)}
					onModerate={handleModerate}
				/>
			)}
		</DashboardLayout>
	);
};

export default ModerationDashboard;
