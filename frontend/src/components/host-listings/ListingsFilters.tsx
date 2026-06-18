import { BOOKABLE_FILTER_OPTIONS, type BookableFilter } from "@/types/listings";

interface ListingsFilterProps {
    activeFilter: BookableFilter;
    onFilterChange: (filter: BookableFilter) => void; 
}

const ListingFilters = ({
    activeFilter,
    onFilterChange,
}: ListingsFilterProps) => {
    return (
        <div className="flex gap-2 mb-6 flex-wrap">
            {BOOKABLE_FILTER_OPTIONS.map((tab) => {
				const isActive = activeFilter === tab.value;
				return (
					<button
						key={tab.value}
						type="button"
						onClick={() => onFilterChange(tab.value)}
						className={`
							px-4 py-2 rounded-lg font-semibold text-sm transition-all
							${isActive
								? 'bg-teal-600 text-white'
								: 'bg-surface border border-line text-ink-muted hover:border-teal-600'
							}
						`}
					>
						{tab.label}
					</button>
				);
			})}
        </div>
    );
};

export default ListingFilters;
