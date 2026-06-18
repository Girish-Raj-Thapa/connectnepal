import { useForm, Controller, } from 'react-hook-form';
import { useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@utils/validators';
import authService from '@services/auth.service';
import AuthLayout from '@layouts/AuthLayout';
import InputField from '@components/form/InputField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import ResultCard from '@components/feedback/ResultCard';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ROUTES } from '@constants/routes';

const ForgotPassword = () => {
	const [emailSent, setEmailSent] = useState(false);
	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<ForgotPasswordFormData>(async (data) => {
			await authService.requestPasswordReset({ email: data.email });
			setEmailSent(true);
			notification.success('Password reset email sent!');
		});

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
		getValues,
	} = useForm<ForgotPasswordFormData>({
		resolver: yupResolver(forgotPasswordSchema),
		defaultValues: {
			email: '',
		},
	});

	const onSubmit = (data: ForgotPasswordFormData) => {
		void handleApiSubmit(data);
	};
	const submitHandler = handleSubmit(onSubmit);

	if (emailSent) {
		return (
			<AuthLayout>
				<ResultCard
					icon={<Mail className="h-12 w-12" />}
					title="Check Your Email"
					message={`We've sent a password reset link to ${getValues('email')}. Please check your inbox and click the link to reset your password.`}
					action={{ label: 'Back to Login', to: ROUTES.LOGIN }}
					variant="success"
				/>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			header
			title="Forgot Password"
			subtitle="Enter your email to receive a reset link"
		>
			<form onSubmit={(e) => void submitHandler(e)} className="space-y-4">
				{apiError && (
					<FormErrorBanner>{apiError}</FormErrorBanner>
				)}

				<Controller
					name="email"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Email Address"
							type="email"
							placeholder="you@example.com"
							icon={Mail}
							error={errors.email?.message}
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
					{isSubmitting || submitting ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword;
