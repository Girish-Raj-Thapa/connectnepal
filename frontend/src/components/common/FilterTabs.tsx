interface Tab<T extends string> {
	value: T;
	label: string;
	count?: number;
}

interface Props<T extends string> {
	tabs: Tab<T>[];
	active: T;
	onChange: (value: T) => void;
	ariaLabel?: string;
}

const FilterTabs = <T extends string,>({
	tabs,
	active,
	onChange,
	ariaLabel = 'Filter',
}: Props<T>) => {
	return (
		<div
			className="flex flex-wrap gap-2 mb-6"
			role="tablist"
			aria-label={ariaLabel}
		>
			{tabs.map((tab) => {
				const isActive = tab.value === active;

				return (
					<button
						key={tab.value}
						role="tab"
						aria-selected={isActive}
						onClick={() => onChange(tab.value)}
						className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
							isActive
								? 'bg-teal-600 text-white shadow'
								: 'bg-surface border border-line text-ink-muted hover:border-teal-400 hover:text-teal-700'
						}`}
					>
						{tab.label}

						{tab.count !== undefined && (
							<span
								className={`ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold ${
									isActive
										? 'bg-white/25 text-white'
										: 'bg-surface-muted text-ink-muted'
								}`}
							>
								{tab.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
};

export default FilterTabs;
