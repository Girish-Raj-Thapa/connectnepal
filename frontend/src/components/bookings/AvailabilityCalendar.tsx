import { useState, useEffect, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO, format, startOfDay, startOfMonth } from 'date-fns';
import 'react-day-picker/dist/style.css';
import publicListingsService from '@services/publicListings.service';
import type { AvailabilityStatus } from '@/types/bookings';

interface AvailabilityCalendarProps {
	listingId:      number;
	travellerCount: number;   // re-fetches availability when changed
	value:          string;   // selected ISO date ("YYYY-MM-DD") or ""
	onChange:       (date: string) => void;
	label?:         string;
}

const AvailabilityCalendar = ({
	listingId,
	travellerCount,
	value,
	onChange,
	label,
}: AvailabilityCalendarProps) => {
	const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityStatus>>({});
	const [viewMonth, setViewMonth] = useState<Date>(() =>
		value ? startOfMonth(parseISO(value)) : startOfMonth(new Date()),
	);
	const [loading, setLoading]       = useState(false);
	const [fetchError, setFetchError] = useState('');

	// Fetch per-day availability whenever month or traveller count changes.
	// Debounced so rapid typing doesn't fire an API call on every keystroke.
	useEffect(() => {
		// Don't call API with an invalid traveller count
		if (!travellerCount || travellerCount < 1) {
			setAvailabilityMap({});
			setFetchError('');
			return;
		}
		let cancelled = false;
		const timer = setTimeout(async () => {
			if (cancelled) return;
			setLoading(true);
			setFetchError('');
			try {
				const map = await publicListingsService.getAvailability(
					listingId,
					viewMonth.getFullYear(),
					viewMonth.getMonth() + 1,  // JS months are 0-indexed; API expects 1–12
					travellerCount,
				);
				if (!cancelled) setAvailabilityMap(map);
			} catch (err) {
				if (!cancelled)
					setFetchError(
						err instanceof Error ? err.message : 'Could not load availability',
					);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, 500);
		return () => { cancelled = true; clearTimeout(timer); };
	}, [listingId, viewMonth, travellerCount]);

	// Split the map into three Date arrays for DayPicker modifiers
	const { availableDays, conflictDays, unavailableDays } = useMemo(() => {
		const available: Date[]   = [];
		const conflict: Date[]    = [];
		const unavailable: Date[] = [];
		for (const [dateStr, status] of Object.entries(availabilityMap)) {
			const date = parseISO(dateStr);
			if (status === 'available')        available.push(date);
			else if (status === 'conflict')    conflict.push(date);
			else if (status === 'unavailable') unavailable.push(date);
		}
		return { availableDays: available, conflictDays: conflict, unavailableDays: unavailable };
	}, [availabilityMap]);

	const disabledDays = useMemo(
		() => [{ before: startOfDay(new Date()) }, ...unavailableDays],
		[unavailableDays],
	);

	const selectedDay = value ? parseISO(value) : undefined;

	return (
		<div>
			{label && (
				<p className="text-sm font-semibold text-ink-secondary mb-2">{label}</p>
			)}

			{/* Loading skeleton */}
				{loading && (
					<div className="space-y-2 p-2">
						{Array.from({ length: 5 }, (_, i) => (
							<div key={i} className="flex gap-2 justify-center">
								{Array.from({ length: 7 }, (_, j) => (
									<div
										key={j}
										className="w-10 h-10 rounded-full bg-surface-raised animate-pulse"
									/>
								))}
						</div>
					))}
				</div>
			)}

			{/* Calendar */}
			{!loading && (
				<DayPicker
					mode="single"
					selected={selectedDay}
					onSelect={(day) => {
						if (day) onChange(format(day, 'yyyy-MM-dd'));
					}}
					month={viewMonth}
					onMonthChange={setViewMonth}
					disabled={disabledDays}
					modifiers={{
						available:   availableDays,
						conflict:    conflictDays,
						unavailable: unavailableDays,
					}}
					modifiersClassNames={{
						available:   'rdp-day--available',
						conflict:    'rdp-day--conflict',
						unavailable: 'rdp-day--unavailable',
					}}
					className="rdp-availability"
					showOutsideDays={false}
					fixedWeeks
				/>
			)}

			{/* Legend */}
			{!loading && (
				<div className="flex items-center gap-4 px-2 pt-1 pb-2 text-xs text-ink-muted">
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
						Available
					</span>
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0" />
						May have holds
					</span>
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-line inline-block shrink-0" />
						Unavailable
					</span>
				</div>
			)}

			{/* API fetch error */}
			{fetchError && (
				<p className="text-xs text-amber-600 px-2 pb-1">{fetchError}</p>
			)}
		</div>
	);
};

export default AvailabilityCalendar;
