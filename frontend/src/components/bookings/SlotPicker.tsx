import { parseISO, format } from 'date-fns';
import type { ActivitySlot } from '@/types/bookings';
import type { DurationType } from '@/types/listings';

interface SlotPickerProps {
	slots:        ActivitySlot[];
	loading:      boolean;
	value:        number | null;   // selected slot ID
	onChange:     (slotId: number) => void;
	error?:       string;
	durationType: DurationType;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) =>
	d
		? format(parseISO(d), 'd MMM yyyy')
		: '';

const fmtTime = (t: string | null | undefined): string => {
	if (!t) return '';
	// Backend returns HH:MM:SS — parse as today's date + time for formatting
	const [h, m] = t.split(':').map(Number);
	const date = new Date();
	date.setHours(h, m, 0, 0);
	return format(date, 'h:mm a');
};

const getSlotLabel = (slot: ActivitySlot, type: DurationType): string => {
	if (type === 'hourly') {
		return `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}`;
	}
	if (type === 'multi_day') {
		return `${fmtDate(slot.startDate)} – ${fmtDate(slot.endDate)}`;
	}
	// full_day
	return fmtDate(slot.startDate);
};

// ── Component ─────────────────────────────────────────────────────────────────

const SlotPicker = ({
	slots,
	loading,
	value,
	onChange,
	error,
	durationType,
}: SlotPickerProps) => {
	if (loading) {
		return (
			<div className="space-y-2">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-12 rounded-xl bg-surface-raised animate-pulse" />
				))}
			</div>
		);
	}

	return (
		<div>
			<p className="text-sm font-semibold text-ink-secondary mb-2">
				{durationType === 'hourly' ? 'Select a Time Slot' : 'Select a Slot'}
			</p>

			{slots.length === 0 ? (
				<p className="text-sm text-ink-muted py-3 text-center border border-dashed border-line rounded-xl">
					No available slots for this date.
				</p>
			) : (
				<div className="space-y-2">
					{slots.map((slot) => (
						<button
							key={slot.id}
							type="button"
							onClick={() => onChange(slot.id)}
							className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm
								transition-colors
								${
									value === slot.id
										? 'border-teal-500 bg-teal-50 text-teal-800'
										: 'border-line hover:border-teal-300 hover:bg-surface-muted text-ink-secondary'
								}`}
						>
							<span className="font-semibold">{getSlotLabel(slot, durationType)}</span>
							<span className="text-xs font-medium flex items-center gap-1">
								{slot.capacity - slot.availableCapacity > 0 ? (
									<>
										<span className="text-amber-600">{slot.capacity - slot.availableCapacity} booked</span>
										<span className="text-line">·</span>
										<span className={slot.availableCapacity <= 3 ? 'text-red-600' : 'text-emerald-700'}>
											{slot.availableCapacity} remaining
										</span>
									</>
								) : (
									<span className="text-emerald-700">{slot.availableCapacity} available</span>
								)}
							</span>
						</button>
					))}
				</div>
			)}

			{error && (
				<p className="text-red-500 text-xs mt-1.5">{error}</p>
			)}
		</div>
	);
};

export default SlotPicker;
