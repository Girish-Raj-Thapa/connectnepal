interface ListingStatusBadgeProps {
    isBookable: boolean;
}

const ListingStatusBadge = ({ isBookable }: ListingStatusBadgeProps) => (
	<span
		className={`px-2 py-1 rounded text-xs font-bold ${
			isBookable ? 'bg-green-100 text-green-700' : 'bg-surface-muted text-ink-secondary'
		}`}
	>
		{isBookable ? 'Active' : 'Inactive'}
	</span>
);

export default ListingStatusBadge;
