import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Building2, MapPin, Phone, BadgeCheck, Clock, XCircle } from 'lucide-react';
import InputField from '@components/form/InputField';
import TextAreaField from '@components/form/TextAreaField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Loader from '@components/feedback/Loader';
import useApiSubmit from '@hooks/useApiSubmit';
import profileService from '@services/profile.service';
import notification from '@utils/notifications';
import { hostBusinessProfileSchema, type HostBusinessProfileFormData } from '@utils/validators/profile';
import type { HostProfile, HostVerificationStatus } from '@/types/accounts';

// ── Verification status badge ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<HostVerificationStatus, { label: string; classes: string; Icon: React.ElementType }> = {
	not_submitted: {
		label: 'Not Submitted',
		classes: 'bg-surface-muted text-ink-muted border-line',
		Icon: Clock,
	},
	pending: {
		label: 'Pending Review',
		classes: 'bg-amber-50 text-amber-700 border-amber-200',
		Icon: Clock,
	},
	approved: {
		label: 'Verified',
		classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		Icon: BadgeCheck,
	},
	rejected: {
		label: 'Rejected',
		classes: 'bg-red-50 text-red-700 border-red-200',
		Icon: XCircle,
	},
};

const VerificationBadge = ({ status }: { status: HostVerificationStatus }) => {
	const { label, classes, Icon } = STATUS_CONFIG[status];
	return (
		<span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${classes}`}>
			<Icon className="w-3.5 h-3.5" />
			{label}
		</span>
	);
};

// ── Main component ────────────────────────────────────────────────────────────

const HostBusinessProfileSettingsForm = () => {
	const [profile, setProfile] = useState<HostProfile | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const form = useForm<HostBusinessProfileFormData>({
		resolver: yupResolver(hostBusinessProfileSchema),
		defaultValues: {
			businessName: '',
			businessAddress: '',
			businessPhone: '',
			aboutService: '',
		},
	});

	useEffect(() => {
		const load = async () => {
			try {
				const data = await profileService.getHostProfile();
				setProfile(data);
				form.reset({
					businessName: data.businessName ?? '',
					businessAddress: data.businessAddress ?? '',
					businessPhone: data.businessPhone ?? '',
					aboutService: data.aboutService ?? '',
				});
			} catch (err) {
				setLoadError(err instanceof Error ? err.message : 'Failed to load business profile');
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, [form]);

	const { apiError, submitting, handleSubmit } = useApiSubmit<HostBusinessProfileFormData>(
		async (data) => {
			const updated = await profileService.updateHostProfile(data);
			setProfile(updated);
			notification.success('Business profile updated!');
		},
	);

	const onSubmit = form.handleSubmit((data) => {
		void (async () => { await handleSubmit(data); })();
	});

	if (loading) return <div className="py-12 flex justify-center"><Loader /></div>;

	if (loadError) return (
		<div className="bg-surface rounded-xl border border-line p-6">
			<FormErrorBanner>{loadError}</FormErrorBanner>
		</div>
	);

	return (
		<div className="bg-surface rounded-xl border border-line p-6">
			{/* Header */}
			<div className="flex items-start justify-between mb-6">
				<div>
					<h2 className="section-heading text-ink">Business Profile</h2>
					<p className="page-subtext mt-1">
						Update your business information visible to travellers
					</p>
				</div>
				{profile && (
					<div className="flex flex-col items-end gap-1">
						<VerificationBadge status={profile.verificationStatus} />
						{profile.verificationStatus === 'rejected' && profile.verificationRemarks && (
							<p className="text-xs text-red-600 max-w-xs text-right mt-1">
								{profile.verificationRemarks}
							</p>
						)}
					</div>
				)}
			</div>

			<form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<Controller
					name="businessName"
					control={form.control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Business Name"
							placeholder="e.g. Nepal Treks & Tours"
							icon={Building2}
							error={form.formState.errors.businessName?.message}
							required
						/>
					)}
				/>

				<Controller
					name="businessAddress"
					control={form.control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Business Address"
							placeholder="e.g. Thamel, Kathmandu"
							icon={MapPin}
							error={form.formState.errors.businessAddress?.message}
							required
						/>
					)}
				/>

				<Controller
					name="businessPhone"
					control={form.control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Business Phone"
							placeholder="e.g. 014XXXXXX"
							icon={Phone}
							error={form.formState.errors.businessPhone?.message}
						/>
					)}
				/>

				<Controller
					name="aboutService"
					control={form.control}
					render={({ field }) => (
						<TextAreaField
							{...field}
							label="About Your Service"
							placeholder="Describe what you offer to travellers..."
							rows={4}
							error={form.formState.errors.aboutService?.message}
						/>
					)}
				/>

				<div className="flex justify-end pt-2">
					<Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
						{submitting ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</form>
		</div>
	);
};

export default HostBusinessProfileSettingsForm;
