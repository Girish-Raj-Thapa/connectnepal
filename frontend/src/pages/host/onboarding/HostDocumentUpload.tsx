import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import onboardingService from '@services/onboarding.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import DocumentUpload from '@components/form/DocumentUpload';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import notification from '@utils/notifications';
import { HOST_SIDEBAR } from '@/constants/hostOnboarding';
import { ROUTES } from '@/constants/routes';


const HostDocumentUpload = () => {
	const navigate = useNavigate();

	const [citizenshipFile, setCitizenshipFile] = useState<File | null>(null);
	const [panFile, setPanFile] = useState<File | null>(null);
	const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(
		null,
	);
	const [uploading, setUploading] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);

	const hasDocuments = citizenshipFile || panFile || businessLicenseFile;

	const handleSubmit = async () => {
		if (!hasDocuments) {
			void navigate(ROUTES.HOST_ONBOARDING_COMPLETE);
			return;
		}

		setUploading(true);
		setApiError(null);

		try {
			await onboardingService.submitHostDocuments({
				citizenshipFile: citizenshipFile ?? undefined,
				panFile: panFile ?? undefined,
				businessLicenseFile: businessLicenseFile ?? undefined,
			});
			notification.success('Documents uploaded successfully!');
			void navigate(ROUTES.HOST_ONBOARDING_COMPLETE);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to upload documents';
			setApiError(message);
			notification.error(message);
		} finally {
			setUploading(false);
		}
	};

	const handleSkip = () => {
		void navigate(ROUTES.HOST_ONBOARDING_COMPLETE);
	};

	return (
		<OnboardingLayout
			sidebar={HOST_SIDEBAR[3]}
			currentStep={3}
			totalSteps={4}
		>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h2 className="section-heading text-ink">
						Upload Verification Documents
					</h2>
					<p className="page-subtext mt-1">
						Please provide the following to verify your host account.
						This is optional and can be done later from your
						dashboard.
					</p>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<div className="space-y-4">
					<DocumentUpload
						label="Citizenship Document"
						value={citizenshipFile}
						onChange={setCitizenshipFile}
					/>
					<DocumentUpload
						label="PAN Registration"
						value={panFile}
						onChange={setPanFile}
					/>
					<DocumentUpload
						label="Business License"
						value={businessLicenseFile}
						onChange={setBusinessLicenseFile}
					/>
				</div>

				<p className="text-sm text-ink-muted">
					<strong>Verification Status:</strong> Pending review after
					upload.
				</p>

				{/* Buttons */}
				<div className="flex items-center justify-between pt-4">
					<Button
						variant="ghost"
						type="button"
						onClick={handleSkip}
					>
						Skip for now
					</Button>
					<Button
						variant="primary"
						loading={uploading}
						disabled={uploading}
						onClick={() => void handleSubmit()}
					>
						{uploading ? 'Uploading...' : 'Submit for Verification'}
					</Button>
				</div>
			</div>
		</OnboardingLayout>
	);
};

export default HostDocumentUpload;
