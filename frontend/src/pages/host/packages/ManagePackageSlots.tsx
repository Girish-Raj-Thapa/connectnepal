import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useParams, Link } from 'react-router-dom';
import {
	ArrowLeft,
	CalendarDays,
	List,
	RefreshCw,
	Settings2,
	AlertTriangle,
	Plus,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import Button from '@components/button/Button';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import packagesService from '@services/packages.service';
import SlotsCalendarView from '@components/slots/SlotsCalendarView';
import SlotsListView from '@components/slots/SlotsListView';
import SlotFlyoutPanel from '@components/slots/SlotFlyoutPanel';
import BulkActionBar from '@components/slots/BulkActionBar';
import SchedulesManager from '@components/slots/SchedulesManager';
import ExceptionsManager from '@components/slots/ExceptionsManager';
import PackageSlotCard from '@components/slots/PackageSlotCard';
import PackageSlotAddForm from '@components/slots/PackageSlotAddForm';
import type { PackageDetail, PackageSlot, PackageSchedule, PackageSlotException } from '@/types/packages';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => format(parseISO(d), 'MMM d, yyyy');

// ── Tab type ──────────────────────────────────────────────────────────────────

type TabId = 'slots' | 'schedules' | 'exceptions';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
	{ id: 'slots',      label: 'Slots',                  icon: <CalendarDays className="w-4 h-4" /> },
	{ id: 'schedules',  label: 'Auto-Generation Rules',  icon: <Settings2 className="w-4 h-4" /> },
	{ id: 'exceptions', label: 'Date Exceptions',         icon: <AlertTriangle className="w-4 h-4" /> },
];


// ── ManagePackageSlots ────────────────────────────────────────────────────────

const ManagePackageSlots = () => {
	const { id } = useParams<{ id: string }>();
	const packageId = Number(id);

	// Package detail (for breadcrumb / title)
	const [pkg, setPkg] = useState<PackageDetail | null>(null);
	const [pkgLoading, setPkgLoading] = useState(true);
	const [pkgError, setPkgError] = useState('');

	// Data
	const [slots, setSlots] = useState<PackageSlot[]>([]);
	const [slotsLoading, setSlotsLoading] = useState(true);
	const [schedules, setSchedules] = useState<PackageSchedule[]>([]);
	const [schedulesLoading, setSchedulesLoading] = useState(true);
	const [exceptions, setExceptions] = useState<PackageSlotException[]>([]);
	const [exceptionsLoading, setExceptionsLoading] = useState(true);
	const [generatingNow, setGeneratingNow] = useState(false);

	// UI state
	const [activeTab, setActiveTab] = useState<TabId>('slots');
	const [slotView, setSlotView] = useState<'calendar' | 'list'>('calendar');
	const [flyoutDate, setFlyoutDate] = useState('');
	const [flyoutOpen, setFlyoutOpen] = useState(false);

	// Bulk selection (list view)
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());


	// Fetchers

	const fetchPackage = useCallback(async () => {
		if (!packageId) return;
		try {
			setPkgLoading(true);
			setPkgError('');
			const data = await packagesService.getPackageById(packageId);
			setPkg(data);
		} catch (err) {
			setPkgError(err instanceof Error ? err.message : 'Failed to load package');
		} finally {
			setPkgLoading(false);
		}
	}, [packageId]);

	const fetchSlots = useCallback(async () => {
		if (!packageId) return;
		try {
			setSlotsLoading(true);
			const data = await packagesService.getPackageSlots(packageId);
			setSlots(data || []);
		} catch {
			// non-critical — show empty state
			setSlots([]);
		} finally {
			setSlotsLoading(false);
		}
	}, [packageId]);

	const fetchSchedules = useCallback(async () => {
		if (!packageId) return;
		try {
			setSchedulesLoading(true);
			const data = await packagesService.getPackageSchedules(packageId);
			setSchedules(data || []);
		} catch {
			// non-critical
			setSchedules([]);
		} finally {
			setSchedulesLoading(false);
		}
	}, [packageId]);

	const fetchExceptions = useCallback(async () => {
		if (!packageId) return;
		try {
			setExceptionsLoading(true);
			const data = await packagesService.getPackageExceptions(packageId);
			setExceptions(data || []);
		} catch {
			// non-critical
			setExceptions([]);
		} finally {
			setExceptionsLoading(false);
		}
	}, [packageId]);

	useEffect(() => { void fetchPackage(); }, [fetchPackage]);
	useEffect(() => { void fetchSlots(); }, [fetchSlots]);
	useEffect(() => { void fetchSchedules(); }, [fetchSchedules]);
	useEffect(() => { void fetchExceptions(); }, [fetchExceptions]);


	// Generate slots

	const handleGenerateNow = async () => {
		try {
			setGeneratingNow(true);
			const result = await packagesService.generatePackageSlots(packageId);
			notification.success(`${result.slotsCreated} new slot(s) generated.`);
			void fetchSlots();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to generate slots');
		} finally {
			setGeneratingNow(false);
		}
	};


	// Flyout helpers

	const openFlyout = (date: string) => {
		setFlyoutDate(date);
		setFlyoutOpen(true);
	};

	const closeFlyout = () => setFlyoutOpen(false);

	// Slots departing on the selected date
	const flyoutSlots = useMemo(
		() => (slots || []).filter((s) => s.startDate === flyoutDate),
		[slots, flyoutDate],
	);

	// Dates with an active "closed" exception
	const closedDates = useMemo(
		() => new Set(exceptions.filter((e) => e.isClosed).map((e) => e.date)),
		[exceptions],
	);


	// Bulk selection helpers

	const toggleSelect = (id: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleAll = (ids: number[], selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (selected) {
				ids.forEach((id) => next.add(id));
			} else {
				ids.forEach((id) => next.delete(id));
			}
			return next;
		});
	};

	const clearSelection = () => setSelectedIds(new Set());

	const handleViewChange = (view: 'calendar' | 'list') => {
		setSlotView(view);
		clearSelection();
	};


	// Loading / error guards

	if (pkgLoading) {
		return (
			<DashboardLayout>
				<div className="flex justify-center py-20">
					<Loader text="Loading package..." />
				</div>
			</DashboardLayout>
		);
	}

	if (pkgError || !pkg) {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<p className="text-ink-muted mb-4">{pkgError || 'Package not found.'}</p>
					<Button onClick={() => void fetchPackage()}>Retry</Button>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-sm mb-6">
				<Link
					to={ROUTES.HOST_PACKAGES}
					className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					My Packages
				</Link>
				<span className="text-line">/</span>
				<Link
					to={ROUTES.HOST_EDIT_PACKAGE.replace(':id', String(pkg.id))}
					className="text-ink-muted hover:text-teal-600 transition-colors truncate max-w-xs"
				>
					{pkg.title}
				</Link>
				<span className="text-line">/</span>
				<span className="text-ink font-medium">Manage Slots</span>
			</div>

			{/* Page header */}
			<div className="flex flex-wrap items-start justify-between gap-4 mb-6">
				<div>
					<div className="flex items-center gap-3 mb-1">
						<h1 className="page-heading text-ink">Manage Slots</h1>
						<span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
							{pkg.durationDays}D / {pkg.durationNights}N
						</span>
					</div>
					<p className="text-ink-muted text-sm">{pkg.title}</p>
				</div>
				<Button
					variant="secondary"
					onClick={() => void handleGenerateNow()}
					loading={generatingNow}
					disabled={schedules.length === 0}
					title={schedules.length === 0 ? 'Add a schedule first' : 'Generate slots from schedules now'}
				>
					<span className="flex items-center gap-1.5">
						<RefreshCw className="w-3.5 h-3.5" />
						Generate Slots
					</span>
				</Button>
			</div>

			{/* ── Tabs ── */}
			<div className="border-b border-line mb-6">
				<nav className="flex gap-1 -mb-px overflow-x-auto">
					{TABS.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
								activeTab === tab.id
									? 'border-teal-600 text-teal-600'
									: 'border-transparent text-ink-muted hover:text-ink-secondary hover:border-line'
							}`}
						>
							{tab.icon}
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* ── Tab 1: Slots ── */}
			{activeTab === 'slots' && (
				<div>
					{/* Toolbar */}
					<div className="flex flex-wrap items-center justify-between gap-3 mb-5">
						{/* View toggle */}
						<div className="flex items-center bg-surface-muted rounded-xl p-1 gap-1">
							<button
								onClick={() => handleViewChange('calendar')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
									slotView === 'calendar'
										? 'bg-surface text-ink shadow-sm'
										: 'text-ink-muted hover:text-ink-secondary'
								}`}
							>
								<CalendarDays className="w-4 h-4" />
								Calendar
							</button>
							<button
								onClick={() => handleViewChange('list')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
									slotView === 'list'
										? 'bg-surface text-ink shadow-sm'
										: 'text-ink-muted hover:text-ink-secondary'
								}`}
							>
								<List className="w-4 h-4" />
								List
							</button>
						</div>

						{/* Add slot */}
						<Button
							variant="primary"
							onClick={() => {
								const today = new Date();
								const y = today.getFullYear();
								const m = String(today.getMonth() + 1).padStart(2, '0');
								const d = String(today.getDate()).padStart(2, '0');
								openFlyout(`${y}-${m}-${d}`);
							}}
						>
							<span className="flex items-center gap-1.5">
								<Plus className="w-4 h-4" />
								Add Slot
							</span>
						</Button>
					</div>

					{/* Calendar view */}
					{slotView === 'calendar' && (
						<div className="bg-surface border border-line rounded-2xl overflow-hidden">
							{slotsLoading ? (
								<div className="flex justify-center py-16">
									<Loader text="Loading slots..." />
								</div>
							) : (
								<div className="flex flex-col items-center py-4 px-2">
									<SlotsCalendarView
										slots={slots}
										selectedDate={flyoutDate}
										onSelectDate={openFlyout}
										closedDates={closedDates}
									/>
									{slots.length === 0 && (
										<p className="text-sm text-ink-muted pb-4">
											No slots yet. Add a schedule or click "Add Slot".
										</p>
									)}
								</div>
							)}
						</div>
					)}

					{/* List view */}
					{slotView === 'list' && (
						<div>
							{slotsLoading ? (
								<div className="flex justify-center py-16">
									<Loader text="Loading slots..." />
								</div>
							) : (
								<SlotsListView
									slots={slots}
									selectedIds={selectedIds}
									onToggleSelect={toggleSelect}
									onToggleAll={toggleAll}
									onOpenFlyout={openFlyout}
									closedDates={closedDates}
									renderDateCell={(slot) => (
										<>
											<div className="w-28 shrink-0">
												<p className="text-sm text-ink font-medium">{fmtDate(slot.startDate)}</p>
												<p className="text-xs text-ink-muted">departure</p>
											</div>
											<div className="w-28 shrink-0">
												<p className="text-sm text-ink-secondary">{fmtDate(slot.endDate)}</p>
												<p className="text-xs text-ink-muted">return</p>
											</div>
										</>
									)}
									getCapacityDisplay={(slot) => {
										const exception = exceptions.find((ex) => ex.date === slot.startDate);
										const displayCapacity = exception?.capacityOverride ?? slot.capacity;
										const booked = slot.capacity - slot.availableCapacity;
										const displayAvailable = exception
											? Math.max(0, displayCapacity - booked)
											: slot.availableCapacity;
										return {
											available: displayAvailable,
											total: displayCapacity,
											showOverride: !!exception?.capacityOverride,
										};
									}}
								/>
							)}
						</div>
					)}
				</div>
			)}

			{/* ── Tab 2: Auto-Generation Rules ── */}
			{activeTab === 'schedules' && (
				<SchedulesManager
					resource={{ id: pkg.id, maxGroupSize: pkg.maxGroupSize }}
					schedules={schedules}
					loading={schedulesLoading}
					generatingNow={generatingNow}
					onSchedulesChange={(updater) => setSchedules((prev) => updater(prev))}
					onGenerateNow={() => void handleGenerateNow()}
					onCreate={(rid, payload) => packagesService.createPackageSchedule(rid, payload)}
					onUpdate={(rid, id, payload) => packagesService.updatePackageSchedule(rid, id, payload)}
					onDelete={(rid, id) => packagesService.deletePackageSchedule(rid, id)}
					unitLabel="spots"
					daysLabel="Departure Days"
					description="Recurring departure patterns that auto-fill slots nightly."
				/>
			)}

			{/* ── Tab 3: Date Exceptions ── */}
			{activeTab === 'exceptions' && (
				<ExceptionsManager
					resource={{ id: pkg.id, maxGroupSize: pkg.maxGroupSize }}
					exceptions={exceptions}
					loading={exceptionsLoading}
					onExceptionsChange={(updater) => setExceptions((prev) => updater(prev))}
					onCreate={(rid, payload) => packagesService.createPackageException(rid, payload)}
					onUpdate={(rid, id, payload) => packagesService.updatePackageException(rid, id, payload)}
					onDelete={(rid, id) => packagesService.deletePackageException(rid, id)}
					unitLabel="spots"
					dateLabel="departure dates"
				/>
			)}

			{/* ── Slot Flyout Panel ── */}
			<SlotFlyoutPanel
				isOpen={flyoutOpen}
				onClose={closeFlyout}
				date={flyoutDate}
				slots={flyoutSlots}
				isClosed={closedDates.has(flyoutDate)}
				title="Departure Slots"
				emptyMessage="No departures on this date"
				onSlotsChange={(updatedSlots) => {
					setSlots((prev) => {
						// Remove all slots departing on this date, then prepend updated ones
						const others = prev.filter((s) => s.startDate !== flyoutDate);
						return [...updatedSlots, ...others].sort((a, b) =>
							a.startDate.localeCompare(b.startDate),
						);
					});
				}}
				renderAddForm={(onCreated, onCancel) => (
					<PackageSlotAddForm
						date={flyoutDate}
						pkg={pkg}
						onCreated={onCreated}
						onCancel={onCancel}
					/>
				)}
				renderSlotCard={(slot, onUpdate, onRemove) => (
					<PackageSlotCard
						key={slot.id}
						slot={slot}
						pkg={pkg}
						exceptions={exceptions}
						onUpdate={onUpdate}
						onRemove={(slotId) => onRemove(slotId)}
					/>
				)}
			/>

			{/* ── Bulk action bar (list view only) ── */}
			{slotView === 'list' && activeTab === 'slots' && (
				<BulkActionBar
					selectedIds={selectedIds}
					allSlots={slots}
					onClear={clearSelection}
					onSlotsChange={(updater) => setSlots((prev) => updater(prev))}
					onActivate={(slot) => packagesService.updatePackageSlot(pkg.id, slot.id, { isActive: true })}
					onDeactivate={(slot) => packagesService.updatePackageSlot(pkg.id, slot.id, { isActive: false })}
					onDeleteSlots={async (slotsToDelete) => {
						const deletable = slotsToDelete.filter((s) => s.availableCapacity === s.capacity);
						await Promise.all(deletable.map((s) => packagesService.deletePackageSlot(pkg.id, s.id)));
						return { deleted: deletable, deactivated: [] };
					}}
					bookedDeleteLabel="skipped"
				/>
			)}
		</DashboardLayout>
	);
};

export default ManagePackageSlots;
