import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

/**
 * Shows a banner for unverified hosts explaining their restrictions.
 * Only renders when isVerified === false (sourced from GET /api/listings/host/limits/).
 *
 * Use this component at the top of ManageListings.tsx and CreateListing.tsx.
 */
const VerificationBanner = ({ isVerified }: { isVerified: boolean | null | undefined }) => {
	const navigate = useNavigate();

	// null/undefined means limits not yet loaded — don't show banner prematurely
	if (isVerified == null || isVerified === true) return null;

	return (
		<div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
			<ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
			<div className="flex-1">
				<h3 className="text-sm font-bold text-amber-800">Account Not Yet Verified</h3>
				<p className="text-xs text-amber-700 mt-1 leading-relaxed">
					Unverified hosts are limited to <strong>2 active bookable listings</strong> and a{' '}
					<strong>transaction limit of NPR 50,000</strong>. Complete your verification to
					unlock full access.
				</p>
			</div>
			<button
				type="button"
				onClick={() => void navigate(ROUTES.HOST_SETTINGS)}
				className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
			>
				Verify Now <ArrowRight className="w-3 h-3" />
			</button>
		</div>
	);
};

export default VerificationBanner;
