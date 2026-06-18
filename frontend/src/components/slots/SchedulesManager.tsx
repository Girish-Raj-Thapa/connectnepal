import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, RefreshCw, X, Settings2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Button from '@components/button/Button';
import { useConfirm } from '@context/ConfirmContext';
import InputField from '@components/form/InputField';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import ScheduleCard from '@components/slots/shared/ScheduleCard';
import notification from '@utils/notifications';
import useApiSubmit from '@hooks/useApiSubmit';
import { packageScheduleSchema } from '@utils/validators/slots';
import type { ScheduleLike, ScheduleTimeSlot } from '@/types/bookings';
import type { DurationType } from '@/types/listings';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatDate = (d: string) => format(parseISO(d), 'MMM d, yyyy');

const formatTime = (t: string): string => {
	const [h, m] = t.split(':').map(Number);
	const suffix = h >= 12 ? 'PM' : 'AM';
	const displayHour = h % 12 || 12;
	return `${displayHour}:${m.toString().padStart(2, '0')} ${suffix}`;
};

const formatDaysOfWeek = (days: number[]): string => {
	const sorted = [...days].sort((a, b) => a - b);
	if (sorted.length === 7) return 'Every day';
	if (sorted.length === 0) return 'No days';
	return sorted.map((d) => DAY_LABELS[d]).join(', ');
};

const formatTimeSlot = (ts: ScheduleTimeSlot): string =>
	`${formatTime(ts.start)} – ${formatTime(ts.end)}`;

// ── Types ─────────────────────────────────────────────────────────────────────

type ScheduleFormData = {
	daysOfWeek:  number[];
	capacity:    number;
	advanceDays: number;
	validFrom:   string;
	validUntil:  string;
};

type SchedulePayload = {
	daysOfWeek:   number[];
	capacity:     number;
	advanceDays:  number;
	timeSlots?:   ScheduleTimeSlot[];
	validFrom?:   string;
	validUntil?:  string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface SchedulesManagerProps<T extends ScheduleLike> {
	resource:          { id: number; maxGroupSize: number };
	/** Pass to enable the hourly time-slots section in the form. */
	durationType?:     DurationType;
	schedules:         T[];
	loading:           boolean;
	generatingNow:     boolean;
	onSchedulesChange: (updater: (prev: T[]) => T[]) => void;
	onGenerateNow:     () => void;
	onCreate:  (resourceId: number, payload: SchedulePayload) => Promise<T>;
	onUpdate:  (resourceId: number, id: number, payload: SchedulePayload) => Promise<T>;
	onDelete:  (resourceId: number, id: number) => Promise<void>;
	/** Unit label for capacity summary. Default: 'seats' */
	unitLabel?:   string;
	/** Day-type label for the days-of-week section. Default: 'Days of Week' */
	daysLabel?:   string;
	description?: string;
}

// ── Schedule form ─────────────────────────────────────────────────────────────

interface ScheduleFormProps<T extends ScheduleLike> {
	resource:     { id: number; maxGroupSize: number };
	durationType: DurationType | undefined;
	editing:      T | null;
	daysLabel:    string;
	onCreate:     SchedulesManagerProps<T>['onCreate'];
	onUpdate:     SchedulesManagerProps<T>['onUpdate'];
	onSave:       (s: T) => void;
	onCancel:     () => void;
}

const ScheduleForm = <T extends ScheduleLike>({
	resource,
	durationType,
	editing,
	daysLabel,
	onCreate,
	onUpdate,
	onSave,
	onCancel,
}: ScheduleFormProps<T>) => {
	const isHourly = durationType === 'hourly';

	// Time slots are managed separately (dynamic array, not covered by the yup schema)
	const [timeSlots, setTimeSlots] = useState<ScheduleTimeSlot[]>(
		editing?.timeSlots && editing.timeSlots.length > 0
			? editing.timeSlots
			: [{ start: '', end: '' }],
	);
	const [timeSlotError, setTimeSlotError] = useState('');

	const { control, register, handleSubmit, setValue, formState: { errors } } =
		useForm<ScheduleFormData>({
			resolver: yupResolver(packageScheduleSchema) as never,
			defaultValues: {
				daysOfWeek:  editing?.daysOfWeek ?? [],
				capacity:    editing?.capacity ?? resource.maxGroupSize,
				advanceDays: editing?.advanceDays ?? 90,
				validFrom:   editing?.validFrom ?? '',
				validUntil:  editing?.validUntil ?? '',
			},
		});

	const selectedDays: number[] = useWatch({ control, name: 'daysOfWeek' }) ?? [];

	const toggleDay = (d: number) => {
		const next = selectedDays.includes(d)
			? selectedDays.filter((x) => x !== d)
			: [...selectedDays, d];
		setValue('daysOfWeek', next, { shouldValidate: true });
	};

	const addTimeSlot    = () => setTimeSlots((prev) => [...prev, { start: '', end: '' }]);
	const removeTimeSlot = (i: number) => setTimeSlots((prev) => prev.filter((_, idx) => idx !== i));
	const updateTimeSlot = (i: number, field: 'start' | 'end', value: string) =>
		setTimeSlots((prev) => prev.map((ts, idx) => (idx === i ? { ...ts, [field]: value } : ts)));

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<ScheduleFormData>(async (data) => {
			if (data.validFrom && data.validUntil && data.validFrom >= data.validUntil) {
				throw new Error('Valid From must be before Valid Until');
			}
			if (isHourly) {
				const allValid = timeSlots.every((ts) => ts.start && ts.end && ts.start < ts.end);
				if (!allValid) {
					setTimeSlotError('Each window needs start time earlier than end time');
					return;
				}
				setTimeSlotError('');
			}
			const payload: SchedulePayload = {
				daysOfWeek:  data.daysOfWeek,
				capacity:    data.capacity,
				advanceDays: data.advanceDays,
				...(isHourly && { timeSlots: timeSlots.filter((ts) => ts.start && ts.end) }),
				...(data.validFrom  && { validFrom:  data.validFrom }),
				...(data.validUntil && { validUntil: data.validUntil }),
			};
			let result: T;
			if (editing) {
				result = await onUpdate(resource.id, editing.id, payload);
				notification.success('Schedule updated.');
			} else {
				result = await onCreate(resource.id, payload);
				notification.success('Schedule created.');
			}
			onSave(result);
		});

	const onSubmit = (data: ScheduleFormData) => { void handleApiSubmit(data); };

	return (
		<div className="bg-teal-50/40 border border-teal-100 rounded-xl p-5">
			<h3 className="text-sm font-bold text-ink mb-4">
				{editing ? 'Edit Schedule' : 'New Schedule'}
			</h3>
			<form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>
				{/* Days of week */}
				<div className="mb-4">
					<label className="block text-sm font-medium text-ink-secondary mb-2">
						{daysLabel} <span className="text-red-500">*</span>
					</label>
					<div className="flex flex-wrap gap-2">
						{DAY_LABELS.map((label, i) => (
							<button
								key={i}
								type="button"
								onClick={() => toggleDay(i)}
								className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
									selectedDays.includes(i)
										? 'bg-teal-600 text-white border-teal-600'
										: 'bg-surface text-ink-muted border-line hover:border-teal-400'
								}`}
							>
								{label}
							</button>
						))}
					</div>
					{errors.daysOfWeek && (
						<p className="text-xs text-red-600 mt-1">{errors.daysOfWeek.message as string}</p>
					)}
				</div>

				{/* Time windows — hourly only */}
				{isHourly && (
					<div className="mb-4">
						<label className="block text-sm font-medium text-ink-secondary mb-2">
							Time Windows <span className="text-red-500">*</span>
						</label>
						<div className="space-y-2">
							{timeSlots.map((ts, i) => (
								<div key={i} className="flex items-center gap-2">
									<input
										type="time"
										value={ts.start}
										onChange={(e) => updateTimeSlot(i, 'start', e.target.value)}
										className="px-3 py-2 border border-line rounded-lg text-sm
											focus:outline-none focus:ring-2 focus:ring-teal-500"
									/>
									<span className="text-ink-muted text-sm">–</span>
									<input
										type="time"
										value={ts.end}
										onChange={(e) => updateTimeSlot(i, 'end', e.target.value)}
										className="px-3 py-2 border border-line rounded-lg text-sm
											focus:outline-none focus:ring-2 focus:ring-teal-500"
									/>
									{timeSlots.length > 1 && (
										<button
											type="button"
											onClick={() => removeTimeSlot(i)}
											className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
										>
											<X className="w-4 h-4" />
										</button>
									)}
								</div>
							))}
						</div>
						<button
							type="button"
							onClick={addTimeSlot}
							className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
						>
							<Plus className="w-3.5 h-3.5" />
							Add time window
						</button>
						{timeSlotError && <p className="text-xs text-red-600 mt-1">{timeSlotError}</p>}
					</div>
				)}

				{/* Capacity + Advance days */}
				<div className="grid grid-cols-2 gap-4 mb-4">
					<div>
						<InputField
							{...register('capacity', { valueAsNumber: true })}
							type="number"
							label="Capacity"
							min={1}
							max={resource.maxGroupSize}
							error={errors.capacity?.message}
						/>
						{!errors.capacity && (
							<p className="text-xs text-ink-muted mt-1">Max: {resource.maxGroupSize}</p>
						)}
					</div>
					<div>
						<InputField
							{...register('advanceDays', { valueAsNumber: true })}
							type="number"
							label="Advance Days"
							min={1}
							error={errors.advanceDays?.message}
						/>
						{!errors.advanceDays && (
							<p className="text-xs text-ink-muted mt-1">How far ahead to pre-fill</p>
						)}
					</div>
				</div>

				{/* Valid from / until */}
				<div className="grid grid-cols-2 gap-4 mb-4">
					<InputField
						{...register('validFrom')}
						type="date"
						label="Valid From (optional)"
						error={errors.validFrom?.message}
					/>
					<InputField
						{...register('validUntil')}
						type="date"
						label="Valid Until (optional)"
						error={errors.validUntil?.message}
					/>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<div className="flex gap-3 mt-4">
					<Button type="submit" variant="primary" loading={submitting}>
						{editing ? 'Save Changes' : 'Create Schedule'}
					</Button>
					<Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
};

// ── Main manager ──────────────────────────────────────────────────────────────

const SchedulesManager = <T extends ScheduleLike>({
	resource,
	durationType,
	schedules,
	loading,
	generatingNow,
	onSchedulesChange,
	onGenerateNow,
	onCreate,
	onUpdate,
	onDelete,
	unitLabel = 'seats',
	daysLabel = 'Days of Week',
	description,
}: SchedulesManagerProps<T>) => {
	const confirm = useConfirm();
	const [showForm, setShowForm]               = useState(false);
	const [editingSchedule, setEditingSchedule] = useState<T | null>(null);
	const [deletingId, setDeletingId]           = useState<number | null>(null);

	const openCreate = () => { setEditingSchedule(null); setShowForm(true); };
	const openEdit   = (s: T) => { setEditingSchedule(s); setShowForm(true); };

	const handleSave = (saved: T) => {
		if (editingSchedule) {
			onSchedulesChange((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
		} else {
			onSchedulesChange((prev) => [saved, ...prev]);
		}
		setShowForm(false);
		setEditingSchedule(null);
	};

	const handleCancel = () => { setShowForm(false); setEditingSchedule(null); };

	const handleDelete = async (scheduleId: number) => {
		const confirmed = await confirm({
			title: 'Delete Schedule',
			message: 'Are you sure you want to delete this schedule? Future slots will no longer be auto-generated from it.',
			confirmLabel: 'Delete',
		});
		if (!confirmed) return;
		try {
			setDeletingId(scheduleId);
			await onDelete(resource.id, scheduleId);
			onSchedulesChange((prev) => prev.filter((s) => s.id !== scheduleId));
			notification.success('Schedule deleted.');
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to delete schedule');
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3 items-center justify-between">
				<p className="text-sm text-ink-muted">
					{description ?? 'Recurring patterns that auto-fill slots nightly.'}
				</p>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="secondary"
						onClick={onGenerateNow}
						loading={generatingNow}
						disabled={schedules.length === 0}
						title={schedules.length === 0 ? 'Add a schedule first' : 'Generate slots now'}
					>
						<span className="flex items-center gap-1.5">
							<RefreshCw className="w-3.5 h-3.5" />
							Generate Now
						</span>
					</Button>
					{!showForm && (
						<Button type="button" variant="primary" onClick={openCreate}>
							<span className="flex items-center gap-1.5">
								<Plus className="w-4 h-4" />
								Add Schedule
							</span>
						</Button>
					)}
				</div>
			</div>

			{showForm && (
				<ScheduleForm
					resource={resource}
					durationType={durationType}
					editing={editingSchedule}
					daysLabel={daysLabel}
					onCreate={onCreate}
					onUpdate={onUpdate}
					onSave={handleSave}
					onCancel={handleCancel}
				/>
			)}

			{loading ? (
				<div className="flex justify-center py-10">
					<Loader text="Loading schedules..." />
				</div>
			) : schedules.length === 0 && !showForm ? (
				<div className="py-12 text-center border border-dashed border-line rounded-xl">
					<Settings2 className="w-8 h-8 text-line mx-auto mb-2" />
					<p className="text-ink-muted text-sm font-medium">No schedules yet</p>
					<p className="text-ink-muted text-xs mt-1">
						Add a schedule to auto-generate slots on a recurring basis.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{schedules.map((schedule) => (
						<ScheduleCard
							key={schedule.id}
							isActive={schedule.isActive}
							title={formatDaysOfWeek(schedule.daysOfWeek)}
							summary={`· ${schedule.advanceDays}d ahead · ${schedule.capacity} ${unitLabel}`}
							secondaryLine={
								durationType === 'hourly' && schedule.timeSlots && schedule.timeSlots.length > 0 ? (
									<p className="text-xs text-ink-muted ml-4">
										{schedule.timeSlots.map(formatTimeSlot).join('  ·  ')}
									</p>
								) : undefined
							}
							tertiaryLine={
								schedule.validFrom || schedule.validUntil ? (
									<p className="text-xs text-ink-muted ml-4">
										{schedule.validFrom ? formatDate(schedule.validFrom) : '…'}
										{' – '}
										{schedule.validUntil ? formatDate(schedule.validUntil) : 'ongoing'}
									</p>
								) : undefined
							}
							onEdit={() => openEdit(schedule)}
							onDelete={() => { void handleDelete(schedule.id); }}
							deleting={deletingId === schedule.id}
						/>
					))}
				</div>
			)}

		</div>
	);
};

export default SchedulesManager;
