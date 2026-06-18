import { Trash2, Pencil } from 'lucide-react';

interface ExceptionRowActionsProps {
	onEdit: () => void;
	onDelete: () => void;
	deleting: boolean;
	className?: string;
}

const ExceptionRowActions = ({
	onEdit,
	onDelete,
	deleting,
	className = 'flex items-center justify-end gap-2',
}: ExceptionRowActionsProps) => (
	<div className={className}>
		<button
			type="button"
			onClick={onEdit}
			disabled={deleting}
			className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
				border border-line text-ink-secondary rounded-lg hover:bg-surface-muted
				disabled:opacity-50 transition-colors"
		>
			<Pencil className="w-3.5 h-3.5" />
			Edit
		</button>
		<button
			type="button"
			onClick={onDelete}
			disabled={deleting}
			className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
				border border-red-200 text-red-600 rounded-lg hover:bg-red-50
				disabled:opacity-50 transition-colors"
		>
			{deleting ? (
				<span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
			) : (
				<Trash2 className="w-3.5 h-3.5" />
			)}
			Delete
		</button>
	</div>
);

export default ExceptionRowActions;
