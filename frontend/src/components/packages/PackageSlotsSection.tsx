import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import Button from '@components/button/Button';
import BookingTravellerStepper from '@components/bookings/BookingTravellerStepper';
import { ROUTES } from '@/constants/routes';
import publicPackagesService from '@/services/publicPackages.service';
import PackageAvailabilityCalendar from '@components/packages/PackageAvailabilityCalendar';
import type { PackageAvailabilityMonth, PublicPackageSlot } from '@/types/packages';

interface PackageSlotsSectionProps {
	packageId: number;
	maxGroupSize: number;
	durationDays: number;
}

const formatDateRange = (startDate: string, endDate: string): string => {
	const start = parseISO(startDate);
	const end = parseISO(endDate);
	return `${format(start, 'MMM d')} -> ${format(end, 'MMM d')}`;
};

const getSlotDurationDays = (startDate: string, endDate: string, fallback: number): number => {
	const start = parseISO(startDate);
	const end = parseISO(endDate);
	const days = differenceInCalendarDays(end, start) + 1;
	return Number.isFinite(days) && days > 0 ? days : fallback;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const getAvailabilityBarPercent = (availableCapacity: number, maxGroupSize: number): number => {
	if (availableCapacity === 0) return 0;
	return Math.max(8, Math.min(100, (availableCapacity / Math.max(1, maxGroupSize)) * 100));
};

const PackageSlotsSection = ({
	packageId,
	maxGroupSize,
	durationDays,
}: PackageSlotsSectionProps) => {
	const navigate = useNavigate();
	const { isAuthenticated, loading: authLoading } = useAuth();

	const now = useMemo(() => new Date(), []);
	const [calendarYear, setCalendarYear] = useState(now.getFullYear());
	const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);

	const [availability, setAvailability] = useState<PackageAvailabilityMonth | null>(null);
	const [slots, setSlots] = useState<PublicPackageSlot[]>([]);
	const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [travellerCount, setTravellerCount] = useState(1);
	const [loadingAvail, setLoadingAvail] = useState(true);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [availabilityError, setAvailabilityError] = useState<string | null>(null);
	const [slotsError, setSlotsError] = useState<string | null>(null);

	const slotsRequestRef = useRef(0);

	useEffect(() => {
		let cancelled = false;

		const fetchAvailability = async () => {
			try {
				setLoadingAvail(true);
				setAvailabilityError(null);
				const data = await publicPackagesService.getPackageAvailability(
					packageId,
					calendarYear,
					calendarMonth,
				);
				if (!cancelled) setAvailability(data);
			} catch (err) {
				if (!cancelled) {
					setAvailabilityError(err instanceof Error ? err.message : 'Failed to load calendar availability.');
				}
			} finally {
				if (!cancelled) setLoadingAvail(false);
			}
		};

		void fetchAvailability();
		return () => {
			cancelled = true;
		};
	}, [packageId, calendarYear, calendarMonth]);

	const selectedSlot = useMemo(
		() => slots.find((slot) => slot.id === selectedSlotId) ?? null,
		[slots, selectedSlotId],
	);

	const selectedSlotIsFull = !!selectedSlot && selectedSlot.availableCapacity === 0;
	const canBook = !!selectedSlot && travellerCount >= 1 && !selectedSlotIsFull && !authLoading;

	const handleMonthChange = (year: number, month: number) => {
		setCalendarYear(year);
		setCalendarMonth(month);
	};

	const handleDateSelect = async (isoDate: string) => {
		const requestId = ++slotsRequestRef.current;

		setSelectedDate(isoDate);
		setSelectedSlotId(null);
		setSlotsError(null);
		setSlots([]);

		try {
			setLoadingSlots(true);
			const slots = await publicPackagesService.getPackageSlots(packageId, {
				dateFrom: isoDate,
				dateTo: isoDate,
			});
			if (requestId !== slotsRequestRef.current) return;
			setSlots(slots.filter((slot) => slot.startDate === isoDate));
		} catch (err) {
			if (requestId !== slotsRequestRef.current) return;
			setSlotsError(err instanceof Error ? err.message : 'Failed to load departures for this date.');
		} finally {
			if (requestId === slotsRequestRef.current) setLoadingSlots(false);
		}
	};

	const setTravellerCountClamped = (value: number) => {
		setTravellerCount(clamp(value, 1, Math.max(1, maxGroupSize)));
	};

	const handleBookDeparture = () => {
		if (!selectedSlot) return;

		const checkoutPath = ROUTES.PACKAGE_BOOKING_CHECKOUT.replace(':id', String(packageId));
		const target = `${checkoutPath}?slotId=${selectedSlot.id}&count=${travellerCount}`;

		if (!isAuthenticated) {
			void navigate(`${ROUTES.LOGIN}?next=${encodeURIComponent(target)}`);
			return;
		}

		void navigate(target);
	};

	return (
		<div className="space-y-5">
			<PackageAvailabilityCalendar
				year={calendarYear}
				month={calendarMonth}
				availability={availability}
				loading={loadingAvail}
				selectedDate={selectedDate}
				onMonthChange={handleMonthChange}
				onDateSelect={(date) => {
					void handleDateSelect(date);
				}}
			/>

			{availabilityError && (
				<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
					{availabilityError}
				</p>
			)}

			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<CalendarDays className="w-4 h-4 text-teal-600" />
					<h3 className="text-sm font-semibold text-ink">Available Departures</h3>
				</div>

				{!selectedDate && (
					<p className="text-sm text-ink-muted">
						Select a date on the calendar to see departures.
					</p>
				)}

				{selectedDate && (
					<p className="text-xs text-ink-muted">
						Departures on {format(parseISO(selectedDate), 'EEEE, d MMM yyyy')}
					</p>
				)}

				{loadingSlots && (
					<div className="space-y-3">
						{Array.from({ length: 2 }, (_, i) => (
							<div key={i} className="h-[92px] rounded-xl bg-surface-muted animate-pulse" />
						))}
					</div>
				)}

				{slotsError && !loadingSlots && (
					<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
						{slotsError}
					</p>
				)}

				{!loadingSlots && selectedDate && !slotsError && slots.length === 0 && (
					<p className="text-sm text-ink-muted bg-surface-muted border border-line rounded-xl p-4">
						No departures available for this date.
					</p>
				)}

				{!loadingSlots && slots.length > 0 && (
					<div className="space-y-3">
						{slots.map((slot) => {
							const soldOut = slot.availableCapacity === 0;
							const selected = selectedSlotId === slot.id;
							const duration = getSlotDurationDays(slot.startDate, slot.endDate, durationDays);
							const barPercent = getAvailabilityBarPercent(slot.availableCapacity, maxGroupSize);

							return (
								<button
									key={slot.id}
									type="button"
									onClick={() => !soldOut && setSelectedSlotId(slot.id)}
									disabled={soldOut}
									className={`w-full text-left border-2 rounded-xl p-4 transition-all cursor-pointer ${
										soldOut
											? 'border-line-muted bg-surface-muted cursor-not-allowed opacity-60'
											: selected
												? 'border-teal-500 bg-teal-50'
												: 'border-line hover:border-teal-300'
									}`}
								>
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="text-sm font-semibold text-ink">
												{formatDateRange(slot.startDate, slot.endDate)}
											</p>
											<p className="text-xs text-ink-muted mt-0.5">
												{duration} day{duration !== 1 ? 's' : ''}
											</p>
										</div>

										<div className="text-right">
											{soldOut ? (
												<span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-raised text-ink-muted">
													Sold Out
												</span>
											) : (
												<span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-700">
													{selected ? 'Selected' : 'Select'}
												</span>
											)}
											<p className="text-xs text-ink-muted mt-1">
												{slot.availableCapacity} spots left
											</p>
										</div>
									</div>

									<div className="mt-3 h-1.5 w-full bg-surface-raised rounded-full overflow-hidden">
										{/* Dynamic runtime percentage width; inline style retained intentionally */}
										<div
											className="h-full bg-teal-500 rounded-full transition-all"
											style={{ width: `${barPercent}%` }}
										/>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</div>

				<div className="pt-2 border-t border-line-muted space-y-4">
					<BookingTravellerStepper
						value={travellerCount}
						onChange={setTravellerCountClamped}
						max={maxGroupSize}
						groupSizeWarning={(
							<p className="text-xs text-ink-muted mt-2">
								Maximum group size: {maxGroupSize} travellers
							</p>
						)}
						capacityWarning={
							selectedSlot && travellerCount > selectedSlot.availableCapacity && selectedSlot.availableCapacity > 0 ? (
								<p className="text-xs text-amber-700 mt-1">
									Only {selectedSlot.availableCapacity} spots left on this departure.
								</p>
							) : undefined
						}
					/>

					<Button
						variant="primary"
						fullWidth
						disabled={!canBook}
						onClick={handleBookDeparture}
					>
						Book This Departure
					</Button>
				</div>
			</div>
	);
};

export default PackageSlotsSection;
