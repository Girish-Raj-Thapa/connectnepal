import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import {
	travellerPreferencesSchema,
	type TravellerPreferencesFormData,
} from '@utils/validators';
import type { TravellerPreferencesRequest } from '@/types/onboarding';
import onboardingService from '@services/onboarding.service';
import OnboardingLayout from '@layouts/OnboardingLayout';
import ToggleButtonGroup from '@components/form/ToggleButtonGroup';
import SelectableButtonGrid from '@components/form/SelectableButtonGrid';
import InputField from '@components/form/InputField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import {ACTIVITY_OPTIONS} from '@constants/activityOptions';
import { TRAVEL_STYLE_OPTIONS } from '@/constants/travelStyleOptions';
import { TRAVELLER_SIDEBAR } from '@/constants/travellerOnboarding';
import { ROUTES } from '@/constants/routes';
import { formatBudgetForApi } from '@utils/travellerBudget';


const TravellerPreferences = () => {
	const navigate = useNavigate();

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<TravellerPreferencesRequest>(async (data) => {
		await onboardingService.submitTravellerPreferences({
			preferredActivities: data.preferredActivities,
			preferredMinBudget: data.preferredMinBudget,
			preferredMaxBudget: data.preferredMaxBudget,
			preferredTripStyle: data.preferredTripStyle || undefined,
			emergencyContact: data.emergencyContact || undefined,
		});

		// Don't refresh user here — the routing guard would see onboarding as
		// complete and redirect away before navigation happens. User state is
		// refreshed in OnboardingComplete instead.
		notification.success('Preferences saved!');
		void navigate(ROUTES.TRAVELLER_ONBOARDING_COMPLETE);
	});

	const {
		control,
		handleSubmit,
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

	const onSubmit = (data: TravellerPreferencesFormData) => {
		void (async () => {
			const ok = await handleApiSubmit({
				preferredActivities: data.preferredActivities,
				preferredMinBudget: formatBudgetForApi(data.preferredMinBudget),
				preferredMaxBudget: formatBudgetForApi(data.preferredMaxBudget),
				preferredTripStyle: data.preferredTripStyle || undefined,
				emergencyContact: data.emergencyContact || undefined,
			});
			if (!ok) {
				notification.error('Failed to save preferences');
			}
		})();
	};
	const submitHandler = handleSubmit(onSubmit);

	/** Skip submits an empty payload so defaults are not saved */
	const handleSkip = () => {
		void (async () => {
			const ok = await handleApiSubmit({});
			if (!ok) {
				notification.error('Failed to skip preferences');
				return;
			}
			notification.info('Preferences skipped. You can update them later.');
		})();
	};

	const loading = isSubmitting || submitting;

	return (
		<OnboardingLayout
			sidebar={TRAVELLER_SIDEBAR[2]}
			currentStep={2}
			totalSteps={3}
		>
			<form onSubmit={(e) => void submitHandler(e)} className="space-y-8">
				<div>
					<h2 className="section-heading text-ink">
						Travel Preferences
					</h2>
					<p className="page-subtext mt-1">
						Help us personalize your experience
					</p>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

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

				{/* Buttons */}
				<div className="flex items-center justify-between pt-4">
					<Button variant="ghost" type="button" onClick={handleSkip}>
						Skip for now
					</Button>
					<Button
						type="submit"
						variant="primary"
						loading={loading}
						disabled={loading}
					>
						{loading ? 'Saving...' : 'Finish'}
					</Button>
				</div>
				<p className="text-xs text-ink-muted">
					You can update your preferences later from your profile.
				</p>
			</form>
		</OnboardingLayout>
	);
};

export default TravellerPreferences;
