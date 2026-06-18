import {
    PAYMENT_STATUS_LABELS,
    PAYMENT_STATUS_COLORS,
    type PaymentStatus,
} from "@/types/bookings";

interface Props {
    status: PaymentStatus;
    size?: 'sm' | 'md';
}

const PaymentStatusBadge = ({ status, size = "md"}: Props) => {
    const { bg, text } = PAYMENT_STATUS_COLORS[status];
    const label = PAYMENT_STATUS_LABELS[status];
    const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-semibold';
    const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

    return (
        <span
			className={`inline-flex items-center rounded-full font-medium ${bg} ${text} ${textSize} ${padding}`}
			aria-label={`Payment status: ${label}`}
		>
            { label }
        </span>
    );
};

export default PaymentStatusBadge;