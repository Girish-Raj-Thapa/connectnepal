import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Phone } from 'lucide-react';
import {
	travellerPreferencesSchema,
	type TravellerPreferencesFormData,
} from '@utils/validators/onboarding';
import profileService from '@services/profile.service';
import ToggleButtonGroup from '@components/form/ToggleButtonGroup';
import SelectableButtonGrid from '@components/form/SelectableButtonGrid';
import InputField from '@components/form/InputField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ACTIVITY_OPTIONS } from '@constants/activityOptions';
import { TRAVEL_STYLE_OPTIONS } from '@/constants/travelStyleOptions';
import type { TravellerPreferencesRequest } from '@/types/onboarding';
import {
	formatBudgetForApi,
	formatBudgetForInput,
} from '@utils/travellerBudget';

const TravellerPreferencesSettingsForm = () => {
	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<TravellerPreferencesRequest>(async (data) => {
		await profileService.updatePreferences(data);
		notification.success('Preferences updated successfully!');
	});

	const {
		control,
		handleSubmit,
		reset,
		formState: { isSubmitting, errors },
	} = useForm<TravellerPreferencesFormData>({
		resolver: yupResolver(travellerPreferencesSchema),
		defaultValues: {
			preferredActivities: [],
			preferredMinBudget: '',
			preferredMaxBudget: '',
			preferredTripStyle: '',
			emergencyContact: '',
		},
	});

	// Pre-populate with existing preferences
	useEffect(() => {
		void (async () => {
			const data = await profileService.getPreferences();
			reset({
				preferredActivities: data.preferredActivities ?? [],
				preferredMinBudget: formatBudgetForInput(data.preferredMinBudget),
				preferredMaxBudget: formatBudgetForInput(data.preferredMaxBudget),
				preferredTripStyle: data.preferredTripStyle ?? '',
				emergencyContact: data.emergencyContact ?? '',
			});
		})();
	}, [reset]);

	const onSubmit = handleSubmit((data) => {
		void (async () => {
			await handleApiSubmit({
				...data,
				preferredMinBudget: formatBudgetForApi(data.preferredMinBudget),
				preferredMaxBudget: formatBudgetForApi(data.preferredMaxBudget),
			});
		})();
	});

	const loading = isSubmitting || submitting;

	return (
		<div className="bg-surface rounded-xl border border-line p-6">
			<div className="mb-6">
				<h2 className="text-xl font-bold text-ink">Travel Preferences</h2>
				<p className="text-ink-muted text-sm mt-1">
					These preferences personalise your activity recommendations
				</p>
			</div>

			{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

			<form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
				{/* Emergency Contact */}
				<Controller
					name="emergencyContact"
					control={control}
					render={({ field }) => (
						<InputField
							{...field}
							label="Emergency Contact"
							placeholder="Name, relationship, phone"
							icon={Phone}
						/>
					)}
				/>

				{/* Preferred Activities */}
				<Controller
					name="preferredActivities"
					control={control}
					render={({ field }) => (
						<ToggleButtonGroup
							label="Preferred Activities"
							options={[...ACTIVITY_OPTIONS]}
							value={field.value ?? []}
							onChange={field.onChange}
						/>
					)}
				/>

				{/* Budget Range */}
				<Controller
					name="preferredMinBudget"
					control={control}
					render={({ field: minField }) => (
						<Controller
							name="preferredMaxBudget"
							control={control}
							render={({ field: maxField }) => (
								<div className="space-y-3">
									<div>
										<h3 className="text-xs font-semibold text-ink-secondary">
											Preferred Budget Range
										</h3>
										<p className="mt-1 text-xs text-ink-muted">
											Enter your travel budget in NPR. Leave either
											field blank if you do not want to set that
											preference. Example: 5000
										</p>
									</div>
									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<InputField
											{...minField}
											label="Minimum Budget (NPR)"
											type="number"
											inputMode="decimal"
											min="0"
											step="0.01"
											placeholder="Example: 5000"
											value={minField.value ?? ''}
											error={errors.preferredMinBudget?.message}
										/>
										<InputField
											{...maxField}
											label="Maximum Budget (NPR)"
											type="number"
											inputMode="decimal"
											min="0"
											step="0.01"
											placeholder="Example: 25000"
											value={maxField.value ?? ''}
											error={errors.preferredMaxBudget?.message}
										/>
									</div>
								</div>
							)}
						/>
					)}
				/>

				{/* Travel Style */}
				<Controller
					name="preferredTripStyle"
					control={control}
					render={({ field }) => (
						<SelectableButtonGrid
							label="Travel Style"
							options={[...TRAVEL_STYLE_OPTIONS]}
							value={field.value ?? ''}
							onChange={field.onChange}
							columns={3}
						/>
					)}
				/>

				<div className="flex justify-end pt-2">
					<Button
						type="submit"
						variant="primary"
						loading={loading}
						disabled={loading}
					>
						{loading ? 'Saving...' : 'Save Preferences'}
					</Button>
				</div>
			</form>
		</div>
	);
};

export default TravellerPreferencesSettingsForm;
