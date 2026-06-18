import type { ReactNode } from 'react';
import ExceptionRowActions from '@components/slots/shared/ExceptionRowActions';

interface ScheduleCardProps {
	isActive: boolean;
	title: ReactNode;
	summary: ReactNode;
	secondaryLine?: ReactNode;
	tertiaryLine?: ReactNode;
	onEdit: () => void;
	onDelete: () => void;
	deleting: boolean;
}

const ScheduleCard = ({
	isActive,
	title,
	summary,
	secondaryLine,
	tertiaryLine,
	onEdit,
	onDelete,
	deleting,
}: ScheduleCardProps) => (
	<div className="bg-surface border border-line rounded-xl px-5 py-4 flex flex-wrap gap-4 items-start justify-between">
		<div className="space-y-0.5 flex-1 min-w-0">
			<div className="flex flex-wrap items-center gap-2">
				<span className={`h-2 w-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-line'}`} />
				<span className="text-sm font-semibold text-ink">{title}</span>
				<span className="text-xs text-ink-muted">{summary}</span>
				{!isActive && (
					<span className="text-xs bg-surface-muted text-ink-muted px-2 py-0.5 rounded-full">
						Inactive
					</span>
				)}
			</div>
			{secondaryLine}
			{tertiaryLine}
		</div>

		<ExceptionRowActions
			onEdit={onEdit}
			onDelete={onDelete}
			deleting={deleting}
			className="flex gap-2 shrink-0"
		/>
	</div>
);

export default ScheduleCard;
