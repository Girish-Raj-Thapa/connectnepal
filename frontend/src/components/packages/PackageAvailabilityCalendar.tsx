import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, startOfDay } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { PackageAvailabilityMonth } from '@/types/packages';

interface PackageAvailabilityCalendarProps {
	year: number;
	month: number; // 1-12
	availability: PackageAvailabilityMonth | null;
	loading: boolean;
	selectedDate: string | null;
	onMonthChange: (year: number, month: number) => void;
	onDateSelect: (isoDate: string) => void;
	label?: string;
}

const PackageAvailabilityCalendar = ({
	year,
	month,
	availability,
	loading,
	selectedDate,
	onMonthChange,
	onDateSelect,
	label,
}: PackageAvailabilityCalendarProps) => {
	const monthDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);
	const today = useMemo(() => startOfDay(new Date()), []);

	const departureDates = useMemo(() => {
		if (!availability) return [];
		return Object.entries(availability.days)
			.filter(([, day]) => day.available)
			.map(([isoDate]) => parseISO(isoDate));
	}, [availability]);

	const selectedDay = selectedDate ? parseISO(selectedDate) : undefined;

	if (loading) {
		return (
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
		);
	}

	return (
		<div>
			{label && (
				<p className="text-sm font-semibold text-ink mb-4">{label}</p>
			)}
			<DayPicker
				mode="single"
				selected={selectedDay}
				onDayClick={(day) => {
					if (day >= today) onDateSelect(format(day, 'yyyy-MM-dd'));
				}}
				month={monthDate}
				onMonthChange={(date) => onMonthChange(date.getFullYear(), date.getMonth() + 1)}
				disabled={[{ before: today }]}
				modifiers={{ departure: departureDates }}
				modifiersClassNames={{ departure: 'rdp-day--pkg-departure' }}
				className="rdp-availability"
				showOutsideDays={false}
				fixedWeeks
			/>

			<div className="flex items-center gap-4 px-2 pt-1 pb-2 text-xs text-ink-muted">
				<span className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block shrink-0" />
					Departure available
				</span>
			</div>
		</div>
	);
};

export default PackageAvailabilityCalendar;
