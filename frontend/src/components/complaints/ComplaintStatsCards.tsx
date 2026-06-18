import { AlertCircle, Clock, ClipboardList, CheckCircle } from 'lucide-react';
import StatCard from '@components/dashboard/StatCard';

interface Props {
    stats: {
        urgent: number;
        open: number;
        inProgress: number;
        resolved: number;
    };
}

const ComplaintStatsCards = ({ stats }: Props) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
            label="Urgent"
            value={stats.urgent}
            icon={<AlertCircle className="w-4 h-4" />}
            color="red"
            variant="plain"
        />
        <StatCard
            label="Open"
            value={stats.open}
            icon={<Clock className="w-4 h-4" />}
            color="amber"
            variant="plain"
        />
        <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={<ClipboardList className="w-4 h-4" />}
            color="blue"
            variant="plain"
        />
        <StatCard
            label="Resolved"
            value={stats.resolved}
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
            variant="plain"
        />
    </div>
);

export default ComplaintStatsCards;
