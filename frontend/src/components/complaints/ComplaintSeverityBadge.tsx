import { AlertTriangle } from 'lucide-react';
import {
    SEVERITY_LABELS,
    SEVERITY_COLORS,
    type ComplaintSeverity,
} from '@/types/complaints';

interface Props {
    severity: ComplaintSeverity;
}

const ComplaintSeverityBadge = ({ severity }: Props) => {
    const { bg, text } = SEVERITY_COLORS[severity];
    const label = SEVERITY_LABELS[severity];

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${bg} ${text}`}
        >
            {(severity === 'high' || severity === 'critical') && (
                <AlertTriangle className="w-3 h-3" />
            )}
            {label}
        </span>
    );
};

export default ComplaintSeverityBadge;
