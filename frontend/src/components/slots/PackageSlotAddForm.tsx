import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Button from '@components/button/Button';
import InputField from '@components/form/InputField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import packagesService from '@services/packages.service';
import useApiSubmit from '@hooks/useApiSubmit';
import { packageSlotSchema } from '@utils/validators/slots';
import type { PackageSlot, PackageDetail } from '@/types/packages';

type CreateFormData = {
	endDate: string;
	capacity?: number;
};

type CreateFormInput = {
	endDate: string;
	capacity: number | undefined;
};

interface PackageSlotAddFormProps {
	date:      string;
	pkg:       PackageDetail;
	onCreated: (slot: PackageSlot) => void;
	onCancel:  () => void;
}

const PackageSlotAddForm = ({ date, pkg, onCreated, onCancel }: PackageSlotAddFormProps) => {
	const {
		register,
		handleSubmit,
		reset: resetForm,
		formState: { errors },
	} = useForm<CreateFormInput, unknown, CreateFormData>({
		resolver: yupResolver(packageSlotSchema),
	});

	const { apiError, submitting, handleSubmit: handleApiSubmit, clearError } =
		useApiSubmit<CreateFormData>(async (data) => {
			const capacity = data.capacity ?? pkg.maxGroupSize;
			const newSlot = await packagesService.createPackageSlot(pkg.id, {
				startDate: date,
				endDate:   data.endDate,
				capacity,
			});
			onCreated(newSlot);
			resetForm();
		});

	const onSubmit = (data: CreateFormData) => { void handleApiSubmit(data); };

	return (
		<div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-1">
			<h4 className="text-sm font-semibold text-ink mb-1">New Departure from {date}</h4>
			<p className="text-xs text-ink-muted mb-3">Start date is fixed to the selected calendar date.</p>
			<form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-3" noValidate>
				<InputField
					{...register('endDate')}
					type="date"
					label="Return Date"
					min={date}
					error={errors.endDate?.message}
					required
				/>
				<div>
					<InputField
						{...register('capacity', {
							setValueAs: (value: string) => value === '' ? undefined : Number(value),
						})}
						type="number"
						label="Capacity"
						min={1}
						max={pkg.maxGroupSize}
						placeholder={String(pkg.maxGroupSize)}
						error={errors.capacity?.message}
					/>
					<p className="text-xs text-ink-muted mt-0.5">Optional · max {pkg.maxGroupSize}</p>
				</div>
				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}
				<div className="flex gap-2 pt-1">
					<Button type="submit" variant="primary" loading={submitting}>Create</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => { resetForm(); clearError(); onCancel(); }}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
};

export default PackageSlotAddForm;
