import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X as XIcon } from 'lucide-react';
import Button from '@components/button/Button';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import reviewsService from '@services/reviews.service';
import notification from '@utils/notifications';
import {
	hostReplySchema,
	type HostReplyFormData,
} from '@utils/validators/reviews';
import type { HostInboxReview } from '@/types/reviews';

interface ReplyReviewModalProps {
	review: HostInboxReview;
	onSuccess: (updated: HostInboxReview) => void;
	onClose: () => void;
}

const ReplyReviewModal = ({
	review,
	onSuccess,
	onClose,
}: ReplyReviewModalProps) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<HostReplyFormData>({
		resolver: yupResolver(hostReplySchema),
		defaultValues: {
			reply: review.hostReply || '',
		},
	});

	const replyText = useWatch({ control, name: 'reply' }) ?? '';

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<HostReplyFormData>(async (data) => {
			const updated = await reviewsService.postHostReply(review.id, {
				reply: data.reply,
			});
			notification.success(
				review.hasReply
					? 'Reply updated successfully.'
					: 'Reply posted successfully.',
			);
			onSuccess(updated);
		});

	const onSubmit = (data: HostReplyFormData) => {
		void (async () => {
			await handleApiSubmit(data);
		})();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="reply-modal-title"
		>
			<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
				<div className="flex items-center justify-between mb-5">
					<h3
						id="reply-modal-title"
						className="font-bold text-ink text-lg"
					>
						{review.hasReply ? 'Edit Reply' : 'Reply to Review'}
					</h3>
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

					<Controller
						name="reply"
						control={control}
						render={({ field }) => (
							<div>
								<TextAreaField
									{...field}
									label="Your Reply"
									placeholder="Write a thoughtful response to this review..."
									rows={4}
									maxLength={2000}
									error={errors.reply?.message}
								/>
								<p className="text-xs text-ink-muted mt-1">
									{replyText.length} / 2000 characters
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
							disabled={submitting}
						>
							{review.hasReply ? 'Update Reply' : 'Post Reply'}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default ReplyReviewModal;
