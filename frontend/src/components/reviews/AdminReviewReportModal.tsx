import { useState } from 'react';
import { X as XIcon } from 'lucide-react';
import Button from '@components/button/Button';
import { formatDate } from '@utils/format';
import ReviewStars from './ReviewStars';
import ReviewStatusBadge from './ReviewStatusBadge';
import type { ReviewReport } from '@/types/reviews';

interface AdminReviewReportModalProps {
	report: ReviewReport;
	onClose: () => void;
	onModerate: (report: ReviewReport, action: string, note: string) => Promise<void>;
}

const REVIEW_ACTION_OPTIONS = [
	{ value: 'mark_published', label: 'Mark Published' },
	{ value: 'mark_under_review', label: 'Mark Under Review' },
	{ value: 'mark_removed', label: 'Mark Removed' },
];

const REPLY_ACTION_OPTIONS = [
	{ value: 'keep_reply', label: 'Keep Reply' },
	{ value: 'remove_reply', label: 'Remove Reply' },
];

const STATUS_CLASSES = {
	open: 'bg-amber-50 text-amber-700',
	resolved: 'bg-emerald-50 text-emerald-700',
	dismissed: 'bg-surface-muted text-ink-muted',
} as const;

const AdminReviewReportModal = ({
	report,
	onClose,
	onModerate,
}: AdminReviewReportModalProps) => {
	const [action, setAction] = useState('');
	const [note, setNote] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const actionOptions =
		report.targetType === 'review'
			? REVIEW_ACTION_OPTIONS
			: REPLY_ACTION_OPTIONS;

	const handleSubmit = async () => {
		if (!action) {
			return;
		}

		try {
			setSubmitting(true);
			await onModerate(report, action, note);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="admin-review-report-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
				<div className="shrink-0 flex items-start justify-between gap-4 border-b border-line-muted px-6 py-5">
					<div className="min-w-0">
						<p className="meta-text uppercase tracking-[0.24em]">
							{report.targetType === 'review' ? 'Review Report' : 'Host Reply Report'}
						</p>
						<h3
							id="admin-review-report-modal-title"
							className="section-heading text-ink mt-2"
						>
							Review #{report.reviewId}
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

				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
					<div className="grid gap-4 sm:grid-cols-4">
						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Reporter</p>
							<p className="mt-2 text-sm font-medium text-ink break-all">
								{report.reporterEmail}
							</p>
						</div>

						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Reason</p>
							<p className="mt-2 text-sm font-medium capitalize text-ink">
								{report.reason.replace(/_/g, ' ')}
							</p>
						</div>

						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Report Status</p>
							<div className="mt-2">
								<span
									className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[report.status]}`}
								>
									{report.status}
								</span>
							</div>
						</div>

						<div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
							<p className="meta-text">Reported On</p>
							<p className="mt-2 text-sm font-medium text-ink">
								{formatDate(report.createdAt)}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-line bg-surface px-4 py-4">
						<div className="flex flex-wrap items-center gap-3">
							<ReviewStars rating={report.reviewRating} size="sm" />
							<ReviewStatusBadge status={report.reviewStatus} />
						</div>
						<p className="mt-4 text-sm italic leading-7 text-ink-secondary whitespace-pre-wrap">
							&ldquo;{report.reviewComment}&rdquo;
						</p>
					</div>

					{report.details && (
						<div>
							<p className="meta-text mb-2">Report Details</p>
							<div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
								<p className="text-sm leading-7 text-ink-secondary whitespace-pre-wrap">
									{report.details}
								</p>
							</div>
						</div>
					)}

					{report.status !== 'open' && (
						<div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
							<p className="meta-text">Resolution</p>
							<p className="mt-2 text-sm text-ink-secondary">
								{report.resolutionNote || 'No resolution note provided.'}
							</p>
							{report.resolvedAt && (
								<p className="meta-text mt-2">
									Resolved {formatDate(report.resolvedAt)}
									{report.resolvedByEmail ? ` by ${report.resolvedByEmail}` : ''}
								</p>
							)}
						</div>
					)}

					{report.status === 'open' && (
						<div className="rounded-xl border border-line bg-surface px-4 py-4 space-y-4">
							<p className="text-sm font-semibold text-ink">
								Moderation Action
							</p>

							<div className="space-y-2">
								{actionOptions.map((option) => (
									<label
										key={option.value}
										className="flex items-center gap-3 cursor-pointer"
									>
										<input
											type="radio"
											name={`action-${report.id}`}
											value={option.value}
											checked={action === option.value}
											onChange={() => setAction(option.value)}
											className="w-4 h-4 text-teal-600"
										/>
										<span className="text-sm text-ink-secondary">
											{option.label}
										</span>
									</label>
								))}
							</div>

							<div>
								<label className="text-sm font-medium text-ink-secondary">
									Note (optional)
								</label>
								<textarea
									value={note}
									onChange={(e) => setNote(e.target.value)}
									className="mt-1 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
									rows={3}
									placeholder="Moderation notes..."
								/>
							</div>
						</div>
					)}
				</div>

				<div className="shrink-0 flex gap-3 border-t border-line-muted px-6 py-4">
					<Button type="button" variant="secondary" onClick={onClose}>
						Close
					</Button>
					{report.status === 'open' && (
						<Button
							type="button"
							onClick={() => void handleSubmit()}
							loading={submitting}
							disabled={submitting || !action}
						>
							Submit Action
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};

export default AdminReviewReportModal;
