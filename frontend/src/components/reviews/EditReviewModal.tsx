import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X as XIcon, AlertCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import Button from '@components/button/Button';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import reviewsService from '@services/reviews.service';
import {
	editReviewSchema,
	type EditReviewFormData,
} from '@utils/validators/reviews';
import ReviewStars from './ReviewStars';
import type { Review, UpdateReviewPayload } from '@/types/reviews';

interface EditReviewModalProps {
	review: Review;
	onSuccess: (updated: Review) => void;
	onClose: () => void;
}

interface EditReviewFormInput {
	rating: number;
	comment: string | undefined;
}

const EditReviewModal = ({
    review,
    onSuccess,
    onClose,
}: EditReviewModalProps) => {
    const daysRemaining = Math.max(
        0,
        30 - differenceInDays(new Date(), new Date(review.createdAt)),
    );

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<EditReviewFormInput, unknown, EditReviewFormData>({
		resolver: yupResolver(editReviewSchema),
		defaultValues: {
			rating: review.rating,
			comment: review.comment || '',
		},
	});

	const rating = useWatch({ control, name: 'rating' }) ?? 0;
	const comment = useWatch({ control, name: 'comment' }) ?? '';

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<EditReviewFormData>(async (data) => {
			const payload: UpdateReviewPayload = {};
			if (data.rating !== review.rating) payload.rating = data.rating;
			if ((data.comment || '') !== (review.comment || ''))
				payload.comment = data.comment || '';

			// Must change at least one field
			if (Object.keys(payload).length === 0) {
				throw new Error('No changes detected.');
			}

			const updated = await reviewsService.editReview(review.id, payload);
			onSuccess(updated);
		});

	const onSubmit = (data: EditReviewFormData) => {
		void (async () => {
			await handleApiSubmit(data);
		})();
	};

    return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-review-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
				<div className="flex items-center justify-between mb-5">
					<div>
						<h3
							id="edit-review-modal-title"
							className="font-bold text-ink text-lg"
						>
							Edit Review
						</h3>
						{review.editCount > 0 && (
							<p className="text-xs text-ink-muted mt-1">
								Edited {review.editCount} time
								{review.editCount !== 1 ? 's' : ''}
							</p>
						)}
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

				{/* Edit deadline warning */}
				{daysRemaining <= 7 && (
					<div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
						<AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
						<p className="text-xs text-amber-800">
							{daysRemaining === 0
								? 'This is the last day you can edit this review.'
								: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining to edit this review.`}
						</p>
					</div>
				)}

				<form
					onSubmit={(e) => void handleSubmit(onSubmit)(e)}
					noValidate
					className="space-y-4"
				>
					{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

					{/* Rating picker */}
					<Controller
						name="rating"
						control={control}
						render={({ field }) => (
							<div>
								<label className="block text-sm font-semibold text-ink mb-2">
									Your Rating *
								</label>
								<ReviewStars
									rating={field.value}
									interactive
									onSelect={field.onChange}
									size="lg"
								/>
								{errors.rating && (
									<p className="text-xs text-red-600 mt-2">
										{errors.rating.message}
									</p>
								)}
							</div>
						)}
					/>

					{/* Comment */}
					<Controller
						name="comment"
						control={control}
						render={({ field }) => (
							<div>
								<TextAreaField
									{...field}
									value={field.value ?? ''}
									label={
										rating === 1 || rating === 2
											? 'Your Comment (required for low ratings) *'
											: 'Your Comment (optional)'
									}
									placeholder="Share your experience... (5000 characters max)"
									rows={3}
									maxLength={5000}
									error={errors.comment?.message}
								/>
								<p className="text-xs text-ink-muted mt-1">
									{comment.length} / 5000 characters
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
							fullWidth
							loading={submitting}
							disabled={submitting || rating === 0}
						>
							Save Changes
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default EditReviewModal;
