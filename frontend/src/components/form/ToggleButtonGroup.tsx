interface ToggleButtonGroupProps {
    label?: string;
    options: readonly string[];
    value: string[];
	onChange: (selected: string[]) => void;
	error?: string;
	required?: boolean;
}


const ToggleButtonGroup = ({
    label,
    options,
    value,
    onChange,
    error,
    required = false,
}: ToggleButtonGroupProps) => {

    const toggle = (option: string) => {
		if (value.includes(option)) {
			onChange(value.filter((v) => v !== option));
		} else {
			onChange([...value, option]);
		}
	};

    return (
        <div className="w-full">
			{label && (
				<label className="block text-xs font-semibold text-ink-secondary mb-2">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const isSelected = value.includes(option);
					return (
						<button
							key={option}
							type="button"
							onClick={() => toggle(option)}
							className={`
								px-4 py-2 rounded-full text-sm font-medium
								border transition-all cursor-pointer
								${isSelected
									? 'bg-tealbrand text-white border-tealbrand'
									: 'bg-surface-muted text-ink-secondary border-line hover:border-tealbrand hover:text-tealbrand hover:bg-brand-subtle'
								}
							`}
						>
							{option}
						</button>
					);
				})}
			</div>

			{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
		</div>
    );
};

export default ToggleButtonGroup;