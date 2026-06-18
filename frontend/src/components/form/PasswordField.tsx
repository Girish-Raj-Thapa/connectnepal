import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
	label?: string;
	error?: string;
}

const PasswordField = ({
	label,
	name,
	value,
	onChange,
	placeholder = '••••••••',
	error,
	disabled = false,
	required = false,
	...props
}: PasswordFieldProps) => {
	const [showPassword, setShowPassword] = useState(false);

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
				<span className="absolute inset-y-0 left-0 flex items-center pl-4 text-ink-muted">
					<Lock size={20} />
				</span>

				<input
					id={name}
					name={name}
					type={showPassword ? 'text' : 'password'}
					value={value}
					onChange={onChange}
					placeholder={placeholder}
					disabled={disabled}
					className={`
						w-full border-2 rounded-xl py-2.5 pl-12 pr-12
						transition-all
						focus:outline-none focus:ring-0 focus:ring-tealbrand
						disabled:opacity-60 disabled:cursor-not-allowed
						${error
							? 'border-red-500 focus:border-red-500 bg-red-50'
							: 'border-line focus:border-tealbrand bg-surface-muted focus:bg-surface'
						}
					`}
					{...props}
				/>

				<button
					type="button"
					onClick={() => setShowPassword(!showPassword)}
					className="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-muted hover:text-ink-muted"
					tabIndex={-1}
				>
					{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
				</button>
			</div>

			{error && (
				<p className="text-red-500 text-xs mt-1">{error}</p>
			)}
		</div>
	);
};

export default PasswordField;
