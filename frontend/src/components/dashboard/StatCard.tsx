import type { ReactNode } from 'react';

/** Color theme presets matching the HTML prototypes. */
export type StatCardColor =
	| 'blue' | 'green' | 'teal' | 'purple' | 'amber' | 'orange' | 'indigo' | 'red';

interface StatCardProps {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: ReactNode;
	color: StatCardColor;
	variant?: 'gradient' | 'plain';
}

/**
 * Tailwind class maps per color.
 *
 * gradient variant: colored background, colored border, white icon box
 * plain variant:    white background, gray border, colored icon box
 */
const gradientStyles: Record<
	StatCardColor,
	{
		card: string;
		bubble: string;
		iconBox: string;
		label: string;
	}
> = {
	blue: {
		card: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
		bubble: 'bg-blue-200',
		iconBox: 'bg-blue-500',
		label: 'text-blue-600',
	},
	green: {
		card: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
		bubble: 'bg-green-200',
		iconBox: 'bg-green-500',
		label: 'text-green-600',
	},
	teal: {
		card: 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200',
		bubble: 'bg-teal-200',
		iconBox: 'bg-teal-500',
		label: 'text-teal-600',
	},
	purple: {
		card: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
		bubble: 'bg-purple-200',
		iconBox: 'bg-purple-500',
		label: 'text-purple-600',
	},
	amber: {
		card: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200',
		bubble: 'bg-amber-200',
		iconBox: 'bg-amber-500',
		label: 'text-amber-600',
	},
	orange: {
		card: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
		bubble: 'bg-orange-200',
		iconBox: 'bg-orange-500',
		label: 'text-orange-600',
	},
	indigo: {
		card: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200',
		bubble: 'bg-indigo-200',
		iconBox: 'bg-indigo-500',
		label: 'text-indigo-600',
	},
	red: {
		card: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200',
		bubble: 'bg-red-200',
		iconBox: 'bg-red-500',
		label: 'text-red-600',
	},
};

const plainIconBoxColors: Record<StatCardColor, string> = {
	blue: 'bg-blue-100 text-blue-600',
	green: 'bg-green-100 text-green-600',
	teal: 'bg-teal-100 text-teal-600',
	purple: 'bg-purple-100 text-purple-600',
	amber: 'bg-amber-100 text-amber-600',
	orange: 'bg-orange-100 text-orange-600',
	indigo: 'bg-indigo-100 text-indigo-600',
	red: 'bg-red-100 text-red-600',
};

const StatCard = ({
	label,
	value,
	subtitle,
	icon,
	color,
	variant = 'gradient',
}: StatCardProps) => {
	if (variant === 'plain') {
		return (
			<div className="bg-surface rounded-xl border border-line p-4 hover:shadow-md transition-all">
				<div className="flex items-center justify-between mb-2">
					<div className="text-xs font-semibold text-ink-muted uppercase">
						{label}
					</div>
					<div
						className={`w-8 h-8 rounded-lg flex items-center justify-center ${plainIconBoxColors[color]}`}
					>
						{icon}
					</div>
				</div>
				<div className="text-2xl font-bold text-ink mb-1">
					{value}
				</div>
				{subtitle && (
					<div className="text-xs text-ink-muted">{subtitle}</div>
				)}
			</div>
		);
	}

	// Gradient variant
	const s = gradientStyles[color];

	return (
		<div
			className={`rounded-xl border p-4 relative overflow-hidden hover:shadow-md transition-all ${s.card}`}
		>
			{/* Decorative bubble (matches the HTML prototype) */}
			<div
				className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 opacity-50 ${s.bubble}`}
			/>
			<div className="relative">
				<div className="flex items-center justify-between mb-2">
					<div
						className={`text-xs font-semibold uppercase ${s.label}`}
					>
						{label}
					</div>
					<div
						className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${s.iconBox}`}
					>
						{icon}
					</div>
				</div>
				<div className="text-2xl font-bold text-ink mb-1">
					{value}
				</div>
				{subtitle && (
					<div className="text-xs text-ink-muted">{subtitle}</div>
				)}
			</div>
		</div>
	);
};

export default StatCard;