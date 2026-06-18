import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { registerSchema, type RegisterFormData } from '@utils/validators';
import authService from '@services/auth.service';
import AuthLayout from '@layouts/AuthLayout';
import InputField from '@components/form/InputField';
import PasswordField from '@components/form/PasswordField';
import RadioGroup from '@components/form/RadioGroup';
import Button from '@components/button/Button';
import { ROLE_OPTIONS } from '@constants/roleOptions';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ROUTES } from '@constants/routes';

const Register = () => {
	const navigate = useNavigate();
	const { apiError, submitting, handleSubmit: handleApiSubmit } = useApiSubmit<RegisterFormData>(
		async (data) => {
				await authService.register(data);
				notification.success('Account Created Successfully!');
				void navigate(ROUTES.EMAIL_CONFIRMATION, {
					state: { email: data.email },
				});
			}
		);

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<RegisterFormData>({
		resolver: yupResolver(registerSchema),
		defaultValues: {
			email: '',
			password: '',
			confirmPassword: '',
			role: undefined,
		},
	});

	const onSubmit = (data: RegisterFormData) => {
		void (async () => {
			const ok = await handleApiSubmit(data);
			if (!ok) {
				notification.error('Failed to Create Account');
			}
		})();
	};
	const submitHandler = handleSubmit(onSubmit);

	return (
		<AuthLayout
			header
			title="Join Our Community"
			subtitle="Connect with Nepal's authentic tourism experiences"
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

				<Controller
					name="password"
					control={control}
					render={({ field }) => (
						<PasswordField
							{...field}
							label="Password"
							placeholder="••••••••"
							error={errors.password?.message}
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
							label="Confirm Password"
							placeholder="••••••••"
							error={errors.confirmPassword?.message}
							required
						/>
					)}
				/>

				<Controller
					name="role"
					control={control}
					render={({ field }) => (
						<RadioGroup
							{...field}
							label="Register As"
							options={ROLE_OPTIONS}
							error={errors.role?.message}
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
					{isSubmitting || submitting ? 'Creating Account...' : 'Create Account'}
				</Button>

				<div className="text-center text-sm text-ink-muted border-t border-line-muted pt-4 mt-5">
					Already part of our community?{' '}
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

export default Register;
