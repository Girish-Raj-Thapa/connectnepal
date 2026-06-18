import {
	useState,
	useEffect,
	useCallback,
	useRef,
	useMemo,
} from 'react';
import { useNavigate, useParams, generatePath, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { ArrowLeft, Info } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import AvailabilityCalendar from '@components/bookings/AvailabilityCalendar';
import SlotPicker from '@components/bookings/SlotPicker';
import BookingSummaryCard from '@components/bookings/BookingSummaryCard';
import BookingTravellerStepper from '@components/bookings/BookingTravellerStepper';
import publicListingsService from '@services/publicListings.service';
import { TravellerBookingService } from '@services/bookings.service';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import {
	buildCheckoutSchema,
	type CheckoutFormData,
} from '@utils/validators/bookings';
import type { ListingDetail } from '@/types/listings';
import type {
	BookingQuote,
	ActivitySlot,
	AvailabilityStatus,
} from '@/types/bookings';
import { AVAILABILITY_LABELS } from '@/types/bookings';


// Helpers

const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
	available:   'text-emerald-700 bg-emerald-50 border-emerald-200',
	conflict:    'text-amber-700 bg-amber-50 border-amber-200',
	unavailable: 'text-red-700 bg-red-50 border-red-200',
};


// Checkout Form

interface CheckoutFormProps {
	listing: ListingDetail;
}

const CheckoutForm = ({ listing }: CheckoutFormProps) => {
	const navigate = useNavigate();

	/** Generated once per checkout session. Persists across re-renders. */
	const idempotencyKey = useRef(crypto.randomUUID());

	// Slot selection state — outside RHF because it drives slot-fetch side effects
	const [selectedDate,  setSelectedDate]  = useState('');
	const [slots,         setSlots]         = useState<ActivitySlot[]>([]);
	const [slotsLoading,  setSlotsLoading]  = useState(false);

	// Quote state — derived from an API call, not from user input that needs validation
	const [quote, setQuote]               = useState<BookingQuote | null>(null);
	const [quoteLoading, setQuoteLoading] = useState(false);
	const [quoteError, setQuoteError]     = useState('');

	// Schema memoized — runs once per listing mount (no durationType param anymore)
	const schema = useMemo(
		() => buildCheckoutSchema(listing.minGroupSize, listing.maxGroupSize),
		[listing.minGroupSize, listing.maxGroupSize],
	);

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
			useApiSubmit<CheckoutFormData>(async (data) => {
				const booking = await TravellerBookingService.create(
					{ items: [{ listingId: listing.id, slotId: data.slotId, travellerCount: data.travellerCount }] },
					idempotencyKey.current,
				);
				notification.success('Booking created! Complete payment to confirm.');
				void navigate(
					generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(booking.id) }),
				);
			});

	const {
		control,
		handleSubmit,
		watch,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<CheckoutFormData>({
		resolver: yupResolver(schema),
		defaultValues: {
			travellerCount: listing.minGroupSize,
			slotId:         0,
		},
	});

	// Watch as primitives — avoids infinite loop from watch() object reference
	const slotId         = watch('slotId');
	const travellerCount = watch('travellerCount');
	const loading        = isSubmitting || submitting;

	// Derived — selected slot and over-capacity check (client-side, no quote needed)
	const selectedSlot = useMemo(
		() => slots.find((s) => s.id === slotId) ?? null,
		[slots, slotId],
	);
	const overCapacity = Boolean(selectedSlot && travellerCount > selectedSlot.availableCapacity);

	// Fetch slots whenever the selected date or listing changes
	useEffect(() => {
		if (!selectedDate) { setSlots([]); return; }
		let cancelled = false;
		setSlotsLoading(true);
		publicListingsService
			.getPublicSlots(listing.id, selectedDate)
			.then((data) => {
				if (!cancelled) {
					setSlots(data);
					// Auto-select if there's exactly one slot; otherwise reset
					setValue('slotId', data.length === 1 ? data[0].id : 0);
				}
			})
			.catch(() => { if (!cancelled) setSlots([]); })
			.finally(() => { if (!cancelled) setSlotsLoading(false); });
		return () => { cancelled = true; };
	}, [selectedDate, listing.id, setValue]);

	// Debounced Quote — fires when slot + traveller count are set
	useEffect(() => {
		if (!slotId || !travellerCount || overCapacity) {
			setQuote(null);
			return;
		}
		const timer = setTimeout(async () => {
			try {
				setQuoteLoading(true);
				setQuoteError('');
				const data = await TravellerBookingService.quote({
					items: [{ listingId: listing.id, slotId, travellerCount }],
				});
				setQuote(data);
			} catch (err) {
				setQuoteError(
					err instanceof Error ? err.message : 'Could not fetch price estimate',
				);
				setQuote(null);
			} finally {
				setQuoteLoading(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [listing, slotId, travellerCount, overCapacity]);

	const onSubmit = (data: CheckoutFormData) => {
		void (async () => { await handleApiSubmit(data); })();
	};

	const availability = quote?.items[0]?.availability;

		return (
			<form
				onSubmit={(e) => {
					void handleSubmit(onSubmit)(e);
				}}
				noValidate
			>
			<h1 className="page-heading text-ink mb-6">
				Complete Your Booking
			</h1>

			{apiError && (
				<div className="mb-5">
					<FormErrorBanner>{apiError}</FormErrorBanner>
				</div>
			)}

			<div className="flex flex-col lg:flex-row gap-8">

				{/* ── Left column ──────────────────────────────────────── */}
				<div className="flex-1 space-y-6">

					{/* Listing summary card */}
					<BookingSummaryCard
						imageUrl={listing.images.find((i) => i.isPrimary)?.thumbnailUrl}
						imageAlt={listing.title}
						badgeText={listing.categoryDisplay}
						title={listing.title}
						subtitle={listing.destination}
						pricePerPerson={Number(listing.pricePerPerson)}
					/>

					{/* Booking details form card */}
					<div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-6">
						<h3 className="card-heading text-ink border-b border-line-muted pb-3">
							Booking Details
						</h3>

						{/* Step 1: Traveller count — always shown */}
						<BookingTravellerStepper
							value={travellerCount}
							onChange={(val) => setValue('travellerCount', val)}
							min={listing.minGroupSize}
							max={listing.maxGroupSize}
							capacityWarning={
								overCapacity && selectedSlot ? (
									<p className="text-xs text-red-600">
										Only <strong>{selectedSlot.availableCapacity}</strong> seat{selectedSlot.availableCapacity !== 1 ? 's' : ''} available for this slot
										{selectedSlot.capacity - selectedSlot.availableCapacity > 0 && (
											<> ({selectedSlot.capacity - selectedSlot.availableCapacity} already booked)</>
										)}
										. Reduce the number of travellers to continue.
									</p>
								) : undefined
							}
							groupSizeWarning={
								travellerCount >= listing.maxGroupSize ? (
									<p className="text-xs text-amber-600">
										Max {listing.maxGroupSize} travellers allowed — fewer dates may be available at this group size.
									</p>
								) : undefined
							}
						/>

						{/* Step 2: Availability calendar */}
						<AvailabilityCalendar
							listingId={listing.id}
							travellerCount={travellerCount}
							value={selectedDate}
							onChange={(d) => setSelectedDate(d)}
							label="Select a Date"
						/>

						{/* Step 3: Slot picker — hidden when auto-selected (only one slot) */}
						{selectedDate && (slotsLoading || slots.length !== 1) && (
							<Controller
								name="slotId"
								control={control}
								render={({ field }) => (
									<SlotPicker
										slots={slots}
										loading={slotsLoading}
										value={field.value || null}
										onChange={(id) => field.onChange(id)}
										error={errors.slotId?.message}
										durationType={listing.durationType}
									/>
								)}
							/>
						)}
					</div>
				</div>

				{/* ── Right column — sticky price sidebar ──────────────── */}
				<div className="lg:w-80 shrink-0">
					<div className="sticky top-24 bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-5">
						<h3 className="card-heading text-ink border-b border-line-muted pb-3">
							Price Summary
						</h3>

						{!overCapacity && availability && (
							<div
								className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border ${AVAILABILITY_COLORS[availability]}`}
							>
								<Info className="w-4 h-4 shrink-0" />
								{AVAILABILITY_LABELS[availability]}
							</div>
						)}

						{quoteLoading && (
							<div className="flex items-center gap-2 text-sm text-ink-muted">
								<div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
								Calculating price…
							</div>
						)}

						{quoteError && !quoteLoading && (
							<p className="text-xs text-amber-600">{quoteError}</p>
						)}

						{!quote && !quoteLoading && !quoteError && (
							<p className="text-sm text-ink-muted text-center py-4">
								Select a date and slot above to see your price.
							</p>
						)}

						{quote && !quoteLoading && (
							<div className="space-y-2 text-sm">
								<div className="flex justify-between text-ink-muted">
									<span>Subtotal</span>
									<span>NPR {Number(quote.totals.subtotal).toLocaleString()}</span>
								</div>
								{Number(quote.totals.feeAmount) > 0 && (
									<div className="flex justify-between text-ink-muted">
										<span>Platform fee</span>
										<span>NPR {Number(quote.totals.feeAmount).toLocaleString()}</span>
									</div>
								)}
								{Number(quote.totals.taxAmount) > 0 && (
									<div className="flex justify-between text-ink-muted">
										<span>Tax</span>
										<span>NPR {Number(quote.totals.taxAmount).toLocaleString()}</span>
									</div>
								)}
								{Number(quote.totals.discountAmount) > 0 && (
									<div className="flex justify-between text-emerald-700">
										<span>Discount</span>
										<span>− NPR {Number(quote.totals.discountAmount).toLocaleString()}</span>
									</div>
								)}
								<div className="flex justify-between font-bold text-ink text-base border-t border-line pt-2">
									<span>Total</span>
									<span>NPR {Number(quote.totals.quotedTotal).toLocaleString()}</span>
								</div>
							</div>
						)}

						<Button
							type="submit"
							variant="primary"
							fullWidth
							loading={loading}
							disabled={loading || availability !== 'available'}
						>
							Confirm Booking
						</Button>

						<p className="text-xs text-ink-muted text-center leading-relaxed">
							{listing.cancellationPolicyDisplay}
						</p>
					</div>
				</div>
			</div>
		</form>
	);
};


// ─── BookingCheckout (shell — default export) ─────────────────────────────────

const BookingCheckout = () => {
	const { slug } = useParams<{ slug: string }>();
	const [listing, setListing] = useState<ListingDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError]     = useState('');
	const fetchIdRef            = useRef(0);

	const fetchListing = useCallback(async () => {
		if (!slug) {
			setError('No listing specified.');
			setLoading(false);
			return;
		}
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await publicListingsService.getPublicListingBySlug(slug);
			if (currentFetchId !== fetchIdRef.current) return;
			if (!data.isBookable) {
				setError('This experience is not currently available for booking.');
				return;
			}
			setListing(data);
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			setError(err instanceof Error ? err.message : 'Failed to load listing');
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [slug]);

	useEffect(() => {
		void fetchListing();
	}, [fetchListing]);

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted px-6 lg:px-8">
				<div className="max-w-5xl mx-auto py-3 flex items-center gap-2 text-sm">
					<Link
						to={
							slug
								? generatePath(ROUTES.PUBLIC_LISTING_DETAIL, { slug })
								: ROUTES.PUBLIC_LISTINGS
						}
						className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to listing
					</Link>
					<span className="text-line">/</span>
					<span className="text-ink font-medium">Book Experience</span>
				</div>
			</div>

			<main className="max-w-5xl mx-auto p-6 lg:p-8">
				{loading && (
					<div className="flex justify-center py-20">
						<Loader text="Loading experience..." />
					</div>
				)}

				{!loading && (error || !listing) && (
					<div className="max-w-lg mx-auto py-20 text-center">
						<p className="text-ink-muted mb-6">{error || 'Listing not found.'}</p>
						<Button onClick={() => void fetchListing()}>Retry</Button>
					</div>
				)}

				{!loading && listing && (
					<CheckoutForm listing={listing} />
				)}
			</main>
		</div>
	);
};

export default BookingCheckout;
