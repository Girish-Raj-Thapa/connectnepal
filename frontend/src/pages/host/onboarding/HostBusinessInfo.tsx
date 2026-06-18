import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import { Building, MapPin } from 'lucide-react';
import {
	hostBusinessInfoSchema,
	type HostBusinessInfoFormData,
} from '@utils/validators';
import onboardingService from '@services/onboarding.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import InputField from '@components/form/InputField';
import TextAreaField from '@components/form/TextAreaField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { HOST_SIDEBAR } from '@/constants/hostOnboarding';
import { ROUTES } from '@/constants/routes';


const HostBusinessInfo = () => {
    const navigate = useNavigate();

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<HostBusinessInfoFormData>(async (data) => {
		// Submit business info (completes onboarding on backend)
		await onboardingService.submitHostBusinessInfo({
			businessName: data.businessName,
			businessAddress: data.businessAddress,
			businessPhone: data.businessPhone || undefined,
			aboutService: data.aboutService || undefined,
		});

		// Don't refresh user here — the routing guard would see onboarding as
		// complete and redirect away from the documents page. User state is
		// refreshed in HostDocumentUpload instead.
		notification.success('Business info saved!');
		void navigate(ROUTES.HOST_ONBOARDING_DOCUMENTS);
	});

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<HostBusinessInfoFormData>({
		resolver: yupResolver(hostBusinessInfoSchema),
		defaultValues: {
			businessName: '',
			businessAddress: '',
			businessPhone: '',
			aboutService: '',
		},
	});

	const onSubmit = (data: HostBusinessInfoFormData) => {
		void (async () => {
			const ok = await handleApiSubmit(data);
			if (!ok) {
				notification.error('Failed to save business info');
			}
		})();
	};
	const submitHandler = handleSubmit(onSubmit);

	const loading = isSubmitting || submitting;

	return (
		<OnboardingLayout
			sidebar={HOST_SIDEBAR[2]}
			currentStep={2}
			totalSteps={4}
		>
			<form onSubmit={(e) => void submitHandler(e)} className="space-y-6">
				{/* Header */}
				<div>
					<h2 className="section-heading text-ink">
						Business Information
					</h2>
					<p className="page-subtext mt-1">
						Tell us about your service to start hosting with
						ConnectNepal.
					</p>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				{/* Business Name */}
				<Controller
					name="businessName"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Business Name"
							placeholder="Himalayan Adventures"
							icon={Building}
							error={errors.businessName?.message}
							required
						/>
					)}
				/>

				{/* Business Address */}
				<Controller
					name="businessAddress"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Business Address"
							placeholder="Pokhara, Kaski, Nepal"
							icon={MapPin}
							error={errors.businessAddress?.message}
							required
						/>
					)}
				/>

				{/* About Your Service */}
				<Controller
					name="aboutService"
					control={control}
					render={({ field }) => (
						<TextAreaField
							{...field}
							label="About Your Service"
							placeholder="Describe what kind of service or experience you offer..."
							error={errors.aboutService?.message}
							rows={4}
						/>
					)}
				/>

				{/* Buttons */}
				<div className="flex items-center justify-between pt-4">
					<Button
						variant="ghost"
						type="button"
						onClick={() => void submitHandler()}
					>
						Skip for now
					</Button>
					<Button
						type="submit"
						variant="primary"
						loading={loading}
						disabled={loading}
					>
						{loading ? 'Saving...' : 'Continue'}
					</Button>
				</div>
			</form>
		</OnboardingLayout>
	);
};

export default HostBusinessInfo;
