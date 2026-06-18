import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X as XIcon, Flag } from 'lucide-react';
import Button from '@components/button/Button';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import reviewsService from '@services/reviews.service';
import notification from '@utils/notifications';
import {
	reportReviewSchema,
	type ReportReviewFormData,
} from '@utils/validators/reviews';
import type { ReportReason } from '@/types/reviews';

interface ReportReviewModalProps {
	reviewId: number;
	targetType: 'review' | 'host_reply';
	onSuccess: () => void;
	onClose: () => void;
}

interface ReportReviewFormInput {
	reason: ReportReason;
	details: string | undefined;
}

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
	{ value: 'abusive_language', label: 'Abusive Language' },
	{ value: 'hate_speech', label: 'Hate Speech' },
	{ value: 'threats', label: 'Threats' },
	{ value: 'spam', label: 'Spam' },
	{ value: 'irrelevant_content', label: 'Irrelevant Content' },
	{ value: 'fraudulent_claim', label: 'Fraudulent Claim' },
	{ value: 'privacy_violation', label: 'Privacy Violation' },
	{ value: 'other', label: 'Other' },
];

const ReportReviewModal = ({
	reviewId,
	targetType,
	onSuccess,
	onClose,
}: ReportReviewModalProps) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ReportReviewFormInput, unknown, ReportReviewFormData>({
		resolver: yupResolver(reportReviewSchema),
		defaultValues: {
			details: '',
		},
	});

	const details = useWatch({ control, name: 'details' }) ?? '';

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<ReportReviewFormData>(async (data) => {
			const payload = {
				reason: data.reason,
				details: data.details || undefined,
			};

			if (targetType === 'review') {
				await reviewsService.reportReview(reviewId, payload);
			} else {
				await reviewsService.reportHostReply(reviewId, payload);
			}

			notification.success('Report submitted successfully.');
			onSuccess();
		});

	const onSubmit = (data: ReportReviewFormData) => {
		void (async () => {
			await handleApiSubmit(data);
		})();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="report-review-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2">
						<Flag className="w-5 h-5 text-red-500" />
						<h3
							id="report-review-modal-title"
							className="font-bold text-ink text-lg"
						>
							Report {targetType === 'review' ? 'Review' : 'Host Reply'}
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

				<form
					onSubmit={(e) => void handleSubmit(onSubmit)(e)}
					noValidate
					className="space-y-4"
				>
					{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

					{/* Reason selection */}
					<Controller
						name="reason"
						control={control}
						render={({ field }) => (
							<div>
								<label className="block text-sm font-semibold text-ink mb-2">
									Reason for Report *
								</label>
								<div className="space-y-2">
									{REASON_OPTIONS.map((option) => (
										<label
											key={option.value}
											className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-muted transition-colors"
										>
											<input
												type="radio"
												name="reason"
												value={option.value}
												checked={field.value === option.value}
												onChange={() => field.onChange(option.value)}
												className="w-4 h-4 text-teal-600 border-line focus:ring-teal-500"
											/>
											<span className="text-sm text-ink-secondary">
												{option.label}
											</span>
										</label>
									))}
								</div>
								{errors.reason && (
									<p className="text-xs text-red-600 mt-2">
										{errors.reason.message}
									</p>
								)}
							</div>
						)}
					/>

					{/* Details */}
					<Controller
						name="details"
						control={control}
						render={({ field }) => (
							<div>
								<TextAreaField
									{...field}
									value={field.value ?? ''}
									label="Additional Details (optional)"
									placeholder="Provide any additional context..."
									rows={3}
									maxLength={500}
									error={errors.details?.message}
								/>
								<p className="text-xs text-ink-muted mt-1">
									{details.length} / 500 characters
								</p>
							</div>
						)}
					/>

					<div className="flex gap-3 pt-2">
						<Button
							type="button"
							variant="secondary"
							onClick={onClose}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="danger"
							fullWidth
							loading={submitting}
							disabled={submitting}
						>
							Submit Report
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default ReportReviewModal;
