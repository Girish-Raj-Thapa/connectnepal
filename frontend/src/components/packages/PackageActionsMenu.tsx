import { Pencil, Trash2, CalendarDays } from 'lucide-react';
import TableActionIcon from '@components/common/TableActionIcon';
import type { PackageSummary } from '@/types/packages';
import { ROUTES } from '@/constants/routes';

interface PackageActionsMenuProps {
	pkg: PackageSummary;
	onDelete: (pkg: PackageSummary) => void;
	disabled?: boolean;
}

const PackageActionsMenu = ({
	pkg,
	onDelete,
	disabled = false,
}: PackageActionsMenuProps) => {
	return (
		<div className="flex items-center justify-start gap-2">
			<TableActionIcon
				label="Manage Slots"
				disabled={disabled}
				to={ROUTES.HOST_PACKAGE_SLOTS.replace(':id', String(pkg.id))}
				icon={<CalendarDays className="w-4 h-4" />}
			/>

			<TableActionIcon
				label="Edit"
				disabled={disabled}
				to={`/host/packages/${pkg.id}/edit`}
				icon={<Pencil className="w-4 h-4" />}
			/>

			<TableActionIcon
				label="Delete"
				onClick={() => onDelete(pkg)}
				disabled={disabled}
				variant="danger"
				icon={<Trash2 className="w-4 h-4" />}
			/>
		</div>
	);
};

export default PackageActionsMenu;
