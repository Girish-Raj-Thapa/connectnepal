interface StatusToggleProps {
	checked: boolean;
	onToggle: () => void;
	disabled?: boolean;
	activeLabel?: string;
	inactiveLabel?: string;
	disabledReason?: string;
}

const StatusToggle = ({
	checked,
	onToggle,
	disabled = false,
	activeLabel = 'Active',
	inactiveLabel = 'Inactive',
	disabledReason,
}: StatusToggleProps) => {
	const label = checked ? activeLabel : inactiveLabel;

	return (
		<div className="inline-flex items-center gap-2">
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={onToggle}
				disabled={disabled}
				title={disabledReason}
				className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
					checked ? 'bg-emerald-500' : 'bg-line'
				} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
			>
				<span
					className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
						checked ? 'translate-x-6' : 'translate-x-1'
					}`}
				/>
			</button>
			<span
				className={`text-xs font-semibold ${
					checked ? 'text-emerald-700' : 'text-ink-muted'
				}`}
			>
				{label}
			</span>
		</div>
	);
};

export default StatusToggle;
