interface CategoryBarProps {
	items: { label: string; count: number }[];
}

/** Colors cycling through bars (matches the HTML prototype order). */
const barColors = [
	'bg-teal-600',
	'bg-purple-600',
	'bg-orange-600',
	'bg-blue-600',
	'bg-amber-600',
	'bg-green-600',
	'bg-red-600',
	'bg-indigo-600',
];

const CategoryBar = ({ items }: CategoryBarProps) => {
	const total = items.reduce((sum, i) => sum + i.count, 0);

	if (total === 0) {
		return (
			<p className="text-sm text-ink-muted">
				No listings yet.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{items.map((item, idx) => {
				const pct = ((item.count / total) * 100).toFixed(1);

				return (
					<div key={item.label}>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm font-semibold text-ink-secondary">
								{item.label}
							</span>
							<span className="text-sm font-bold text-ink">
								{item.count} ({pct}%)
							</span>
						</div>

						<div className="w-full bg-surface-raised rounded-full h-2">
							<div
								className={`h-2 rounded-full ${
									barColors[idx % barColors.length]
								}`}
								style={{ width: `${pct}%` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default CategoryBar;