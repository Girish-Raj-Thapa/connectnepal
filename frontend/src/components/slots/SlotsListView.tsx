import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Pencil } from 'lucide-react';
import Checkbox from '@components/form/Checkbox';
import MonthGroupHeader from '@components/slots/shared/MonthGroupHeader';
import type { SlotLike } from '@/types/bookings';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMonthYear = (d: string) => format(parseISO(d), 'MMMM yyyy');

// ── Types ─────────────────────────────────────────────────────────────────────

interface CapacityDisplay {
	available:    number;
	total:        number;
	showOverride?: boolean;
}

interface MonthGroup<T> {
	key:   string;  // "YYYY-MM"
	label: string;  // "April 2026"
	slots: T[];
}

// ── Group by month ────────────────────────────────────────────────────────────

const groupByMonth = <T extends SlotLike>(slots: T[]): MonthGroup<T>[] => {
	const grouped = new Map<string, T[]>();
	for (const slot of slots) {
		const key = slot.startDate.slice(0, 7);
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key)!.push(slot);
	}
	return Array.from(grouped.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, grpSlots]) => ({
			key,
			label: fmtMonthYear(grpSlots[0].startDate),
			slots: grpSlots.sort((a, b) => a.startDate.localeCompare(b.startDate)),
		}));
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface SlotsListViewProps<T extends SlotLike> {
	slots:           T[];
	selectedIds:     Set<number>;
	onToggleSelect:  (id: number) => void;
	onToggleAll:     (ids: number[], selected: boolean) => void;
	onOpenFlyout:    (date: string) => void;
	/** Renders the date/time cell(s) for each slot row. */
	renderDateCell:  (slot: T) => React.ReactNode;
	/** Override the default capacity bar display (e.g. to apply exception overrides). */
	getCapacityDisplay?: (slot: T) => CapacityDisplay;
	/** Dates with a "closed" exception — shown as Closed instead of Active */
	closedDates?: Set<string>;
}

// ── Month section ─────────────────────────────────────────────────────────────

interface MonthSectionProps<T extends SlotLike> {
	group:              MonthGroup<T>;
	selectedIds:        Set<number>;
	onToggleSelect:     (id: number) => void;
	onToggleAll:        (ids: number[], selected: boolean) => void;
	onOpenFlyout:       (date: string) => void;
	renderDateCell:     (slot: T) => React.ReactNode;
	getCapacityDisplay: (slot: T) => CapacityDisplay;
	closedDates:        Set<string>;
	defaultOpen:        boolean;
}

const MonthSection = <T extends SlotLike>({
	group,
	selectedIds,
	onToggleSelect,
	onToggleAll,
	onOpenFlyout,
	renderDateCell,
	getCapacityDisplay,
	closedDates,
	defaultOpen,
}: MonthSectionProps<T>) => {
	const [open, setOpen] = useState(defaultOpen);

	const ids          = group.slots.map((s) => s.id);
	const allSelected  = ids.every((id) => selectedIds.has(id));
	const someSelected = ids.some((id) => selectedIds.has(id));

	return (
		<div className="bg-surface border border-line rounded-xl overflow-hidden">
			<MonthGroupHeader
				open={open}
				label={group.label}
				count={group.slots.length}
				allSelected={allSelected}
				someSelected={someSelected}
				onToggle={() => setOpen((v) => !v)}
				onToggleAll={() => onToggleAll(ids, !allSelected)}
			/>
			{open && (
				<div className="divide-y divide-line-muted">
					{group.slots.map((slot) => {
						const isSelected   = selectedIds.has(slot.id);
						const { available, total, showOverride } = getCapacityDisplay(slot);
						const booked          = total - available;
						const isFullyBooked   = available === 0;
						const hasFewLeft      = available > 0 && available <= 3;

						return (
							<div
								key={slot.id}
								className={`flex items-center gap-3 px-4 py-3 transition-colors ${
									isSelected ? 'bg-teal-50' : 'hover:bg-surface-muted'
								}`}
							>
								<Checkbox
									checked={isSelected}
									onChange={() => onToggleSelect(slot.id)}
									className="shrink-0"
								/>

								{/* Injected date cell(s) */}
								{renderDateCell(slot)}

								{/* Capacity / availability */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<div className="w-16 bg-surface-muted rounded-full h-1.5 overflow-hidden shrink-0">
											<div
												className={`h-full rounded-full ${
													isFullyBooked
														? 'bg-red-500'
														: hasFewLeft
															? 'bg-amber-400'
															: 'bg-emerald-500'
												}`}
												style={{ width: `${Math.min(100, (booked / total) * 100)}%` }}
											/>
										</div>
										<span className={`text-xs font-medium ${
											isFullyBooked
												? 'text-red-600'
												: hasFewLeft
													? 'text-amber-600'
													: 'text-emerald-700'
										}`}>
											{available} / {total}
										</span>
										{showOverride && (
											<span className="text-xs text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
												Overridden
											</span>
										)}
									</div>
								</div>

								{/* Status */}
								{(() => {
									const isClosed = closedDates.has(slot.startDate);
									return (
										<span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
											isClosed
												? 'bg-red-50 text-red-600'
												: slot.isActive
													? 'bg-emerald-50 text-emerald-700'
													: 'bg-surface-muted text-ink-muted'
										}`}>
											{isClosed ? 'Closed' : slot.isActive ? 'Active' : 'Inactive'}
										</span>
									);
								})()}

								{/* Flyout edit shortcut */}
								<button
									onClick={() => onOpenFlyout(slot.startDate)}
									className="shrink-0 p-1.5 text-ink-muted hover:text-teal-600 hover:bg-teal-50
										rounded-lg transition-colors"
									title="Edit in flyout"
								>
									<Pencil className="w-3.5 h-3.5" />
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

// ── Main list view ────────────────────────────────────────────────────────────

const SlotsListView = <T extends SlotLike>({
	slots,
	selectedIds,
	onToggleSelect,
	onToggleAll,
	onOpenFlyout,
	renderDateCell,
	getCapacityDisplay,
	closedDates,
}: SlotsListViewProps<T>) => {
	const groups = useMemo(() => groupByMonth(slots), [slots]);

	const defaultCapacity = (slot: T): CapacityDisplay => ({
		available: slot.availableCapacity,
		total:     slot.capacity,
	});

	const capacityFn  = getCapacityDisplay ?? defaultCapacity;
	const closedDatesSet = closedDates ?? new Set<string>();

	if (slots.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<CalendarDays className="w-10 h-10 text-line mb-3" />
				<p className="text-ink-muted font-medium">No slots yet</p>
				<p className="text-ink-muted text-sm mt-1">
					Add a schedule to auto-generate slots, or add them manually.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{groups.map((group, idx) => (
				<MonthSection
					key={group.key}
					group={group}
					selectedIds={selectedIds}
					onToggleSelect={onToggleSelect}
					onToggleAll={onToggleAll}
					onOpenFlyout={onOpenFlyout}
					renderDateCell={renderDateCell}
					getCapacityDisplay={capacityFn}
					closedDates={closedDatesSet}
					defaultOpen={idx < 2}
				/>
			))}
		</div>
	);
};

export default SlotsListView;
