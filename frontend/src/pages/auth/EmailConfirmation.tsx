import { useLocation, Link } from 'react-router-dom';
import AuthLayout from '@layouts/AuthLayout';
import { ROUTES } from '@constants/routes';

const EmailConfirmation = () => {
	const location = useLocation();
	const email = (location.state as { email?: string })?.email ?? 'your email';

	return (
		<AuthLayout>
			<div className="text-center">
				{/* Envelope Icon */}
				<div className="flex justify-center mb-6">
					<div className="bg-brand-subtle p-5 rounded-full animate-float">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-12 w-12 text-tealbrand"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					</div>
				</div>

				{/* Title */}
				<h1 className="page-heading text-ink mb-3">
					Email Confirmation
				</h1>

				{/* Description */}
				<p className="page-subtext mb-4">
					We've sent a verification link to your email address:
				</p>

				<p className="font-medium text-tealbrand text-sm mb-4">
					{email}
				</p>

				<p className="page-subtext mb-8">
					Please check your inbox or spam folder and click the link to verify your account.
				</p>

				{/* Divider */}
				<div className="border-t border-line-muted my-6" />

				{/* Login link */}
				<p className="text-ink-secondary text-sm">
					Already verified?{' '}
					<Link
						to={ROUTES.LOGIN}
						className="text-tealbrand font-semibold hover:text-tealbrand-dark hover:underline"
					>
						Click here to login
					</Link>
				</p>
			</div>
		</AuthLayout>
	);
};

export default EmailConfirmation;
