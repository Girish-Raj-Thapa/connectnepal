import { Users } from 'lucide-react';

interface BookingTravellerStepperProps {
	value: number;
	onChange: (next: number) => void;
	min?: number;
	max: number;
	capacityWarning?: React.ReactNode;
	groupSizeWarning?: React.ReactNode;
}

const BookingTravellerStepper = ({
	value,
	onChange,
	min = 1,
	max,
	capacityWarning,
	groupSizeWarning,
}: BookingTravellerStepperProps) => {
	return (
		<div>
			<label className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-3">
				<Users className="w-4 h-4 text-teal-600" />
				Number of Travellers <span className="text-red-500">*</span>
			</label>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => onChange(Math.max(min, value - 1))}
					disabled={value <= min}
					className="w-9 h-9 rounded-lg border border-line text-ink-secondary hover:border-teal-500 hover:text-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					−
				</button>
				<input
					type="number"
					min={min}
					max={max}
					value={value}
					onChange={(e) => {
						const next = Number(e.target.value);
						if (!Number.isFinite(next)) return;
						onChange(Math.max(min, Math.min(max, next)));
					}}
					aria-label="Number of travellers"
					className="w-16 text-center border border-line rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
				/>
				<button
					type="button"
					onClick={() => onChange(Math.min(max, value + 1))}
					disabled={value >= max}
					className="w-9 h-9 rounded-lg border border-line text-ink-secondary hover:border-teal-500 hover:text-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					+
				</button>
			</div>
			{groupSizeWarning && (
				<div className="mt-1.5">{groupSizeWarning}</div>
			)}
			{capacityWarning && (
				<div className="mt-1.5">{capacityWarning}</div>
			)}
		</div>
	);
};

export default BookingTravellerStepper;
