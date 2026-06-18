import { useEffect, useMemo, useState } from 'react';
import { Link, generatePath, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import PageLoader from '@components/feedback/PageLoader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import Checkbox from '@components/form/Checkbox';
import PackageAvailabilityCalendar from '@components/packages/PackageAvailabilityCalendar';
import BookingSummaryCard from '@components/bookings/BookingSummaryCard';
import BookingTravellerStepper from '@components/bookings/BookingTravellerStepper';
import publicPackagesService from '@/services/publicPackages.service';
import { PackageBookingError, TravellerBookingService } from '@/services/bookings.service';
import { ROUTES } from '@/constants/routes';
import type { PackageErrorCode } from '@/types/bookings';
import type { PublicPackageDetail, PublicPackageSlot, PackageAvailabilityMonth } from '@/types/packages';

const formatPrice = (value: number): string =>
	value.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toPositiveInt = (value: string | null): number | null => {
	if (!value) return null;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
};

const PackageBooking = () => {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const [searchParams] = useSearchParams();

	const packageId = Number(id);
	const slotIdFromQuery = toPositiveInt(searchParams.get('slotId'));
	const countFromQuery = toPositiveInt(searchParams.get('count'));

	// Package and slots data
	const [pkg, setPkg] = useState<PublicPackageDetail | null>(null);
	const [selectedSlotId, setSelectedSlotId] = useState<number | null>(slotIdFromQuery);
	const [travellerCount, setTravellerCount] = useState<number>(countFromQuery ?? 1);

	// Calendar state
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth() + 1);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [availability, setAvailability] = useState<PackageAvailabilityMonth | null>(null);
	const [availabilityLoading, setAvailabilityLoading] = useState(false);

	// Slots for selected date
	const [slotsForDate, setSlotsForDate] = useState<PublicPackageSlot[]>([]);
	const [slotsLoading, setSlotsLoading] = useState(false);

	// UI state
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [idempotencyKey] = useState(() => crypto.randomUUID());

	// Fetch package detail on mount
	useEffect(() => {
		if (!id || Number.isNaN(packageId) || packageId <= 0) {
			setError('Package not found');
			setLoading(false);
			return;
		}

		let cancelled = false;

		const fetchPackage = async () => {
			try {
				setLoading(true);
				setError(null);
				const packageDetail = await publicPackagesService.getPackageDetail(packageId);
				if (cancelled) return;
				setPkg(packageDetail);
			} catch (err) {
				if (cancelled) return;
				const message = err instanceof Error ? err.message.toLowerCase() : '';
				setError(message.includes('not found') ? 'Package not found' : 'Failed to load package booking details');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		void fetchPackage();
		return () => {
			cancelled = true;
		};
	}, [id, packageId]);

	// Fetch availability for current month
	useEffect(() => {
		if (!pkg) return;

		let cancelled = false;

			const fetchAvailability = async () => {
				try {
					setAvailabilityLoading(true);
					const data = await publicPackagesService.getPackageAvailability(pkg.id, year, month);
					if (!cancelled) setAvailability(data);
				} catch {
					if (!cancelled) setAvailability(null);
				} finally {
					if (!cancelled) setAvailabilityLoading(false);
				}
			};

		void fetchAvailability();
		return () => {
			cancelled = true;
		};
	}, [pkg, year, month]);

	// Fetch slots for selected date
	useEffect(() => {
		if (!selectedDate || !pkg) {
			setSlotsForDate([]);
			setSelectedSlotId(null);
			return;
		}

		let cancelled = false;

			const fetchSlots = async () => {
				try {
					setSlotsLoading(true);
					const endDate = format(
						new Date(parseISO(selectedDate).getTime() + 24 * 60 * 60 * 1000),
					'yyyy-MM-dd',
				);
				const slots = await publicPackagesService.getPackageSlots(pkg.id, {
					dateFrom: selectedDate,
					dateTo: endDate,
				});
				if (!cancelled) {
					// Filter to only show slots that START on the selected date
					const filtered = slots.filter(slot => slot.startDate === selectedDate);
					const sorted = [...filtered].sort((a, b) => a.startDate.localeCompare(b.startDate));
					setSlotsForDate(sorted);
					// Auto-select if only one slot
					if (sorted.length === 1) {
						setSelectedSlotId(sorted[0].id);
					} else {
						setSelectedSlotId(null);
					}
				}
				} catch {
					if (!cancelled) setSlotsForDate([]);
				} finally {
					if (!cancelled) setSlotsLoading(false);
				}
			};

		void fetchSlots();
		return () => {
			cancelled = true;
		};
	}, [selectedDate, pkg]);

	const selectedSlot = useMemo(
		() => slotsForDate.find((slot) => slot.id === selectedSlotId) ?? null,
		[slotsForDate, selectedSlotId],
	);

	const overGroupSize = pkg ? travellerCount > pkg.maxGroupSize : false;
	const overCapacity = !!selectedSlot && travellerCount > selectedSlot.availableCapacity;
	const selectedSlotFull = !!selectedSlot && selectedSlot.availableCapacity === 0;

	const subtotal = useMemo(() => {
		if (!pkg) return 0;
		return parseFloat(pkg.totalPrice) * Math.max(0, travellerCount);
	}, [pkg, travellerCount]);
	const feeAmount = useMemo(() => Math.round(subtotal * 0.05 * 100) / 100, [subtotal]);
	const taxAmount = useMemo(() => Math.round(subtotal * 0.13 * 100) / 100, [subtotal]);
	const grossAmount = useMemo(() => subtotal + feeAmount + taxAmount, [subtotal, feeAmount, taxAmount]);

	const submitDisabled =
		!selectedSlot ||
		selectedSlotFull ||
		travellerCount < 1 ||
		overGroupSize ||
		!termsAccepted ||
		submitting;

	const handleSubmit = async () => {
		if (!pkg || !selectedSlot || submitDisabled) return;

		setSubmitting(true);
		setSubmitError(null);
		try {
			const booking = await TravellerBookingService.createPackageBooking(
				{
					packageId: pkg.id,
					travellerCount,
					packageSlotId: selectedSlot.id,
				},
				idempotencyKey,
			);
			void navigate(
				generatePath(ROUTES.TRAVELLER_BOOKING_PAYMENT, { id: String(booking.id) }),
			);
		} catch (err) {
			const code = err instanceof PackageBookingError ? err.code : undefined;
			const detail = err instanceof PackageBookingError
				? err.detail
				: err instanceof Error
					? err.message
					: 'Booking failed. Please try again.';
			const messages: Partial<Record<PackageErrorCode, string>> = {
				package_slot_full: 'This departure is fully booked. Please choose another date.',
				package_no_available_slots: 'No departures are currently available for this package.',
				package_fully_booked: 'This package has reached its maximum booking capacity.',
				group_size_exceeded: `Maximum group size is ${pkg.maxGroupSize} travellers.`,
				package_not_bookable: 'This package is not currently available for booking.',
				package_expired: 'This package is no longer available.',
				package_not_yet_valid: 'This package is not yet open for bookings.',
			};
			setSubmitError((code && messages[code]) ?? detail);
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return <PageLoader />;
	}

	if (error || !pkg) {
		return (
			<div className="min-h-screen bg-surface-muted">
				<Navbar />
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<h1 className="page-heading text-ink mb-2">
						{error ?? 'Package not found'}
					</h1>
					<Link
						to={`${ROUTES.PUBLIC_LISTINGS}?tab=packages`}
						className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
					>
						Back to Packages
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted px-6 lg:px-8">
				<div className="max-w-5xl mx-auto py-3 flex items-center gap-2 text-sm">
					<Link
						to={ROUTES.PUBLIC_PACKAGE_DETAIL.replace(':id', String(pkg.id))}
						className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to package
					</Link>
					<span className="text-line">/</span>
					<span className="text-ink font-medium">Book Package</span>
				</div>
			</div>

			<main className="max-w-5xl mx-auto p-6 lg:p-8">
				<h1 className="page-heading text-ink mb-6">Complete Your Booking</h1>

				<div className="flex flex-col lg:flex-row gap-8">

					{/* ── Left column ──────────────────────────────────────── */}
					<div className="flex-1 space-y-6">

						{/* Package summary card */}
						<BookingSummaryCard
							imageUrl={pkg.coverImageUrl}
							imageAlt={pkg.title}
							badgeText="Package"
							title={pkg.title}
							subtitle={`Hosted by ${pkg.hostName}`}
							pricePerPerson={parseFloat(pkg.totalPrice)}
							formatPrice={formatPrice}
							gradientFallback
						/>

						{/* Booking details form card */}
						<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-6">
							<h3 className="card-heading text-ink border-b border-line-muted pb-3">
								Booking Details
							</h3>

							{/* Step 1: Traveller count — always shown */}
							<BookingTravellerStepper
								value={travellerCount}
								onChange={setTravellerCount}
								max={pkg.maxGroupSize}
								groupSizeWarning={
									overGroupSize ? (
										<p className="text-xs text-amber-600">
											Max {pkg.maxGroupSize} travellers allowed — fewer dates may be available at this group size.
										</p>
									) : undefined
								}
								capacityWarning={
									selectedSlot && overCapacity ? (
										<p className="text-xs text-red-600">
											Only <strong>{selectedSlot.availableCapacity}</strong> spot{selectedSlot.availableCapacity !== 1 ? 's' : ''} available for this slot. Reduce the number of travellers to continue.
										</p>
									) : undefined
								}
							/>

							{/* Step 2: Availability calendar */}
							<PackageAvailabilityCalendar
								year={year}
								month={month}
								availability={availability}
								loading={availabilityLoading}
								selectedDate={selectedDate}
								onMonthChange={(y, m) => {
									setYear(y);
									setMonth(m);
								}}
								onDateSelect={setSelectedDate}
								label="Select a Date"
							/>

							{/* Step 3: Slot picker — hidden when auto-selected (only one slot) */}
							{selectedDate && (slotsLoading || slotsForDate.length !== 1) && (
								<div>
									<div className="flex items-center justify-between mb-4">
										<h4 className="text-sm font-semibold text-ink">Available Departures</h4>
										{slotsForDate.length > 0 && (
											<span className="text-xs text-ink-muted">
												{slotsForDate.filter((s) => s.availableCapacity > 0).length} available
											</span>
										)}
									</div>

									{slotsLoading ? (
										<div className="flex items-center justify-center gap-2 py-8">
											<div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
											<span className="text-sm text-ink-muted">Loading departures...</span>
										</div>
									) : slotsForDate.length === 0 ? (
										<p className="text-sm text-ink-muted py-6 text-center">
											No departures available for this date.
										</p>
									) : (
										<div className="space-y-2">
											{slotsForDate.map((slot) => {
												const selected = selectedSlotId === slot.id;
												const soldOut = slot.availableCapacity === 0;
												const daysLeft = Math.ceil(
													(new Date(slot.endDate).getTime() -
														new Date(slot.startDate).getTime()) /
													(1000 * 60 * 60 * 24),
												);

												return (
													<button
														key={slot.id}
														type="button"
														onClick={() => !soldOut && setSelectedSlotId(slot.id)}
														disabled={soldOut}
														className={`w-full text-left border rounded-lg p-3 transition-all ${
															soldOut
																? 'border-line bg-surface-muted text-ink-muted cursor-not-allowed'
																: selected
																	? 'border-teal-500 bg-teal-50 ring-1 ring-teal-200'
																	: 'border-line hover:border-teal-300 hover:bg-surface-muted'
														}`}
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<p className="text-sm font-medium text-ink">
																	{format(parseISO(slot.startDate), 'MMM d')} –{' '}
																	{format(parseISO(slot.endDate), 'MMM d, yyyy')}
																</p>
																<p className="text-xs text-ink-muted mt-0.5">{daysLeft} days</p>
															</div>
															<div className="text-right shrink-0">
																<p
																	className={`text-xs font-semibold ${
																		soldOut
																			? 'text-ink-muted'
																			: slot.availableCapacity <= 2
																				? 'text-amber-600'
																				: 'text-emerald-600'
																	}`}
																>
																	{slot.availableCapacity > 0
																		? `${slot.availableCapacity} spots`
																		: 'Sold out'}
																</p>
															</div>
														</div>
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{/* ── Right column — sticky price sidebar ──────────────── */}
					<div className="lg:w-80 shrink-0">
						<div className="sticky top-24 bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-5">
							<h3 className="card-heading text-ink border-b border-line-muted pb-3">
								Price Summary
							</h3>

							{/* Availability Status */}
							{selectedSlot && (
								<div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
									<div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
									<span className="text-xs font-semibold text-emerald-700">Available</span>
								</div>
							)}

							{!selectedSlot ? (
								<p className="text-sm text-ink-muted text-center py-4">
									Select a date and slot above to see your price.
								</p>
							) : (
								<div className="space-y-2 text-sm">
									<div className="flex justify-between text-ink-muted">
										<span>Subtotal</span>
										<span>NPR {formatPrice(subtotal)}</span>
									</div>
									{feeAmount > 0 && (
										<div className="flex justify-between text-ink-muted">
											<span>Platform fee</span>
											<span>NPR {formatPrice(feeAmount)}</span>
										</div>
									)}
									{taxAmount > 0 && (
										<div className="flex justify-between text-ink-muted">
											<span>Tax</span>
											<span>NPR {formatPrice(taxAmount)}</span>
										</div>
									)}
									<div className="flex justify-between font-bold text-ink text-base border-t border-line pt-2">
										<span>Total</span>
										<span>NPR {formatPrice(grossAmount)}</span>
									</div>
								</div>
							)}

								<Button
									type="button"
									variant="primary"
									fullWidth
									loading={submitting}
									disabled={submitDisabled}
									onClick={() => {
										void handleSubmit();
									}}
								>
									Confirm Booking
								</Button>

								{/* Terms Checkbox */}
								<label className="flex items-start gap-2 text-xs text-ink-secondary leading-relaxed">
									<Checkbox
										checked={termsAccepted}
										onChange={(e) => setTermsAccepted(e.target.checked)}
										className="mt-0.5 w-3.5 h-3.5 focus:ring-teal-500 shrink-0"
									/>
									<span>I agree to the Terms &amp; Conditions and cancellation policy.</span>
								</label>

								{submitError && <FormErrorBanner>{submitError}</FormErrorBanner>}

							<p className="text-xs text-ink-muted text-center leading-relaxed">
								Free cancellation up to 24 hours before
							</p>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};

export default PackageBooking;
