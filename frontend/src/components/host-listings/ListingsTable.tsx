import type { MyListing, ListingAction } from '@/types/listings';
import StatusToggle from '@components/form/StatusToggle';
import ListingActionsMenu from '@components/host-listings/ListingActionsMenu';
import { Star } from 'lucide-react';

interface ListingsTableProps {
	listings: MyListing[];
	onAction: (action: ListingAction, listingId: number) => void;
	actionLoading?: boolean;
}

const ListingsTable = ({
	listings,
	onAction,
	actionLoading = false,
}: ListingsTableProps) => {
	return (
		<div className="bg-surface rounded-2xl border border-line">
			<div className="overflow-x-auto overflow-y-visible">
				<table className="w-full">
					<thead className="bg-surface-muted border-b border-line">
						<tr>
							<th className="th-cell">
								Listing
							</th>
							<th className="th-cell">
								Category
							</th>
							<th className="th-cell">
								Price
							</th>
							<th className="th-cell">
								Bookings
							</th>
							<th className="th-cell">
								Rating
							</th>
							<th className="th-cell">
								Status
							</th>
							<th className="th-cell">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-line">
						{listings.map((listing) => (
							<tr key={listing.id} className="hover:bg-surface-muted transition-colors">
								{/* Listing */}
								<td className="px-6 py-4">
									<div className="font-semibold text-ink">
										{listing.title}
									</div>
								</td>

								{/* Category */}
								<td className="px-6 py-4 text-sm text-ink-secondary">
									{listing.categoryDisplay}
								</td>

								{/* Price */}
								<td className="px-6 py-4 text-sm font-semibold text-ink">
									NPR {Number(listing.pricePerPerson).toLocaleString()}
								</td>

								{/* Bookings */}
								<td className="px-6 py-4 text-sm text-ink-muted">
									{String(listing.bookingCount)}
								</td>

								{/* Rating */}
								<td className="px-6 py-4">
									{listing.ratingCount > 0 ? (
										<div className="flex items-center gap-1 text-sm">
											<Star className="w-4 h-4 text-amber-400 fill-amber-400" />
											<span className="font-semibold text-ink">
												{listing.ratingAverage}
											</span>
										</div>
									) : (
										<span className="text-sm text-ink-muted">—</span>
									)}
								</td>

								{/* Status */}
								<td className="px-6 py-4">
									<StatusToggle
										checked={listing.isBookable}
										onToggle={() => onAction('toggleBookable', listing.id)}
										disabled={
											actionLoading ||
											(!listing.isBookable && !listing.primaryImageThumbnail)
										}
										disabledReason={
											!listing.isBookable && !listing.primaryImageThumbnail
												? 'Add at least one image before activating this listing.'
												: undefined
										}
									/>
								</td>

								{/* Actions */}
								<td className="px-6 py-4">
									<ListingActionsMenu
										listing={listing}
										onAction={onAction}
										disabled={actionLoading}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default ListingsTable;
