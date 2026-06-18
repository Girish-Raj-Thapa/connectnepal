import type { TripPlanStatus } from '@/types/tripPlanner';

interface StatusTab {
	value: TripPlanStatus | 'all';
	label: string;
	count: number;
}

interface TripStatusTabsProps {
	tabs: StatusTab[];
	active: TripPlanStatus | 'all';
	onChange: (status: TripPlanStatus | 'all') => void;
}

const TripStatusTabs = ({ tabs, active, onChange }: TripStatusTabsProps) => {
	return (
		<div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
			{tabs.map((tab) => {
				const isActive = active === tab.value;
				return (
					<button
						key={tab.value}
						onClick={() => onChange(tab.value)}
						className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
							isActive
								? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
								: 'bg-surface border-2 border-line hover:border-teal-600 text-ink-secondary hover:text-teal-600'
						}`}
					>
						{tab.label} ({tab.count})
					</button>
				);
			})}
		</div>
	);
};

export default TripStatusTabs;
