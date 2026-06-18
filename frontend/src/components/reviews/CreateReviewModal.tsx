import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X as XIcon } from 'lucide-react';
import Button from '@components/button/Button';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import reviewsService from '@services/reviews.service';
import {
	createReviewSchema,
	type CreateReviewFormData,
} from '@utils/validators/reviews';
import ReviewStars from './ReviewStars';
import type { CreateReviewPayload } from '@/types/reviews';

interface CreateReviewModalProps {
	bookingItemId: number;
	targetTitle?: string;
	onSuccess: () => void;
	onClose: () => void;
}

interface CreateReviewFormInput {
	rating: number;
	comment: string | undefined;
}

const CreateReviewModal = ({
	bookingItemId,
	targetTitle,
	onSuccess,
	onClose,
}: CreateReviewModalProps) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateReviewFormInput, unknown, CreateReviewFormData>({
		resolver: yupResolver(createReviewSchema),
		defaultValues: {
			rating: 0,
			comment: '',
		},
	});

	const rating = useWatch({ control, name: 'rating' }) ?? 0;
	const comment = useWatch({ control, name: 'comment' }) ?? '';

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<CreateReviewFormData>(async (data) => {
			const payload: CreateReviewPayload = {
				bookingItemId,
				rating: data.rating,
				comment: data.comment || '',
			};
			await reviewsService.createReview(payload);
			onSuccess();
		});

	const onSubmit = (data: CreateReviewFormData) => {
		void (async () => {
			await handleApiSubmit(data);
		})();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-review-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
				<div className="flex items-center justify-between mb-5">
					<div>
						<h3
							id="create-review-modal-title"
							className="font-bold text-ink text-lg"
						>
							Write a Review
						</h3>
						{targetTitle && (
							<p className="text-sm text-ink-muted mt-1">{targetTitle}</p>
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
							Post Review
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default CreateReviewModal;
