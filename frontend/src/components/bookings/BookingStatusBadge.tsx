import {
    BOOKING_STATUS_LABELS,
    BOOKING_STATUS_COLORS,
    type BookingStatus,
} from '@/types/bookings';


interface Props {
    status: BookingStatus;
    size?: 'sm' | 'md';
}

const BookingStatusBadge = ({ status, size = "md" }: Props) => {
    const { bg, text, dot } = BOOKING_STATUS_COLORS[status];
    const label = BOOKING_STATUS_LABELS[status];
    const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-semibold';
    const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium ${bg} ${text} ${textSize} ${padding}`}
            aria-label={`Booking status: ${label}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
            { label }
        </span>
    );
};

export default BookingStatusBadge;
