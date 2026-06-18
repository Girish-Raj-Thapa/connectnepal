import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'danger' | 'teal' | 'dark';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: IconButtonVariant;
}

const variantStyles: Record<IconButtonVariant, string> = {
	default: 'text-ink-muted hover:text-ink-secondary hover:bg-surface-muted',
	teal:    'text-ink-muted hover:text-teal-600 hover:bg-teal-50',
	danger:  'text-ink-muted hover:text-red-600 hover:bg-red-50',
	dark:    'text-white hover:bg-white/20',
};

const IconButton = ({
	children,
	variant = 'default',
	className = '',
	type = 'button',
	...props
}: IconButtonProps) => (
	<button
		type={type}
		className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
			${variantStyles[variant]} ${className}`}
		{...props}
	>
		{children}
	</button>
);

export default IconButton;
