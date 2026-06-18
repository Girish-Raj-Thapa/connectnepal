import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
	label?: string;
	error?: string;
	icon?: LucideIcon;
}

const InputField = ({
	label,
	type = 'text',
	name,
	value,
	onChange,
	placeholder,
	error,
	disabled = false,
	required = false,
	icon: Icon,
	...props
}: InputFieldProps) => {
	return (
		<div className="w-full">
			{label && (
				<label
					htmlFor={name}
					className="block text-xs font-semibold text-ink-secondary mb-1"
				>
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<div className="relative">
				{Icon && (
					<span className="absolute inset-y-0 left-0 flex items-center pl-4 text-ink-muted">
						<Icon size={20} />
					</span>
				)}

				<input
					id={name}
					name={name}
					type={type}
					value={value}
					onChange={onChange}
					placeholder={placeholder}
					disabled={disabled}
					className={`
						w-full border-2 rounded-xl py-2.5 px-4 transition-all
						focus:outline-none focus:ring-0 focus:ring-tealbrand
						disabled:opacity-60 disabled:cursor-not-allowed
						${Icon ? 'pl-12' : 'pl-4'}
						${error
							? 'border-red-500 focus:border-red-500 bg-red-subtle'
							: 'border-line focus:border-brand bg-surface-muted focus:bg-surface'
						}
					`}
					{...props}
				/>
			</div>

			{error && (
				<p className="text-red-500 text-xs mt-1">{error}</p>
			)}
		</div>
	);
};

export default InputField;
