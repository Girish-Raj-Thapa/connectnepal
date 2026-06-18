import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, Check } from 'lucide-react';
import InputField from '@components/form/InputField';
import StatusToggle from '@components/form/StatusToggle';
import notification from '@utils/notifications';
import packagesService from '@services/packages.service';
import type { PackageSlot, PackageDetail, PackageSlotException } from '@/types/packages';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PackageSlotCardProps {
	slot:       PackageSlot;
	pkg:        PackageDetail;
	exceptions: PackageSlotException[];
	onUpdate:   (updated: PackageSlot) => void;
	onRemove:   (slotId: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const PackageSlotCard = ({ slot, pkg, exceptions, onUpdate, onRemove }: PackageSlotCardProps) => {
	const [editing, setEditing]             = useState(false);
	const [editEndDate, setEditEndDate]     = useState(slot.endDate);
	const [editCap, setEditCap]             = useState(slot.capacity);
	const [editActive, setEditActive]       = useState(slot.isActive);
	const [saving, setSaving]               = useState(false);
	const [deleting, setDeleting]           = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	// Check for exception override on this date
	const exception        = exceptions.find((ex) => ex.date === slot.startDate);
	const displayCapacity  = exception?.capacityOverride ?? slot.capacity;
	const displayAvailable = exception
		? Math.max(0, displayCapacity - (slot.capacity - slot.availableCapacity))
		: slot.availableCapacity;
	const booked       = slot.capacity - slot.availableCapacity;
	const isFullyBooked = displayAvailable === 0;
	const hasFewLeft    = displayAvailable > 0 && displayAvailable <= 3;

	const startEdit = () => {
		setEditEndDate(slot.endDate);
		setEditCap(slot.capacity);
		setEditActive(slot.isActive);
		setEditing(true);
	};

	const cancelEdit = () => setEditing(false);

	const saveEdit = async () => {
		try {
			setSaving(true);
			const updated = await packagesService.updatePackageSlot(pkg.id, slot.id, {
				endDate: editEndDate,
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
			await packagesService.deletePackageSlot(pkg.id, slot.id);
			onRemove(slot.id);
			notification.success('Slot deleted.');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to delete slot';
			if (msg.toLowerCase().includes('active_bookings') || msg.toLowerCase().includes('active bookings')) {
				notification.error('This slot has active bookings. Deactivate it instead.');
			} else {
				notification.error(msg);
			}
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
			{/* Top row: date range + status badge */}
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm font-semibold text-ink">
					{format(parseISO(slot.startDate), 'MMM d')} – {format(parseISO(slot.endDate), 'MMM d, yyyy')}
				</span>
				{exception?.isClosed ? (
					<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
						Closed
					</span>
				) : editing ? (
					<StatusToggle
						checked={editActive}
						onToggle={() => setEditActive((v) => !v)}
					/>
				) : (
					<StatusToggle
						checked={slot.isActive}
						onToggle={() => {}}
						disabled
					/>
				)}
			</div>

			{/* End date edit field (only while editing) */}
			{editing && (
				<div className="mb-2.5">
					<InputField
						type="date"
						label="Return Date"
						value={editEndDate}
						min={slot.startDate}
						onChange={(e) => setEditEndDate(e.target.value)}
					/>
				</div>
			)}

			{/* Capacity + availability bar */}
			<div className="mb-2.5">
				{editing ? (
					<InputField
						type="number"
						label="Capacity"
						value={editCap}
						min={booked > 0 ? booked : 1}
						max={pkg.maxGroupSize}
						onChange={(e) => setEditCap(Number(e.target.value))}
					/>
				) : (
					<div className="flex items-center gap-3">
						<div className="flex-1 bg-surface-muted rounded-full h-1.5 overflow-hidden">
							<div
								className={`h-full rounded-full transition-all ${
									isFullyBooked ? 'bg-red-500' : hasFewLeft ? 'bg-amber-400' : 'bg-emerald-500'
								}`}
								style={{ width: `${Math.min(100, (booked / displayCapacity) * 100)}%` }}
							/>
						</div>
						<span className={`text-xs font-medium shrink-0 ${
							isFullyBooked ? 'text-red-600' : hasFewLeft ? 'text-amber-600' : 'text-emerald-700'
						}`}>
							{displayAvailable} / {displayCapacity} left
						</span>
						{exception?.capacityOverride && (
							<span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
								Overridden
							</span>
						)}
					</div>
				)}
				{booked > 0 && !editing && (
					<p className="text-xs text-ink-muted mt-0.5">{booked} booked</p>
				)}
			</div>

			{/* Actions — hidden when date is closed by an exception */}
			{exception?.isClosed ? null : confirmDelete ? (
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs text-red-600 font-medium flex-1">
						{booked > 0
							? 'Has bookings — cannot delete. Deactivate instead.'
							: 'Permanently delete this slot?'}
					</span>
					{booked === 0 && (
						<button
							onClick={() => void handleDelete()}
							disabled={deleting}
							className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg
								hover:bg-red-700 disabled:opacity-50 transition-colors"
						>
							{deleting ? 'Deleting…' : 'Delete'}
						</button>
					)}
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

export default PackageSlotCard;
