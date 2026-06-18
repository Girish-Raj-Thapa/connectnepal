import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X, Plus, CalendarDays, Ban } from 'lucide-react';
import type { SlotLike } from '@/types/bookings';

interface SlotFlyoutPanelProps<T extends SlotLike> {
	isOpen:    boolean;
	onClose:   () => void;
	date:      string;    // "YYYY-MM-DD"
	slots:     T[];
	onSlotsChange: (updatedSlots: T[]) => void;
	/** When true, the date has a "closed" exception — hides Add Slot and shows a notice */
	isClosed?: boolean;
	/** Panel heading. Default: 'Slots' */
	title?:   string;
	/** Empty state message. Default: 'No slots on this date' */
	emptyMessage?: string;
	/**
	 * Renders the "add slot" form.
	 * Called with onCreated (add the new slot) and onCancel (hide the form).
	 */
	renderAddForm: (
		onCreated: (slot: T) => void,
		onCancel:  () => void,
	) => React.ReactNode;
	/**
	 * Renders a single slot card.
	 * onUpdate receives the patched slot; onDelete receives slotId, optional
	 * deactivated flag, and optional replacement slot (for soft deletes).
	 */
	renderSlotCard: (
		slot:     T,
		onUpdate: (updated: T) => void,
		onDelete: (slotId: number, deactivated?: boolean, updatedSlot?: T) => void,
	) => React.ReactNode;
}

const SlotFlyoutPanel = <T extends SlotLike>({
	isOpen,
	onClose,
	date,
	slots,
	onSlotsChange,
	isClosed     = false,
	title        = 'Slots',
	emptyMessage = 'No slots on this date',
	renderAddForm,
	renderSlotCard,
}: SlotFlyoutPanelProps<T>) => {
	const [showAddForm, setShowAddForm] = useState(false);

	const displayDate = date ? format(parseISO(date), 'EEEE, MMM d, yyyy') : '';

	const handleCreated = (slot: T) => {
		onSlotsChange([slot, ...slots]);
		setShowAddForm(false);
	};

	const handleUpdate = (updated: T) => {
		onSlotsChange(slots.map((s) => (s.id === updated.id ? updated : s)));
	};

	const handleDelete = (slotId: number, deactivated?: boolean, updatedSlot?: T) => {
		if (deactivated && updatedSlot) {
			onSlotsChange(slots.map((s) => (s.id === slotId ? updatedSlot : s)));
		} else {
			onSlotsChange(slots.filter((s) => s.id !== slotId));
		}
	};

	return (
		<>
			{isOpen && (
				<div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
			)}
			<div
				className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-surface shadow-2xl
					flex flex-col transform transition-transform duration-300 ease-in-out
					${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
			>
				{/* Header */}
				<div className="flex items-start justify-between px-5 py-4 border-b border-line-muted shrink-0">
					<div>
						<div className="flex items-center gap-2">
							<CalendarDays className="w-4 h-4 text-teal-600" />
							<h3 className="text-base font-bold text-ink">{title}</h3>
						</div>
						{date && <p className="text-xs text-ink-muted mt-0.5">{displayDate}</p>}
					</div>
					<div className="flex items-center gap-2">
						{!showAddForm && !isClosed && (
							<button
								onClick={() => setShowAddForm(true)}
								className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
									bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
							>
								<Plus className="w-3.5 h-3.5" />
								Add Slot
							</button>
						)}
						<button
							onClick={onClose}
							className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"
						>
							<X className="w-4 h-4 text-ink-muted" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
					{isClosed && (
						<div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
							<Ban className="w-4 h-4 text-red-500 shrink-0" />
							<p className="text-xs font-medium text-red-700">
								This date is closed by an exception. Remove the exception to re-enable slots.
							</p>
						</div>
					)}
					{showAddForm && !isClosed && renderAddForm(handleCreated, () => setShowAddForm(false))}

					{slots.length === 0 && !showAddForm ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<CalendarDays className="w-8 h-8 text-line mb-2" />
							<p className="text-sm text-ink-muted font-medium">{emptyMessage}</p>
							<p className="text-xs text-ink-muted mt-1">Click "Add Slot" to create one.</p>
						</div>
					) : (
						slots.map((slot) =>
							renderSlotCard(slot, handleUpdate, handleDelete),
						)
					)}
				</div>
			</div>
		</>
	);
};

export default SlotFlyoutPanel;
