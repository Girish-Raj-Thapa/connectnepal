import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import authService from '@services/auth.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import Button from '@components/button/Button';
import { TRAVELLER_SIDEBAR } from '@/constants/travellerOnboarding';
import { ROUTES } from '@/constants/routes';

const OnboardingComplete = () => {
	const navigate = useNavigate();
	const { updateUser } = useAuth();

	// Refresh user state on mount so the app knows onboarding is complete.
	// Deferred here so the routing guard doesn't redirect away from earlier
	// onboarding pages (preferences → complete).
	useEffect(() => {
		void (async () => {
			const updatedUser = await authService.getCurrentUser();
			updateUser(updatedUser);
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<OnboardingLayout
			sidebar={TRAVELLER_SIDEBAR[3]}
			currentStep={3}
			totalSteps={3}
		>
			<div className="text-center py-8">
				{/* Success Icon */}
				<div className="flex justify-center mb-6">
					<div className="w-20 h-20 rounded-full bg-brand-subtle flex items-center justify-center">
						<CheckCircle size={40} className="text-tealbrand" />
					</div>
				</div>

				{/* Heading */}
				<h2 className="page-heading text-ink mb-3">
					You're All Set, Traveller!
				</h2>

				{/* Description */}
				<p className="page-subtext mb-8 max-w-md mx-auto">
					Your profile is complete. Start discovering Nepal's best
					experiences curated just for you. Connect with trusted local
					hosts and explore authentic Nepalese culture.
				</p>

				{/* CTA */}
				<Button
					variant="primary"
					onClick={() => void navigate(ROUTES.TRAVELLER_DASHBOARD)}
				>
					Go to Home
				</Button>
			</div>
		</OnboardingLayout>
	);
};

export default OnboardingComplete;
