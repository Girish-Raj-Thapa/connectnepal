import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/**
 * Dropdown Component
 *
 * 1. Receives options array with {value, label} objects
 * 2. Renders styled select with custom chevron icon
 * 3. Calls onChange with the selected value (not the event)
 * 4. Shows error state with red border when validation fails
 */


interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    label?: string;
	options: readonly DropdownOption[];
	error?: string;
	required?: boolean;
	onChange?: (value: string) => void;
	value?: string;
	placeholder?: string;
}


const Dropdown = ({
    label,
	options,
	error,
	required,
	onChange,
	value,
	disabled,
	name,
	placeholder = 'Select an option',
	...props
}: DropdownProps) => {
    return (
        <div className="w-full">
            { label && (
                <label
					htmlFor={name}
					className="block text-xs font-semibold text-ink-secondary mb-1"
				>
                    {label} {required && <span className="text-red-500">*</span>}
				</label>
            )}

            <div className="relative">
                <select
					id={name}
					name={name}
					value={value}
					disabled={disabled}
					onChange={(e) => onChange?.(e.target.value)}
					className={`
						w-full appearance-none border-2 rounded-xl py-2.5 px-4 pr-10 transition-all
						focus:outline-none focus:ring-0
						disabled:opacity-60 disabled:cursor-not-allowed
						${error
							? 'border-red-500 focus:border-red-500 bg-red-subtle'
							: 'border-line focus:border-brand bg-surface-muted focus:bg-surface'
						}
						${!value ? 'text-ink-muted' : 'text-ink'}
					`}
					{...props}
				>
					<option value="" disabled>
						{placeholder}
					</option>
					{options.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>

				{/* Chevron Icon */}
				<span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-ink-muted">
					<ChevronDown size={18} />
				</span>
            </div>

            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        </div>
    );
};

export default Dropdown;