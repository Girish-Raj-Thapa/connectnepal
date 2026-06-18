interface SelectableOption {
    value: string;
    label: string;
}

interface SelectableButtonGridProps {
	label?: string;
	options: readonly SelectableOption[];
	value: string;
	onChange: (selected: string) => void;
	columns?: number;
	error?: string;
	required?: boolean;
}


const SelectableButtonGrid = ({
	label,
	options,
	value,
	onChange,
	columns = 3,
	error,
	required = false,
}: SelectableButtonGridProps) => {
    return (
		<div className="w-full">
			{label && (
				<label className="block text-xs font-semibold text-ink-secondary mb-2">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<div
				className={`grid grid-cols-2 gap-3`}
				style={{
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				}}
			>
				{options.map((option) => {
					const isSelected = value === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => onChange(option.value)}
							className={`
								py-2.5 px-3 rounded-lg text-sm font-medium
								border transition-all cursor-pointer
								${isSelected
									? 'bg-tealbrand text-white border-tealbrand'
									: 'bg-surface-muted text-ink-secondary border-line hover:border-tealbrand hover:text-tealbrand hover:bg-brand-subtle'
								}
							`}
						>
							{option.label}
						</button>
					);
				})}
			</div>

			{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
		</div>
	);
};

export default SelectableButtonGrid;