import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ResultVariant = 'success' | 'error' | 'info';

const variants: Record<ResultVariant, string> = {
	success: 'bg-brand-subtle text-tealbrand',
	error: 'bg-red-100 text-red-600',
	info: 'bg-blue-100 text-blue-600',
};

type Action = { label: string; to: string };

/**
 * Presentational card for full-page success/error/info states.
 */
const ResultCard = ({
	icon,
	title,
	message,
	action,
	variant = 'success',
}: {
	icon: ReactNode;
	title: string;
	message: string;
	action?: Action;
	variant?: ResultVariant;
}) => (
	<div className="text-center">
		<div className="flex justify-center mb-6">
			<div className={`p-5 rounded-full ${variants[variant]}`}>{icon}</div>
		</div>
		<h1 className="page-heading text-ink mb-3">{title}</h1>
		<p className="page-subtext mb-6">{message}</p>
		{action && (
			<Link
				to={action.to}
				className="inline-block text-tealbrand font-semibold hover:text-tealbrand-dark hover:underline text-sm"
			>
				{action.label}
			</Link>
		)}
	</div>
);

export default ResultCard;
