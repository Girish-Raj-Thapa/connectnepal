import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X } from 'lucide-react';
import InputField from '@components/form/InputField';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import { createTripPlanSchema } from '@utils/validators/tripPlanner';
import type { CreateTripPlanFormData } from '@utils/validators/tripPlanner';
import type { TripPlanDetail, TripPlanListItem } from '@/types/tripPlanner';
import tripPlannerService from '@services/tripPlanner.service';

interface TripPlanModalProps {
	open: boolean;
	mode?: 'create' | 'edit';
	plan?: TripPlanListItem | TripPlanDetail | null;
	onClose: () => void;
	onCreated?: (planId: number) => void;
	onUpdated?: (plan: TripPlanDetail) => void;
}

const TripPlanModal = ({
	open,
	mode = 'create',
	plan = null,
	onClose,
	onCreated,
	onUpdated,
}: TripPlanModalProps) => {
	const isEdit = mode === 'edit';

	const initialValues = useMemo<CreateTripPlanFormData>(
		() => ({
			title: plan?.title ?? '',
			totalDays: plan?.totalDays ?? 3,
			travellersCount: plan?.travellersCount ?? 1,
			startDate: plan?.startDate ?? null,
			endDate: plan?.endDate ?? null,
		}),
		[plan],
	);

	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<CreateTripPlanFormData>({
		resolver: yupResolver(createTripPlanSchema),
		defaultValues: initialValues,
	});

	useEffect(() => {
		if (open) {
			reset(initialValues);
		}
	}, [open, initialValues, reset]);

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
		clearError,
	} = useApiSubmit<CreateTripPlanFormData>(async (data) => {
		if (isEdit) {
			if (!plan) {
				throw new Error('Trip plan not found');
			}
			const updated = await tripPlannerService.updateTripPlan(plan.id, {
				title: data.title,
				totalDays: data.totalDays,
				travellersCount: data.travellersCount,
				startDate: data.startDate || null,
				endDate: data.endDate || null,
			});
			onUpdated?.(updated);
			return;
		}

		const created = await tripPlannerService.createTripPlan({
			title: data.title,
			totalDays: data.totalDays,
			travellersCount: data.travellersCount,
			startDate: data.startDate || null,
			endDate: data.endDate || null,
		});
		reset();
		onCreated?.(created.id);
	});

	const onSubmit = (data: CreateTripPlanFormData) => {
		void handleApiSubmit(data);
	};

	const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		void handleSubmit(onSubmit)(event);
	};

	const handleClose = () => {
		if (!submitting) {
			reset(initialValues);
			clearError();
			onClose();
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={handleClose}
			/>

			{/* Modal */}
			<div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="section-heading text-ink">
						{isEdit ? 'Edit Trip' : 'Create New Trip'}
					</h2>
					<button
						onClick={handleClose}
						className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
					>
						<X className="w-5 h-5 text-ink-muted" />
					</button>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<form onSubmit={handleFormSubmit} className="space-y-4">
					<InputField
						label="Trip Name"
						placeholder="e.g. Annapurna Discovery"
						error={errors.title?.message}
						{...register('title')}
					/>

					<div className="grid grid-cols-2 gap-4">
						<InputField
							label="Total Days"
							type="number"
							placeholder="1-30"
							error={errors.totalDays?.message}
							{...register('totalDays', { valueAsNumber: true })}
						/>
						<InputField
							label="Travellers"
							type="number"
							placeholder="1-50"
							error={errors.travellersCount?.message}
							{...register('travellersCount', { valueAsNumber: true })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<InputField
							label="Start Date"
							type="date"
							error={errors.startDate?.message}
							{...register('startDate')}
						/>
						<InputField
							label="End Date"
							type="date"
							error={errors.endDate?.message}
							{...register('endDate')}
						/>
					</div>

					<div className="flex gap-3 pt-2">
						<Button
							type="button"
							variant="secondary"
							onClick={handleClose}
							disabled={submitting}
							fullWidth
						>
							Cancel
						</Button>
						<Button type="submit" loading={submitting} fullWidth>
							{isEdit ? 'Save Changes' : 'Create Trip'}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default TripPlanModal;
