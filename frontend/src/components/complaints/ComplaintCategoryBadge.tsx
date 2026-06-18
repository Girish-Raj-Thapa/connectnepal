import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    type ComplaintCategory,
} from '@/types/complaints';

interface Props {
    category: ComplaintCategory;
}

const ComplaintCategoryBadge = ({ category }: Props) => {
    const { bg, text } = CATEGORY_COLORS[category];
    const label = CATEGORY_LABELS[category];

    return (
        <span className={`px-2 py-1 rounded text-xs font-bold ${bg} ${text}`}>
            {label}
        </span>
    );
};

export default ComplaintCategoryBadge;
