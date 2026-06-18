import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import authService from '@services/auth.service';
import Loader from '@components/feedback/Loader';
import AuthLayout from '@layouts/AuthLayout';
import ResultCard from '@components/feedback/ResultCard';
import { ROUTES } from '@constants/routes';

type VerificationStatus = 'verifying' | 'success' | 'error';

const EmailVerified = () => {
	const [searchParams] = useSearchParams();
	const [status, setStatus] = useState<VerificationStatus>('verifying');
	const [errorMessage, setErrorMessage] = useState('');
	const [alreadyActivated, setAlreadyActivated] = useState(false);
	const hasAttempted = useRef(false);

	useEffect(() => {
		// Guard against React StrictMode double-invoking effects in dev
		if (hasAttempted.current) return;
		hasAttempted.current = true;

		const verifyEmail = async () => {
			const uid = searchParams.get('uid');
			const token = searchParams.get('token');

			if (!uid || !token) {
				setStatus('error');
				setErrorMessage('Verification link is missing or invalid.');
				return;
			}

			try {
				await authService.activateAccount(uid, token);
				setStatus('success');
			} catch (error) {
				const message = error instanceof Error
					? error.message
					: 'Verification failed. Link may be invalid or expired.';

				// If the account was already activated, treat as success to avoid confusing users
				if (message.toLowerCase().includes('already activated')) {
					setAlreadyActivated(true);
					setStatus('success');
					return;
				}

				setStatus('error');
				setErrorMessage(message);
			}
		};

		void verifyEmail();
	}, [searchParams]);

	if (status === 'verifying') {
		return (
			<AuthLayout>
				<div className="text-center py-8">
					<Loader size="lg" text="Verifying your email..." />
				</div>
			</AuthLayout>
		);
	}

	if (status === 'error') {
		return (
			<AuthLayout>
				<ResultCard
					icon={
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-12 w-12"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					}
					title="Verification Failed"
					message={errorMessage}
					action={{ label: 'Go to Register', to: ROUTES.REGISTER }}
					variant="error"
				/>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout>
			<ResultCard
				icon={
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-12 w-12"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
					</svg>
				}
				title={alreadyActivated ? 'Email Already Verified' : 'Email Verified!'}
				message={
					alreadyActivated
						? 'This account was already activated. You can go ahead and log in.'
						: 'Your account has been successfully activated. You can now log in and start exploring Nepal.'
				}
				action={{ label: 'Go to Login →', to: ROUTES.LOGIN }}
				variant="success"
			/>
		</AuthLayout>
	);
};

export default EmailVerified;
