import type { ChangeEventHandler } from 'react';

interface RadioOption {
	value: string;
	label: string;
}

interface RadioGroupProps {
	label?: string;
	name: string;
	options: ReadonlyArray<RadioOption>;
	value?: string;
	onChange?: ChangeEventHandler<HTMLInputElement>;
	error?: string;
	required?: boolean;
}

const RadioGroup = ({
	label,
	name,
	options,
	value,
	onChange,
	error,
	required = false,
}: RadioGroupProps) => {
	return (
		<div className="w-full">
			{label && (
				<label className="block text-xs font-semibold text-ink-secondary mb-2">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<div className="flex gap-6 items-center">
				{options.map((option) => (
					<label
						key={option.value}
						className="flex items-center gap-2 cursor-pointer text-ink-secondary hover:text-tealbrand"
					>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={value === option.value}
							onChange={onChange}
							className="w-4 h-4 text-tealbrand border-line focus:ring-tealbrand cursor-pointer"
						/>
						<span className="text-sm font-medium">{option.label}</span>
					</label>
				))}
			</div>

			{error && (
				<p className="text-red-500 text-xs mt-1">{error}</p>
			)}
		</div>
	);
};

export default RadioGroup;
