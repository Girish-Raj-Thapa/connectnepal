import {
    COMPLAINT_STATUS_LABELS,
    COMPLAINT_STATUS_COLORS,
    type ComplaintStatus,
} from '@/types/complaints';

interface Props {
    status: ComplaintStatus;
    size?: 'sm' | 'md';
}

const ComplaintStatusBadge = ({ status, size = 'md' }: Props) => {
    const { bg, text, dot } = COMPLAINT_STATUS_COLORS[status];
    const label = COMPLAINT_STATUS_LABELS[status];
    const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-semibold';
    const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium ${bg} ${text} ${textSize} ${padding}`}
            aria-label={`Status: ${label}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {label}
        </span>
    );
};

export default ComplaintStatusBadge;
