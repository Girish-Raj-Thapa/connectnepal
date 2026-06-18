import { Pencil, Trash2, CalendarDays } from 'lucide-react';
import TableActionIcon from '@components/common/TableActionIcon';
import type { MyListing, ListingAction } from '@/types/listings';

interface ListingActionsMenuProps {
	listing: MyListing;
	onAction: (action: ListingAction, listingId: number) => void;
	disabled?: boolean;
}

const ListingActionsMenu = ({
	listing,
	onAction,
	disabled = false,
}: ListingActionsMenuProps) => {
	const { id } = listing;

	const fire = (action: ListingAction) => {
		if (!disabled) {
			onAction(action, id);
		}
	};

	return (
		<div className="flex items-center justify-start gap-2">
			<TableActionIcon
				label="Edit"
				onClick={() => fire('edit')}
				disabled={disabled}
				icon={<Pencil className="w-4 h-4" />}
			/>

			<TableActionIcon
				label="Manage Slots"
				onClick={() => fire('manageSlots')}
				disabled={disabled}
				icon={<CalendarDays className="w-4 h-4" />}
			/>

			<TableActionIcon
				label="Delete"
				onClick={() => fire('delete')}
				disabled={disabled}
				variant="danger"
				icon={<Trash2 className="w-4 h-4" />}
			/>
		</div>
	);
};

export default ListingActionsMenu;
