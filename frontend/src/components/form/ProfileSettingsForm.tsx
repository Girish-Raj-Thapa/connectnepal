import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { User, Phone, MapPin, Lock, Eye, EyeOff } from 'lucide-react';
import InputField from '@components/form/InputField';
import Dropdown from '@components/form/Dropdown';
import PhotoUpload from '@components/form/PhotoUpload';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import { useAuth } from '@context/AuthContext';
import authService from '@services/auth.service';
import profileService from '@services/profile.service';
import notification from '@utils/notifications';
import {
	profileSchema,
	changePasswordSchema,
	type ProfileFormData,
	type ChangePasswordFormData,
} from '@utils/validators/profile';
import { GENDER_OPTIONS } from '@/constants/genderOptions';
import TravellerPreferencesSettingsForm from '@components/form/TravellerPreferencesSettingsForm';
import HostBusinessProfileSettingsForm from '@components/form/HostBusinessProfileSettingsForm';
import HostDocumentsSettingsForm from '@components/form/HostDocumentsSettingsForm';

const ProfileSettingsForm = () => {
	const { user, updateUser } = useAuth();
	const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
	const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences' | 'business' | 'documents'>('profile');

	// ── Profile Form ──
	const {
		apiError: profileApiError,
		submitting: profileSubmitting,
		handleSubmit: handleProfileSubmit,
	} = useApiSubmit<ProfileFormData>(async (data) => {
		await profileService.updateProfile({
			...data,
			profilePhoto: profilePhoto ?? undefined,
		});
		const updatedUser = await authService.getCurrentUser();
		updateUser(updatedUser);
		notification.success('Profile updated successfully!');
	});

	const profileForm = useForm<ProfileFormData>({
		resolver: yupResolver(profileSchema),
		defaultValues: {
			firstName: user?.firstName ?? '',
			lastName: user?.lastName ?? '',
			middleName: user?.middleName ?? '',
			phone: user?.phone ?? '',
			dateOfBirth: user?.dateOfBirth ?? '',
			gender: user?.gender ?? '',
			address: user?.address ?? '',
		},
	});

	const onProfileSubmit = profileForm.handleSubmit((data) => {
		void (async () => {
			await handleProfileSubmit(data);
		})();
	});

	// ── Password Form ──
	const passwordForm = useForm<ChangePasswordFormData>({
		resolver: yupResolver(changePasswordSchema),
	});

	const {
		apiError: passwordApiError,
		submitting: passwordSubmitting,
		handleSubmit: handlePasswordSubmit,
	} = useApiSubmit<ChangePasswordFormData>(async (data) => {
		await profileService.changePassword(data);
		notification.success('Password changed successfully!');
		passwordForm.reset();
	});

	const onPasswordSubmit = passwordForm.handleSubmit((data) => {
		void (async () => {
			await handlePasswordSubmit(data);
		})();
	});

	// ── Password visibility toggles ──
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	return (
		<div>
			{/* Tabs */}
			<div className="flex gap-1 mb-6 bg-surface-muted rounded-lg p-1 w-fit">
				<button
					type="button"
					onClick={() => setActiveTab('profile')}
					className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
						activeTab === 'profile'
							? 'bg-surface text-teal-700 shadow-sm'
							: 'text-ink-muted hover:text-ink'
					}`}
				>
					Profile
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('password')}
					className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
						activeTab === 'password'
							? 'bg-surface text-teal-700 shadow-sm'
							: 'text-ink-muted hover:text-ink'
					}`}
				>
					Change Password
				</button>
				{user?.role === 'traveller' && (
					<button
						type="button"
						onClick={() => setActiveTab('preferences')}
						className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
							activeTab === 'preferences'
								? 'bg-surface text-teal-700 shadow-sm'
								: 'text-ink-muted hover:text-ink'
						}`}
					>
						Travel Preferences
					</button>
				)}
				{user?.role === 'host' && (
					<>
						<button
							type="button"
							onClick={() => setActiveTab('business')}
							className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
								activeTab === 'business'
									? 'bg-surface text-teal-700 shadow-sm'
									: 'text-ink-muted hover:text-ink'
							}`}
						>
							Business Profile
						</button>
						<button
							type="button"
							onClick={() => setActiveTab('documents')}
							className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
								activeTab === 'documents'
									? 'bg-surface text-teal-700 shadow-sm'
									: 'text-ink-muted hover:text-ink'
							}`}
						>
							Documents
						</button>
					</>
				)}
			</div>

			{/* ═══ PROFILE TAB ═══ */}
			{activeTab === 'profile' && (
				<div className="bg-surface rounded-xl border border-line p-6">
					<form onSubmit={(e) => void onProfileSubmit(e)} className="space-y-5">
						{/* Header + Photo */}
						<div className="flex items-center justify-between mb-2">
							<div>
								<h2 className="section-heading text-ink">Profile Information</h2>
								<p className="page-subtext mt-1">
									Update your personal details
								</p>
							</div>
							<PhotoUpload
								value={profilePhoto}
								onChange={setProfilePhoto}
								existingUrl={user?.profilePhoto}
							/>
						</div>

						{profileApiError && <FormErrorBanner>{profileApiError}</FormErrorBanner>}

						{/* First Name + Last Name */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Controller
								name="firstName"
								control={profileForm.control}
								render={({ field }) => (
									<InputField
										{...field}
										label="First Name"
										placeholder="John"
										icon={User}
										error={profileForm.formState.errors.firstName?.message}
										required
									/>
								)}
							/>
							<Controller
								name="lastName"
								control={profileForm.control}
								render={({ field }) => (
									<InputField
										{...field}
										label="Last Name"
										placeholder="Doe"
										icon={User}
										error={profileForm.formState.errors.lastName?.message}
										required
									/>
								)}
							/>
						</div>

						{/* Middle Name */}
						<Controller
							name="middleName"
							control={profileForm.control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Middle Name"
									placeholder="Middle name (optional)"
									icon={User}
									error={profileForm.formState.errors.middleName?.message}
								/>
							)}
						/>

						{/* Email (read-only) */}
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
								control={profileForm.control}
								render={({ field }) => (
									<InputField
										{...field}
										label="Date of Birth"
										type="date"
										error={profileForm.formState.errors.dateOfBirth?.message}
									/>
								)}
							/>
							<Controller
								name="gender"
								control={profileForm.control}
								render={({ field }) => (
									<Dropdown
										name={field.name}
										value={field.value}
										onChange={field.onChange}
										label="Gender"
										options={GENDER_OPTIONS}
										placeholder="Select gender"
										error={profileForm.formState.errors.gender?.message}
									/>
								)}
							/>
						</div>

						{/* Phone */}
						<Controller
							name="phone"
							control={profileForm.control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Phone"
									type="tel"
									placeholder="+977 98XXXXXXXX"
									icon={Phone}
									error={profileForm.formState.errors.phone?.message}
									required
								/>
							)}
						/>

						{/* Address */}
						<Controller
							name="address"
							control={profileForm.control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Address"
									placeholder="Street address"
									icon={MapPin}
									error={profileForm.formState.errors.address?.message}
								/>
							)}
						/>

						{/* Submit */}
						<div className="flex justify-end pt-4">
							<Button
								type="submit"
								variant="primary"
								loading={profileSubmitting}
								disabled={profileSubmitting}
							>
								{profileSubmitting ? 'Saving...' : 'Save Changes'}
							</Button>
						</div>
					</form>
				</div>
			)}

			{/* ═══ PASSWORD TAB ═══ */}
			{activeTab === 'password' && (
				<div className="bg-surface rounded-xl border border-line p-6 max-w-lg">
					<h2 className="section-heading text-ink mb-1">Change Password</h2>
					<p className="page-subtext mb-5">
						Enter your current password and choose a new one
					</p>

					{passwordApiError && <FormErrorBanner>{passwordApiError}</FormErrorBanner>}

					<form onSubmit={(e) => void onPasswordSubmit(e)} className="space-y-4">
						{/* Current Password */}
						<Controller
							name="currentPassword"
							control={passwordForm.control}
							render={({ field }) => (
								<div className="relative">
									<InputField
										{...field}
										label="Current Password"
										type={showCurrent ? 'text' : 'password'}
										placeholder="Enter current password"
										icon={Lock}
										error={passwordForm.formState.errors.currentPassword?.message}
										required
									/>
									<button
										type="button"
										onClick={() => setShowCurrent(!showCurrent)}
										className="absolute right-3 top-9 text-ink-muted hover:text-ink-muted"
									>
										{showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								</div>
							)}
						/>

						{/* New Password */}
						<Controller
							name="newPassword"
							control={passwordForm.control}
							render={({ field }) => (
								<div className="relative">
									<InputField
										{...field}
										label="New Password"
										type={showNew ? 'text' : 'password'}
										placeholder="Enter new password"
										icon={Lock}
										error={passwordForm.formState.errors.newPassword?.message}
										required
									/>
									<button
										type="button"
										onClick={() => setShowNew(!showNew)}
										className="absolute right-3 top-9 text-ink-muted hover:text-ink-muted"
									>
										{showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								</div>
							)}
						/>

						{/* Confirm Password */}
						<Controller
							name="confirmPassword"
							control={passwordForm.control}
							render={({ field }) => (
								<div className="relative">
									<InputField
										{...field}
										label="Confirm New Password"
										type={showConfirm ? 'text' : 'password'}
										placeholder="Re-enter new password"
										icon={Lock}
										error={passwordForm.formState.errors.confirmPassword?.message}
										required
									/>
									<button
										type="button"
										onClick={() => setShowConfirm(!showConfirm)}
										className="absolute right-3 top-9 text-ink-muted hover:text-ink-muted"
									>
										{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								</div>
							)}
						/>

						<div className="flex justify-end pt-4">
							<Button
								type="submit"
								variant="primary"
								loading={passwordSubmitting}
								disabled={passwordSubmitting}
							>
								{passwordSubmitting ? 'Changing...' : 'Change Password'}
							</Button>
						</div>
					</form>
				</div>
			)}

			{/* TRAVEL PREFERENCES TAB */}
			{activeTab === 'preferences' && <TravellerPreferencesSettingsForm />}

			{/* HOST BUSINESS PROFILE TAB */}
			{activeTab === 'business' && <HostBusinessProfileSettingsForm />}

			{/* HOST DOCUMENTS TAB */}
			{activeTab === 'documents' && <HostDocumentsSettingsForm />}
		</div>
	);
};

export default ProfileSettingsForm;
