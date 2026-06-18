import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordFormData } from '@utils/validators';
import authService from '@services/auth.service';
import AuthLayout from '@layouts/AuthLayout';
import PasswordField from '@components/form/PasswordField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ROUTES } from '@constants/routes';

const ResetPassword = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const uid = searchParams.get('uid');
	const token = searchParams.get('token');

		const { apiError, submitting, handleSubmit: handleApiSubmit } =
			useApiSubmit<ResetPasswordFormData>(async (data) => {
				await authService.confirmPasswordReset(uid!, token!, data);
				notification.success('Password reset successful!');
				void navigate(ROUTES.LOGIN);
			});

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ResetPasswordFormData>({
		resolver: yupResolver(resetPasswordSchema),
		defaultValues: {
			newPassword: '',
			confirmPassword: '',
		},
	});

	const onSubmit = (data: ResetPasswordFormData) => {
		if (!uid || !token) {
			return;
		}
		void handleApiSubmit(data);
	};
	const submitHandler = handleSubmit(onSubmit);

	if (!uid || !token) {
		return (
			<AuthLayout>
				<div className="text-center">
					<div className="flex justify-center mb-6">
						<div className="bg-red-100 p-5 rounded-full">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-12 w-12 text-red-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
					</div>

					<h1 className="page-heading text-ink mb-3">
						Invalid Reset Link
					</h1>

					<p className="page-subtext mb-6">
						This password reset link is invalid or has expired.
					</p>

					<div className="border-t border-line-muted my-6" />

					<Link
						to={ROUTES.FORGOT_PASSWORD}
						className="text-brand font-semibold hover:text-tealbrand-dark hover:underline"
					>
						Request a new reset link
					</Link>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			header
			title="Reset Password"
			subtitle="Enter your new password below"
		>
			<form onSubmit={(e) => void submitHandler(e)} className="space-y-4">
				{apiError && (
					<FormErrorBanner>{apiError}</FormErrorBanner>
				)}

				<Controller
					name="newPassword"
					control={control}
					render={({ field }) => (
						<PasswordField
							{...field}
							label="New Password"
							placeholder="••••••••"
							error={errors.newPassword?.message}
							required
						/>
					)}
				/>

				<Controller
					name="confirmPassword"
					control={control}
					render={({ field }) => (
						<PasswordField
							{...field}
							label="Confirm New Password"
							placeholder="••••••••"
							error={errors.confirmPassword?.message}
							required
						/>
					)}
				/>

				<Button
					type="submit"
					variant="primary"
					fullWidth
					loading={isSubmitting || submitting}
					disabled={isSubmitting || submitting}
				>
					{isSubmitting || submitting ? 'Resetting...' : 'Reset Password'}
				</Button>

				<div className="text-center text-sm text-ink-muted border-t border-line-muted pt-4 mt-5">
					Remember your password?{' '}
					<Link
						to={ROUTES.LOGIN}
						className="text-brand font-semibold hover:text-tealbrand-dark hover:underline ml-1"
					>
						Sign in
					</Link>
				</div>
			</form>
		</AuthLayout>
	);
};

export default ResetPassword;
