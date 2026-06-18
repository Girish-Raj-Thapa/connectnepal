import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { loginSchema, type LoginFormData } from '@utils/validators';
import { useAuth } from '@context/AuthContext';
import AuthLayout from '@layouts/AuthLayout';
import InputField from '@components/form/InputField';
import PasswordField from '@components/form/PasswordField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import { ROUTES } from '@constants/routes';

const Login = () => {
	const { login } = useAuth();
	const { apiError, submitting, handleSubmit: handleApiSubmit } = useApiSubmit<LoginFormData>(
		async (data) => {
			await login(data);
		}
	);

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormData>({
		resolver: yupResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
		},
	});

	const onSubmit = (data: LoginFormData) => void handleApiSubmit(data);
	const submitHandler = handleSubmit(onSubmit);

	return (
		<AuthLayout
			header
			title="Welcome Back"
			subtitle="Sign in to continue your journey with ConnectNepal"
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
							placeholder="Enter your password"
							error={errors.password?.message}
							required
						/>
					)}
				/>

				<div className="text-right">
					<Link
						to={ROUTES.FORGOT_PASSWORD}
						className="text-sm text-brand hover:text-tealbrand-dark hover:underline"
					>
						Forgot password?
					</Link>
				</div>

				<Button
					type="submit"
					variant="primary"
					fullWidth
					loading={isSubmitting || submitting}
					disabled={isSubmitting || submitting}
				>
					{isSubmitting || submitting ? 'Signing in...' : 'Sign In'}
				</Button>

				<div className="text-center text-sm text-ink-muted border-t border-line-muted pt-4 mt-5">
					Don't have an account?{' '}
					<Link
						to={ROUTES.REGISTER}
						className="text-brand font-semibold hover:text-tealbrand-dark hover:underline ml-1"
					>
						Create one
					</Link>
				</div>
			</form>
		</AuthLayout>
	);
};

export default Login;
