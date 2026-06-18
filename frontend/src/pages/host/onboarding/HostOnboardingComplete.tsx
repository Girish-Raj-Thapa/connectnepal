import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import authService from '@services/auth.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import Button from '@components/button/Button';
import { HOST_SIDEBAR } from '@/constants/hostOnboarding';
import { ROUTES } from '@/constants/routes';


const HostOnboardingComplete = () => {
	const navigate = useNavigate();
	const { updateUser } = useAuth();

	// Refresh user state on mount so the app knows onboarding is complete.
	// Deferred here so the routing guard doesn't redirect away from earlier
	// onboarding pages (business-info → documents → complete).
	useEffect(() => {
		void (async () => {
			const updatedUser = await authService.getCurrentUser();
			updateUser(updatedUser);
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<OnboardingLayout
			sidebar={HOST_SIDEBAR[4]}
			currentStep={4}
			totalSteps={4}
		>
			<div className="text-center py-8">
				{/* Success Icon */}
				<div className="flex justify-center mb-6">
					<div className="w-20 h-20 rounded-full bg-brand-subtle flex items-center justify-center">
						<CheckCircle size={40} className="text-tealbrand" />
					</div>
				</div>

				{/* Heading */}
				<h2 className="page-heading text-ink mb-2">
					Your Host Profile Setup Is Complete!
				</h2>

				{/* Description */}
				<p className="page-subtext mb-8 max-w-md mx-auto">
					You can now create listings and start your hosting journey.
					Verification may take{' '}
					<strong>24–48 hours</strong>, after which your
					profile will display a verified badge.
				</p>

				{/* CTA */}
				<Button
					variant="primary"
					onClick={() => void navigate(ROUTES.HOST_DASHBOARD)}
				>
					Go to Host Dashboard
				</Button>
			</div>
		</OnboardingLayout>
	);
};

export default HostOnboardingComplete;
