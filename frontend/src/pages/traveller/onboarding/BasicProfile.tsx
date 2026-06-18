import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin } from 'lucide-react';
import {
	basicProfileSchema,
	type BasicProfileFormData,
} from '@utils/validators';
import { useAuth } from '@context/AuthContext';
import authService from '@services/auth.service';
import onboardingService from '@services/onboarding.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import InputField from '@components/form/InputField';
import Dropdown from '@components/form/Dropdown';
import PhotoUpload from '@components/form/PhotoUpload';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { GENDER_OPTIONS } from '@/constants/genderOptions';
import { TRAVELLER_SIDEBAR } from '@/constants/travellerOnboarding';
import { ROUTES } from '@/constants/routes';

const BasicProfile = () => {
	const navigate = useNavigate();
	const { user, updateUser } = useAuth();
	const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<BasicProfileFormData>(async (data) => {
		await onboardingService.submitTravellerBasicProfile({
			...data,
			profilePhoto: profilePhoto ?? undefined,
		});

		// Refresh user to get updated onboardingStep
		const updatedUser = await authService.getCurrentUser();
		updateUser(updatedUser);

		notification.success('Profile saved successfully!');
		void navigate(ROUTES.TRAVELLER_ONBOARDING_PREFERENCES);
	});

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<BasicProfileFormData>({
		resolver: yupResolver(basicProfileSchema),
		defaultValues: {
			firstName: user?.firstName ?? '',
			lastName: user?.lastName ?? '',
			middleName: user?.middleName ?? '',
			phone: user?.phone ?? '',
			country: user?.country ?? '',
			city: user?.city ?? '',
			dateOfBirth: user?.dateOfBirth ?? '',
			gender: user?.gender ?? '',
			address: user?.address ?? '',
		},
	});

	const onSubmit = (data: BasicProfileFormData) => {
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
			sidebar={TRAVELLER_SIDEBAR[1]}
			currentStep={1}
			totalSteps={3}
		>
			<form onSubmit={(e) => void submitHandler(e)} className="space-y-5">
				{/* Header + Photo */}
				<div className="flex items-center justify-between mb-2">
					<div>
						<h2 className="section-heading text-ink">
							Basic Information
						</h2>
						<p className="page-subtext mt-1">
							Tell us a bit about yourself
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

				{/* Middle Name */}
				<Controller
					name="middleName"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Middle Name"
							placeholder="Middle name (optional)"
							icon={User}
							error={errors.middleName?.message}
						/>
					)}
				/>

				{/* Email (read-only, not in form schema) */}
				<InputField
					label="Email Address"
					type="email"
					value={user?.email ?? ''}
					disabled
					name="email"
					placeholder=""
				/>

				{/* Date of Birth + Gender */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Controller
						name="dateOfBirth"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Date of Birth"
								type="date"
								error={errors.dateOfBirth?.message}
							/>
						)}
					/>
					<Controller
						name="gender"
						control={control}
						render={({ field }) => (
							<Dropdown
								name={field.name}
								value={field.value}
								onChange={field.onChange}
								label="Gender"
								options={GENDER_OPTIONS}
								placeholder="Select gender"
								error={errors.gender?.message}
							/>
						)}
					/>
				</div>

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

				{/* Country + City */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Controller
						name="country"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Country"
								placeholder="Nepal"
								icon={MapPin}
								error={errors.country?.message}
								required
							/>
						)}
					/>
					<Controller
						name="city"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="City"
								placeholder="Kathmandu"
								icon={MapPin}
								error={errors.city?.message}
								required
							/>
						)}
					/>
				</div>

				{/* Address */}
				<Controller
					name="address"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Address"
							placeholder="Street address"
							icon={MapPin}
							error={errors.address?.message}
						/>
					)}
				/>

				{/* Buttons */}
				<div className="flex items-center justify-end pt-4">
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

export default BasicProfile;
