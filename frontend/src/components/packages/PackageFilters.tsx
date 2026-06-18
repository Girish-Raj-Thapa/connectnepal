import type { PublicPackageFilterState } from '@/types/packages';

interface PackageFiltersProps {
	filters: PublicPackageFilterState;
	tagsInput: string;
	hasActiveFilters: boolean;
	onTagsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFilterChange: (updates: Partial<PublicPackageFilterState>) => void;
	onClear: () => void;
}

const PackageFilters = ({
	filters,
	tagsInput,
	hasActiveFilters,
	onTagsChange,
	onFilterChange,
	onClear,
}: PackageFiltersProps) => {
	return (
		<div className="bg-surface rounded-2xl shadow-sm border border-line p-5 sticky top-24">
			<div className="flex items-center justify-between mb-5">
				<h2 className="card-heading text-ink">Filters</h2>
				{hasActiveFilters && (
					<button
						type="button"
						onClick={onClear}
						className="text-sm text-teal-600 font-semibold hover:text-teal-700"
					>
						Clear
					</button>
				)}
			</div>

			{/* Tags */}
			<div className="mb-5">
				<label className="block text-xs font-semibold text-ink mb-2">
					Tags
				</label>
				<input
					type="text"
					value={tagsInput}
					onChange={onTagsChange}
					placeholder="e.g. adventure, trekking"
					className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
				/>
			</div>

			{/* Max Price */}
			<div className="mb-5">
				<label className="block text-xs font-semibold text-ink mb-2">
					Max Price (NPR)
				</label>
				<input
					type="number"
					value={filters.priceMax}
					onChange={(e) => onFilterChange({ priceMax: e.target.value })}
					placeholder="e.g. 30000"
					className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
				/>
			</div>

			{/* Max Duration */}
			<div className="mb-5">
				<label className="block text-xs font-semibold text-ink mb-2">
					Max Duration (days)
				</label>
				<input
					type="number"
					value={filters.durationDaysMax}
					onChange={(e) => onFilterChange({ durationDaysMax: e.target.value })}
					placeholder="e.g. 7"
					className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
				/>
			</div>

			{/* Sort By */}
			<div>
				<label className="block text-xs font-semibold text-ink mb-2">
					Sort By
				</label>
				<select
					title="Sort By"
					value={filters.ordering}
					onChange={(e) => onFilterChange({ ordering: e.target.value })}
					className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm cursor-pointer"
				>
					<option value="-created_at">Newest first</option>
					<option value="total_price">Price: Low to High</option>
					<option value="-total_price">Price: High to Low</option>
					<option value="-booking_count">Most Popular</option>
				</select>
			</div>
		</div>
	);
};

export default PackageFilters;
