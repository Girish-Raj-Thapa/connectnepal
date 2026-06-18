import {
	UserCheck,
	Star,
	CalendarCheck,
	AlertTriangle,
} from 'lucide-react';
import { timeAgo } from '@utils/format';
import type { RecentActivityItem } from '@/types/analytics';

interface ActivityItemProps {
	item: RecentActivityItem;
}

/** Pick icon + colors based on the activity source type. */
const sourceStyles: Record<
	string,
	{ icon: typeof UserCheck; bg: string; text: string }
> = {
	host_verification: {
		icon: UserCheck,
		bg: 'bg-green-100',
		text: 'text-green-600',
	},
	review_event: {
		icon: Star,
		bg: 'bg-amber-100',
		text: 'text-amber-600',
	},
	booking_status_history: {
		icon: CalendarCheck,
		bg: 'bg-blue-100',
		text: 'text-blue-600',
	},
};

const fallbackStyle = {
	icon: AlertTriangle,
	bg: 'bg-surface-muted',
	text: 'text-ink-muted',
};

const ActivityItem = ({ item }: ActivityItemProps) => {
	const style = sourceStyles[item.source] ?? fallbackStyle;
	const Icon = style.icon;

	return (
		<div className="flex items-start gap-3 p-3 bg-surface-muted rounded-lg">
			<div
				className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}
			>
				<Icon className={`w-4 h-4 ${style.text}`} />
			</div>

			<div className="flex-1 min-w-0">
				<p className="text-sm font-semibold text-ink">
					{item.label}
				</p>

				<p className="text-xs text-ink-muted line-clamp-2">
					{item.description}
				</p>

				<p className="text-xs text-ink-muted mt-1">
					{timeAgo(item.occurredAt)}
				</p>
			</div>
		</div>
	);
};

export default ActivityItem;