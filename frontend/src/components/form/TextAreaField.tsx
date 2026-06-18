import type { TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
	label?: string;
	error?: string;
}

const TextAreaField = ({
	label,
	name,
	value,
	onChange,
	placeholder,
	error,
	disabled = false,
	required = false,
	rows = 4,
	...props
}: TextAreaFieldProps) => {
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

			<textarea
				id={name}
				name={name}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				rows={rows}
				className={`
					w-full border-2 rounded-xl py-2.5 px-4 transition-all resize-y
					focus:outline-none focus:ring-0 focus:ring-tealbrand
					disabled:opacity-60 disabled:cursor-not-allowed
					${error
						? 'border-red-500 focus:border-red-500 bg-red-subtle'
						: 'border-line focus:border-brand bg-surface-muted focus:bg-surface'
					}
				`}
				{...props}
			/>

			{error && (
				<p className="text-red-500 text-xs mt-1">{error}</p>
			)}
		</div>
	);
};

export default TextAreaField;
