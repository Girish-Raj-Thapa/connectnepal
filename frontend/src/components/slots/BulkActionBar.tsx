import { useState } from 'react';
import { Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import notification from '@utils/notifications';
import type { SlotLike } from '@/types/bookings';

interface BulkActionBarProps<T extends SlotLike> {
	selectedIds:      Set<number>;
	allSlots:         T[];
	onClear:          () => void;
	onSlotsChange:    (updater: (prev: T[]) => T[]) => void;
	onActivate:       (slot: T) => Promise<T>;
	onDeactivate:     (slot: T) => Promise<T>;
	/**
	 * Called with all selected slots.  Must return which were hard-deleted
	 * and which were soft-deactivated (had bookings).
	 */
	onDeleteSlots:    (slots: T[]) => Promise<{ deleted: T[]; deactivated: T[] }>;
	/** Copy variant for booked-slot confirm message. Default: 'deactivated' */
	bookedDeleteLabel?: 'deactivated' | 'skipped';
}

const BulkActionBar = <T extends SlotLike>({
	selectedIds,
	allSlots,
	onClear,
	onSlotsChange,
	onActivate,
	onDeactivate,
	onDeleteSlots,
	bookedDeleteLabel = 'deactivated',
}: BulkActionBarProps<T>) => {
	const [loading, setLoading]                     = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const count = selectedIds.size;
	if (count === 0) return null;

	const selectedSlots    = allSlots.filter((s) => selectedIds.has(s.id));
	const withBookings     = selectedSlots.filter((s) => s.availableCapacity < s.capacity);
	const withoutBookings  = selectedSlots.filter((s) => s.availableCapacity === s.capacity);

	const handleActivate = async () => {
		try {
			setLoading(true);
			const results = await Promise.all(selectedSlots.map((s) => onActivate(s)));
			onSlotsChange((prev) => {
				const map = new Map(results.map((r) => [r.id, r]));
				return prev.map((s) => map.get(s.id) ?? s);
			});
			notification.success(`${count} slot(s) activated.`);
			onClear();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to activate slots');
		} finally {
			setLoading(false);
		}
	};

	const handleDeactivate = async () => {
		try {
			setLoading(true);
			const results = await Promise.all(selectedSlots.map((s) => onDeactivate(s)));
			onSlotsChange((prev) => {
				const map = new Map(results.map((r) => [r.id, r]));
				return prev.map((s) => map.get(s.id) ?? s);
			});
			notification.success(`${count} slot(s) deactivated.`);
			onClear();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to deactivate slots');
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		try {
			setLoading(true);
			const { deleted, deactivated } = await onDeleteSlots(selectedSlots);
			const deletedIds      = new Set(deleted.map((s) => s.id));
			const deactivatedMap  = new Map(deactivated.map((s) => [s.id, s]));

			onSlotsChange((prev) => {
				const filtered = prev.filter((s) => !deletedIds.has(s.id));
				return filtered.map((s) => deactivatedMap.get(s.id) ?? s);
			});

			const parts: string[] = [];
			if (deleted.length > 0)     parts.push(`${deleted.length} deleted`);
			if (deactivated.length > 0) parts.push(`${deactivated.length} ${bookedDeleteLabel} (had bookings)`);
			notification.success(parts.join(', ') + '.');
			onClear();
			setShowDeleteConfirm(false);
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to delete slots');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
			<div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
				{showDeleteConfirm ? (
					<>
						<span className="text-sm">
							{withoutBookings.length > 0 && (
								<>
									<span className="text-white font-semibold">{withoutBookings.length}</span>
									<span className="text-gray-300"> will be deleted</span>
								</>
							)}
							{withBookings.length > 0 && withoutBookings.length > 0 && (
								<span className="text-gray-400"> · </span>
							)}
							{withBookings.length > 0 && (
								<>
									<span className="text-amber-400 font-semibold">{withBookings.length}</span>
									<span className="text-gray-300">
										{' '}have bookings →{' '}
										{bookedDeleteLabel === 'skipped' ? 'skipped' : 'deactivated'}
									</span>
								</>
							)}
							{withoutBookings.length === 0 && bookedDeleteLabel === 'skipped' && (
								<span className="text-amber-400">All selected slots have bookings. Deactivate instead.</span>
							)}
						</span>
						<div className="flex gap-2">
							{(withoutBookings.length > 0 || bookedDeleteLabel === 'deactivated') && (
								<button
									onClick={() => void handleDelete()}
									disabled={loading}
									className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg
										hover:bg-red-700 disabled:opacity-50 transition-colors"
								>
									{loading ? 'Processing…' : 'Confirm'}
								</button>
							)}
							<button
								onClick={() => setShowDeleteConfirm(false)}
								disabled={loading}
								className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-200 rounded-lg
									hover:bg-gray-600 disabled:opacity-50 transition-colors"
							>
								Cancel
							</button>
						</div>
					</>
				) : (
					<>
						<span className="text-sm font-medium text-gray-200">{count} selected</span>
						<div className="flex items-center gap-2">
							<button
								onClick={() => void handleActivate()}
								disabled={loading}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
									bg-emerald-600 text-white rounded-lg hover:bg-emerald-700
									disabled:opacity-50 transition-colors"
							>
								<ToggleRight className="w-3.5 h-3.5" />
								Activate
							</button>
							<button
								onClick={() => void handleDeactivate()}
								disabled={loading}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
									bg-gray-600 text-white rounded-lg hover:bg-gray-500
									disabled:opacity-50 transition-colors"
							>
								<ToggleLeft className="w-3.5 h-3.5" />
								Deactivate
							</button>
							<button
								onClick={() => setShowDeleteConfirm(true)}
								disabled={loading}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
									bg-red-600 text-white rounded-lg hover:bg-red-700
									disabled:opacity-50 transition-colors"
							>
								<Trash2 className="w-3.5 h-3.5" />
								Delete
							</button>
						</div>
						<button
							onClick={onClear}
							disabled={loading}
							className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
							title="Clear selection"
						>
							<X className="w-3.5 h-3.5 text-gray-400" />
						</button>
					</>
				)}
			</div>
		</div>
	);
};

export default BulkActionBar;
