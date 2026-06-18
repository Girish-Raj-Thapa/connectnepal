/**
 * SlotsCalendarView
 * -----------------
 * Generic calendar dot-map for slot availability. Works with both ActivitySlot
 * (host listings) and PackageSlot (host packages) via the SlotLike constraint.
 *
 * Replaces host-slots/SlotsCalendarView and package-slots/PackageSlotsCalendarView.
 */

import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO, startOfMonth } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { SlotLike } from '@/types/bookings';

interface SlotsCalendarViewProps {
	slots: SlotLike[];
	selectedDate: string;        // "YYYY-MM-DD"
	onSelectDate: (date: string) => void;
	/** Dates with a "closed" exception — shown as inactive regardless of slot state */
	closedDates?: Set<string>;
}

type DayStatus = 'available' | 'few' | 'full' | 'inactive';

const getDayStatus = (daySlots: SlotLike[]): DayStatus => {
	if (daySlots.length === 0) return 'inactive';

	const activeSlots = daySlots.filter((s) => s.isActive);
	if (activeSlots.length === 0) return 'inactive';

	const totalAvailable = activeSlots.reduce((sum, s) => sum + s.availableCapacity, 0);
	const totalCapacity  = activeSlots.reduce((sum, s) => sum + s.capacity, 0);

	if (totalAvailable === 0) return 'full';
	if (totalAvailable <= 3)  return 'few';
	if (totalCapacity > 0 && totalAvailable / totalCapacity <= 0.2) return 'few';
	return 'available';
};

const SlotsCalendarView = ({
	slots,
	selectedDate,
	onSelectDate,
	closedDates,
}: SlotsCalendarViewProps) => {
	const [viewMonth, setViewMonth] = useState<Date>(() =>
		selectedDate ? startOfMonth(parseISO(selectedDate)) : startOfMonth(new Date()),
	);

	// Build a map of date string → DayStatus
	const statusMap = useMemo(() => {
		const map = new Map<string, DayStatus>();
		const grouped = new Map<string, SlotLike[]>();

		for (const slot of slots) {
			const key = slot.startDate;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(slot);
		}

		for (const [date, daySlots] of grouped) {
			// A closed exception overrides slot state — show as inactive
			if (closedDates?.has(date)) {
				map.set(date, 'inactive');
			} else {
				map.set(date, getDayStatus(daySlots));
			}
		}
		return map;
	}, [slots, closedDates]);

	// Split into modifier arrays for DayPicker
	const { availableDays, fewDays, fullDays, inactiveDays } = useMemo(() => {
		const available: Date[] = [];
		const few: Date[] = [];
		const full: Date[] = [];
		const inactive: Date[] = [];

		for (const [dateStr, status] of statusMap) {
			const d = parseISO(dateStr);
			if (status === 'available') available.push(d);
			else if (status === 'few') few.push(d);
			else if (status === 'full') full.push(d);
			else if (status === 'inactive') inactive.push(d);
		}
		return { availableDays: available, fewDays: few, fullDays: full, inactiveDays: inactive };
	}, [statusMap]);

	const selectedDay = selectedDate ? parseISO(selectedDate) : undefined;

	return (
		<div>
			<DayPicker
				mode="single"
				selected={selectedDay}
				onSelect={(day) => {
					if (day) {
						// Format to YYYY-MM-DD manually to avoid timezone shift
						const y = day.getFullYear();
						const m = String(day.getMonth() + 1).padStart(2, '0');
						const d = String(day.getDate()).padStart(2, '0');
						onSelectDate(`${y}-${m}-${d}`);
					}
				}}
				month={viewMonth}
				onMonthChange={setViewMonth}
				modifiers={{
					'slot-available': availableDays,
					'slot-few': fewDays,
					'slot-full': fullDays,
					'slot-inactive': inactiveDays,
				}}
				modifiersClassNames={{
					'slot-available': 'rdp-day--slot-available',
					'slot-few': 'rdp-day--slot-few',
					'slot-full': 'rdp-day--slot-full',
					'slot-inactive': 'rdp-day--slot-inactive',
				}}
				className="rdp-host-slots"
				showOutsideDays={false}
				fixedWeeks
			/>

			{/* Legend */}
			<div className="flex flex-wrap items-center gap-4 px-3 pt-1 pb-3 text-xs text-ink-muted">
				<span className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
					Available
				</span>
				<span className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
					Few spots
				</span>
				<span className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
					Fully booked
				</span>
				<span className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-ink-muted shrink-0" />
					Inactive
				</span>
			</div>
		</div>
	);
};

export default SlotsCalendarView;
