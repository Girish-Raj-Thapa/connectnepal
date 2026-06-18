import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Button from '@components/button/Button';
import InputField from '@components/form/InputField';
import slotsService from '@services/slots.service';
import useApiSubmit from '@hooks/useApiSubmit';
import { createHostSlotSchema } from '@utils/validators/slots';
import type { ActivitySlot } from '@/types/bookings';
import type { ListingDetail } from '@/types/listings';

const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

type FlyoutCreateFormData = {
	endDate?: string;
	startTime?: string;
	endTime?: string;
	capacity?: number;
};

interface HostSlotAddFormProps {
	date:      string;
	listing:   ListingDetail;
	onCreated: (slot: ActivitySlot) => void;
	onCancel:  () => void;
}

const HostSlotAddForm = ({ date, listing, onCreated, onCancel }: HostSlotAddFormProps) => {
	const durationType = listing.durationType;
	const isHourly     = durationType === 'hourly';
	const isMultiDay   = durationType === 'multi_day';

	const schema = createHostSlotSchema(durationType);
	const {
		register,
		handleSubmit,
		reset: resetForm,
		formState: { errors },
	} = useForm<FlyoutCreateFormData>({
		resolver: yupResolver(schema) as Resolver<FlyoutCreateFormData>,
	});

	const { apiError, submitting, handleSubmit: handleApiSubmit, clearError } =
		useApiSubmit<FlyoutCreateFormData>(async (data) => {
			const newSlot = await slotsService.createSlot(listing.id, {
				startDate: date,
				...(data.endDate   ? { endDate:   data.endDate } : {}),
				...(data.startTime ? { startTime: normalizeTime(data.startTime) } : {}),
				...(data.endTime   ? { endTime:   normalizeTime(data.endTime) } : {}),
				...(data.capacity  ? { capacity:  data.capacity } : {}),
			});
			onCreated(newSlot);
			resetForm();
		});

	const onSubmit = (data: FlyoutCreateFormData) => { void handleApiSubmit(data); };

	return (
		<div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-1">
			<h4 className="text-sm font-semibold text-ink mb-3">New Slot for {date}</h4>
			<form
				onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
				className="space-y-3"
				noValidate
			>
				{isMultiDay && (
					<InputField
						{...register('endDate')}
						type="date"
						label="End Date"
						min={date}
						error={errors.endDate?.message}
						required
					/>
				)}
				{isHourly && (
					<div className="grid grid-cols-2 gap-2">
						<InputField
							{...register('startTime')}
							type="time"
							label="Start"
							error={errors.startTime?.message}
							required
						/>
						<InputField
							{...register('endTime')}
							type="time"
							label="End"
							error={errors.endTime?.message}
							required
						/>
					</div>
				)}
				<div>
					<InputField
						{...register('capacity', { valueAsNumber: true })}
						type="number"
						label="Capacity"
						min={1}
						max={listing.maxGroupSize}
						placeholder={String(listing.maxGroupSize)}
						error={errors.capacity?.message}
					/>
					<p className="text-xs text-ink-muted mt-0.5">Optional · max {listing.maxGroupSize}</p>
				</div>
				{apiError && <p className="text-xs text-red-600">{apiError}</p>}
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

export default HostSlotAddForm;
