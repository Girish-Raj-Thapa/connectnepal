import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: ButtonVariant;
	fullWidth?: boolean;
	loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
	primary: 'gradient-teal text-white hover:shadow-lg',
	secondary: 'bg-surface text-brand border-2 border-brand hover:bg-brand hover:text-white',
	danger: 'bg-red-600 text-white hover:bg-red-700',
	ghost: 'bg-transparent text-ink-muted hover:text-ink px-0',
};

const Button = ({
	children,
	variant = 'primary',
	type = 'button',
	fullWidth = false,
	loading = false,
	disabled = false,
	className = '',
	...props
}: ButtonProps) => {
	return (
		<button
			type={type}
			disabled={disabled || loading}
			className={`
				px-6 py-2.5 rounded-xl font-semibold transition-all duration-300
				disabled:opacity-60 disabled:cursor-not-allowed
				${variantStyles[variant]}
				${fullWidth ? 'w-full' : ''}
				${className}
			`}
			{...props}
		>
			{loading ? (
				<span className="flex items-center justify-center gap-2">
					<svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
					Loading...
				</span>
			) : (
				children
			)}
		</button>
	);
};

export default Button;
