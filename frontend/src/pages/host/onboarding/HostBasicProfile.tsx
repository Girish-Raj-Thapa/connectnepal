import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin } from 'lucide-react';
import {
	hostBasicProfileSchema,
	type HostBasicProfileFormData,
} from '@utils/validators';
import { useAuth } from '@context/AuthContext';
import authService from '@services/auth.service';
import onboardingService from '@services/onboarding.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import InputField from '@components/form/InputField';
import PhotoUpload from '@components/form/PhotoUpload';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { HOST_SIDEBAR } from '@/constants/hostOnboarding';
import { ROUTES } from '@/constants/routes';


const HostBasicProfile = () => {
    const navigate = useNavigate();
	const { user, updateUser } = useAuth();
	const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<HostBasicProfileFormData>(async (data) => {
		await onboardingService.submitHostBasicProfile({
			firstName: data.firstName,
			lastName: data.lastName,
			phone: data.phone,
			address: data.address || undefined,
			profilePhoto: profilePhoto ?? undefined,
			// Host API doesn't accept country/city — pass dummy values to satisfy BasicProfileRequest type
			country: '',
			city: '',
		});

		// Refresh user to get updated onboardingStep
		const updatedUser = await authService.getCurrentUser();
		updateUser(updatedUser);

		notification.success('Profile saved successfully!');
		void navigate(ROUTES.HOST_ONBOARDING_BUSINESS);
	});

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<HostBasicProfileFormData>({
		resolver: yupResolver(hostBasicProfileSchema),
		defaultValues: {
			firstName: user?.firstName ?? '',
			lastName: user?.lastName ?? '',
			phone: user?.phone ?? '',
			address: user?.address ?? '',
		},
	});

	const onSubmit = (data: HostBasicProfileFormData) => {
		void (async () => {
			const ok = await handleApiSubmit(data);
			if (!ok) {
				notification.error('Failed to save profile');
			}
		})();
	};
	const submitHandler = handleSubmit(onSubmit);

	const loading = isSubmitting || submitting;

    return (
        <OnboardingLayout
			sidebar={HOST_SIDEBAR[1]}
			currentStep={1}
			totalSteps={4}
		>
            <form onSubmit={(e) => void submitHandler(e)} className="space-y-5">
				{/* Header + Photo */}
				<div className="flex items-center justify-between mb-2">
					<div>
						<h2 className="section-heading text-ink">
							Basic Information
						</h2>
						<p className="page-subtext mt-1">
							Tell us a bit about yourself to get started
						</p>
					</div>
					<PhotoUpload
						value={profilePhoto}
						onChange={setProfilePhoto}
						existingUrl={user?.profilePhoto}
					/>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				{/* First Name + Last Name */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Controller
						name="firstName"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="First Name"
								placeholder="John"
								icon={User}
								error={errors.firstName?.message}
								required
							/>
						)}
					/>
					<Controller
						name="lastName"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Last Name"
								placeholder="Doe"
								icon={User}
								error={errors.lastName?.message}
								required
							/>
						)}
					/>
				</div>

				{/* Email (read-only, not in form schema) */}
				<InputField
					label="Email Address"
					type="email"
					value={user?.email ?? ''}
					disabled
					name="email"
					placeholder=""
				/>

				{/* Phone */}
				<Controller
					name="phone"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Phone"
							type="tel"
							placeholder="+977 98XXXXXXXX"
							icon={Phone}
							error={errors.phone?.message}
							required
						/>
					)}
				/>

				{/* Address */}
				<Controller
					name="address"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Address"
							placeholder="Pokhara, Kaski, Nepal"
							icon={MapPin}
							error={errors.address?.message}
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

export default HostBasicProfile;
