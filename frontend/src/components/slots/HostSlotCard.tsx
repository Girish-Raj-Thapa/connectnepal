import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, Check } from 'lucide-react';
import notification from '@utils/notifications';
import slotsService from '@services/slots.service';
import type { ActivitySlot } from '@/types/bookings';
import type { DurationType } from '@/types/listings';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (t: string | null): string => {
	if (!t) return '—';
	const [h, m] = t.split(':').map(Number);
	const d = new Date();
	d.setHours(h, m, 0, 0);
	return format(d, 'h:mm a');
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface HostSlotCardProps {
	slot:         ActivitySlot;
	durationType: DurationType;
	maxCapacity:  number;
	listingId:    number;
	onUpdate:     (updated: ActivitySlot) => void;
	onDelete:     (slotId: number, deactivated: boolean, updatedSlot?: ActivitySlot) => void;
	/** When true, the date has a closed exception — show Closed badge, hide Edit/Delete */
	isClosed?:    boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const HostSlotCard = ({
	slot,
	durationType,
	maxCapacity,
	listingId,
	onUpdate,
	onDelete,
	isClosed = false,
}: HostSlotCardProps) => {
	const [editing, setEditing]             = useState(false);
	const [editCap, setEditCap]             = useState(slot.capacity);
	const [editActive, setEditActive]       = useState(slot.isActive);
	const [saving, setSaving]               = useState(false);
	const [deleting, setDeleting]           = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const booked       = slot.capacity - slot.availableCapacity;
	const isFullyBooked = slot.availableCapacity === 0;
	const hasFewLeft    = slot.availableCapacity > 0 && slot.availableCapacity <= 3;

	const startEdit = () => {
		setEditCap(slot.capacity);
		setEditActive(slot.isActive);
		setEditing(true);
	};

	const cancelEdit = () => setEditing(false);

	const saveEdit = async () => {
		try {
			setSaving(true);
			const updated = await slotsService.updateSlot(listingId, slot.id, {
				capacity: editCap,
				isActive: editActive,
			});
			onUpdate(updated);
			setEditing(false);
			notification.success('Slot updated.');
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to update slot');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			setDeleting(true);
			const result = await slotsService.deleteSlot(listingId, slot.id);
			onDelete(slot.id, result.deactivated, result.slot);
			if (result.deactivated) {
				notification.success('Slot deactivated (has active bookings).');
			} else {
				notification.success('Slot deleted.');
			}
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to delete slot');
		} finally {
			setDeleting(false);
			setConfirmDelete(false);
		}
	};

	return (
		<div className={`rounded-xl border p-3.5 transition-colors ${
			slot.isActive
				? 'bg-surface border-line'
				: 'bg-surface-muted border-line opacity-70'
		}`}>
			{/* Top row: time (hourly) + status badge */}
			<div className="flex items-center justify-between mb-2">
				<div>
					{durationType === 'hourly' ? (
						<span className="text-sm font-semibold text-ink">
							{fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
						</span>
					) : (
						<span className="text-sm font-semibold text-ink">
							{durationType === 'multi_day' && slot.endDate
								? `${format(parseISO(slot.startDate), 'MMM d')} – ${format(parseISO(slot.endDate), 'MMM d, yyyy')}`
								: 'Full Day'
							}
						</span>
					)}
				</div>
				{editing ? (
					<button
						type="button"
						onClick={() => setEditActive((v) => !v)}
						className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
							editActive
								? 'bg-emerald-50 text-emerald-700 border-emerald-200'
								: 'bg-surface-muted text-ink-muted border-line hover:border-line'
						}`}
					>
						{editActive ? 'Active' : 'Inactive'}
					</button>
				) : isClosed ? (
					<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
						Closed
					</span>
				) : (
					<span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
						slot.isActive
							? 'bg-emerald-50 text-emerald-700'
							: 'bg-surface-muted text-ink-muted'
					}`}>
						{slot.isActive ? 'Active' : 'Inactive'}
					</span>
				)}
			</div>

			{/* Capacity + availability */}
			<div className="mb-2.5">
				{editing ? (
					<div className="flex items-center gap-2">
						<label className="text-xs text-ink-muted shrink-0">Capacity:</label>
						<input
							type="number"
							value={editCap}
							min={booked > 0 ? booked : 1}
							max={maxCapacity}
							onChange={(e) => setEditCap(Number(e.target.value))}
							className="w-20 px-2 py-1 border border-line rounded-lg text-sm
								focus:outline-none focus:ring-2 focus:ring-teal-500"
						/>
					</div>
				) : (
					<div className="flex items-center gap-3">
						{/* Availability bar */}
						<div className="flex-1 bg-surface-muted rounded-full h-1.5 overflow-hidden">
							<div
								className={`h-full rounded-full transition-all ${
									isFullyBooked ? 'bg-red-500' : hasFewLeft ? 'bg-amber-400' : 'bg-emerald-500'
								}`}
								style={{
									width: `${Math.min(100, (booked / slot.capacity) * 100)}%`,
								}}
							/>
						</div>
						<span className={`text-xs font-medium shrink-0 ${
							isFullyBooked ? 'text-red-600' : hasFewLeft ? 'text-amber-600' : 'text-emerald-700'
						}`}>
							{slot.availableCapacity} / {slot.capacity} left
						</span>
					</div>
				)}
				{booked > 0 && !editing && (
					<p className="text-xs text-ink-muted mt-0.5">{booked} booked</p>
				)}
			</div>

			{/* Actions — hidden when date is closed by an exception */}
			{isClosed ? null : confirmDelete ? (
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs text-red-600 font-medium flex-1">
						{booked > 0
							? 'Has bookings — will deactivate instead of delete.'
							: 'Permanently delete this slot?'}
					</span>
					<button
						onClick={() => void handleDelete()}
						disabled={deleting}
						className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg
							hover:bg-red-700 disabled:opacity-50 transition-colors"
					>
						{deleting ? 'Deleting…' : booked > 0 ? 'Deactivate' : 'Delete'}
					</button>
					<button
						onClick={() => setConfirmDelete(false)}
						disabled={deleting}
						className="px-2.5 py-1 text-xs font-medium border border-line text-ink-muted
							rounded-lg hover:bg-surface-muted disabled:opacity-50 transition-colors"
					>
						Cancel
					</button>
				</div>
			) : editing ? (
				<div className="flex gap-2">
					<button
						onClick={() => void saveEdit()}
						disabled={saving}
						className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold
							bg-teal-600 text-white rounded-lg hover:bg-teal-700
							disabled:opacity-50 transition-colors"
					>
						<Check className="w-3 h-3" />
						{saving ? 'Saving…' : 'Save'}
					</button>
					<button
						onClick={cancelEdit}
						disabled={saving}
						className="px-2.5 py-1 text-xs font-medium border border-line text-ink-muted
							rounded-lg hover:bg-surface-muted disabled:opacity-50 transition-colors"
					>
						Cancel
					</button>
				</div>
			) : (
				<div className="flex gap-2">
					<button
						onClick={startEdit}
						className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium
							border border-line text-ink-secondary rounded-lg hover:bg-surface-muted transition-colors"
					>
						<Pencil className="w-3 h-3" />
						Edit
					</button>
					<button
						onClick={() => setConfirmDelete(true)}
						className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium
							border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
					>
						<Trash2 className="w-3 h-3" />
						Delete
					</button>
				</div>
			)}
		</div>
	);
};

export default HostSlotCard;
