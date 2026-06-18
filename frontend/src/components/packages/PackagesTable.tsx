import { Link } from 'react-router-dom';
import type { PackageSummary, PackageTabFilter } from '@/types/packages';
import StatusToggle from '@components/form/StatusToggle';
import PackageActionsMenu from '@components/packages/PackageActionsMenu';
import { ROUTES } from '@constants/routes';


const TABS: { value: PackageTabFilter; label: string }[] = [
	{ value: 'all', label: 'All Packages' },
	{ value: 'active', label: 'Active' },
	{ value: 'inactive', label: 'Inactive' },
];

const TABLE_HEADERS = [
	'Package Name', 'Listings', 'Duration',
	'Price', 'Discount', 'Bookings', 'Status', 'Actions',
];


interface PackagesTableProps {
	packages: PackageSummary[];
	activeTab: PackageTabFilter;
	onTabChange: (tab: PackageTabFilter) => void;
	totalCount: number;
	onDelete: (pkg: PackageSummary) => void;
	onTogglePublish: (pkg: PackageSummary) => void;
	actionLoading: boolean;
}


const PackagesTable = ({
	packages,
	activeTab,
	onTabChange,
	totalCount,
	onDelete,
	onTogglePublish,
	actionLoading,
}: PackagesTableProps) => {
	return (
		<div>
			{/* Filter Tabs */}
			<div className="flex gap-2 mb-6 flex-wrap">
				{TABS.map((tab) => (
					<button
						key={tab.value}
						onClick={() => onTabChange(tab.value)}
						className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
							activeTab === tab.value
								? 'bg-teal-600 text-white'
								: 'bg-surface border border-line text-ink-muted hover:border-teal-600'
						}`}
					>
						{tab.label}
						{tab.value === 'all' && ` (${totalCount})`}
					</button>
				))}
			</div>

			{/* Table  */}
			<div className="bg-surface rounded-2xl border border-line overflow-hidden">
				<div className="overflow-x-auto overflow-y-visible">
					<table className="w-full">
						<thead className="bg-surface-muted border-b border-line">
							<tr>
								{TABLE_HEADERS.map((h) => (
									<th
										key={h}
										className="th-cell"
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{packages.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										className="px-6 py-12 text-center text-sm text-ink-muted"
									>
										No packages found.{' '}
										<Link
											to={ROUTES.HOST_CREATE_PACKAGE}
											className="text-teal-600 font-semibold hover:underline"
										>
											Create your first package
										</Link>
									</td>
								</tr>
							) : (
								packages.map((pkg) => (
									<tr
										key={pkg.id}
										className="hover:bg-surface-muted transition-colors"
									>
										{/* Package Name */}
										<td className="px-6 py-4">
											<div className="font-semibold text-ink">
												{pkg.title}
											</div>
											<div className="text-xs text-ink-muted">
												{pkg.listingCount} Experience{pkg.listingCount !== 1 ? 's' : ''}
											</div>
										</td>

										{/* Listings */}
										<td className="px-6 py-4 text-sm text-ink-muted">
											{pkg.includedListingNames.slice(0, 2).map((name) => (
												<div key={name}>{name}</div>
											))}
											{pkg.listingCount > 2 && (
												<div className="text-xs text-ink-muted">
													+{pkg.listingCount - 2} more
												</div>
											)}
										</td>

										{/* Duration */}
										<td className="px-6 py-4 text-sm text-ink-muted">
											{pkg.durationDays}D / {pkg.durationNights}N
										</td>

										{/* Price */}
										<td className="px-6 py-4 text-sm font-semibold text-ink">
											NPR {Number(pkg.totalPrice).toLocaleString()}
										</td>

										{/* Discount */}
										<td className="px-6 py-4">
											{pkg.discountLabel ? (
												<span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
													{pkg.discountLabel}
												</span>
											) : (
												<span className="text-sm text-ink-muted">—</span>
											)}
										</td>

										{/* Bookings */}
										<td className="px-6 py-4 text-sm text-ink-muted">
											{pkg.bookingCount}
										</td>

										{/* Status */}
										<td className="px-6 py-4">
											<StatusToggle
												checked={pkg.isBookable}
												onToggle={() => onTogglePublish(pkg)}
												disabled={actionLoading || pkg.listingCount < 2}
												disabledReason={
													pkg.listingCount < 2
														? 'Requires at least 2 listings to publish.'
														: undefined
												}
											/>
										</td>

										{/* Actions */}
										<td className="px-6 py-4">
											<PackageActionsMenu
												pkg={pkg}
												onDelete={onDelete}
												disabled={actionLoading}
											/>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default PackagesTable;
