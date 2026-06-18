import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type TableActionVariant = 'default' | 'danger';
type TableActionSize = 'sm' | 'md';

interface BaseTableActionIconProps {
	label: string;
	tooltip?: string;
	icon: ReactNode;
	disabled?: boolean;
	variant?: TableActionVariant;
	size?: TableActionSize;
	className?: string;
}

type TableActionIconProps =
	| (BaseTableActionIconProps & {
			to: string;
			onClick?: never;
	  })
	| (BaseTableActionIconProps & {
			onClick: () => void;
			to?: never;
	  });

const variantClasses: Record<TableActionVariant, string> = {
	default: 'border-line text-ink-muted hover:bg-surface-muted hover:text-ink',
	danger: 'border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700',
};

const sizeClasses: Record<TableActionSize, string> = {
	sm: 'h-8 w-8',
	md: 'h-9 w-9',
};

const TableActionIcon = ({
	label,
	tooltip: tooltipText = label,
	icon,
	disabled = false,
	variant = 'default',
	size = 'md',
	className = '',
	...props
}: TableActionIconProps) => {
	const linkTarget = 'to' in props ? props.to : undefined;
	const handleClick = 'onClick' in props ? props.onClick : undefined;

	const controlClassName = [
		'inline-flex items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
		sizeClasses[size],
		variantClasses[variant],
		disabled ? 'cursor-not-allowed opacity-50' : '',
		className,
	].join(' ').trim();

	const tooltipElement = (
		<span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
			{tooltipText}
		</span>
	);

	const content = (
		<>
			<span aria-hidden="true" className="flex items-center justify-center">
				{icon}
			</span>
			<span className="sr-only">{label}</span>
		</>
	);

	return (
		<div className="relative inline-flex group align-middle">
			{linkTarget ? (
				disabled ? (
					<span aria-disabled="true" className={controlClassName}>
						{content}
					</span>
				) : (
					<Link
						to={linkTarget}
						aria-label={label}
						className={controlClassName}
					>
						{content}
					</Link>
				)
			) : (
				<button
					type="button"
					onClick={handleClick}
					disabled={disabled}
					aria-label={label}
					className={controlClassName}
				>
					{content}
				</button>
			)}
			{tooltipElement}
		</div>
	);
};

export default TableActionIcon;
