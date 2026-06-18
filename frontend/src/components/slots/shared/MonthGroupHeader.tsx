import { ChevronDown, ChevronRight } from 'lucide-react';
import Checkbox from '@components/form/Checkbox';

interface MonthGroupHeaderProps {
	open: boolean;
	label: string;
	count: number;
	allSelected: boolean;
	someSelected: boolean;
	onToggle: () => void;
	onToggleAll: () => void;
}

const MonthGroupHeader = ({
	open,
	label,
	count,
	allSelected,
	someSelected,
	onToggle,
	onToggleAll,
}: MonthGroupHeaderProps) => (
	<div
		className="flex items-center gap-3 px-4 py-3 bg-surface-muted cursor-pointer select-none
			hover:bg-surface-muted transition-colors"
		onClick={onToggle}
	>
		<Checkbox
			checked={allSelected}
			indeterminate={someSelected && !allSelected}
			onChange={onToggleAll}
			onClick={(e) => e.stopPropagation()}
		/>

		{open ? (
			<ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
		) : (
			<ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
		)}

		<span className="text-sm font-bold text-ink flex-1">{label}</span>
		<span className="text-xs text-ink-muted shrink-0">
			{count} slot{count !== 1 ? 's' : ''}
		</span>
	</div>
);

export default MonthGroupHeader;
