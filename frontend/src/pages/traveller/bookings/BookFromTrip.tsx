import {
	useState,
	useEffect,
	useCallback,
	useRef,
} from 'react';
import { useParams, useNavigate, generatePath, Link } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
	ArrowLeft,
	AlertCircle,
	AlertTriangle,
	Users,
	CheckCircle,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import InputField from '@components/form/InputField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import AvailabilityCalendar from '@components/bookings/AvailabilityCalendar';
import SlotPicker from '@components/bookings/SlotPicker';
import tripPlannerService from '@services/tripPlanner.service';
import publicListingsService from '@services/publicListings.service';
import { TravellerBookingService } from '@services/bookings.service';
import useApiSubmit from '@hooks/useApiSubmit';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import {
	fromTripSchema,
	type FromTripFormData,
} from '@utils/validators/bookings';
import type { TripPlanDetail, TripPlannerItem } from '@/types/tripPlanner';
import type { ActivitySlot } from '@/types/bookings';

const BookFromTrip = () => {
	const { planId } = useParams<{ planId: string }>();
	const navigate   = useNavigate();

	const [plan, setPlan]       = useState<TripPlanDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError]     = useState('');

	/**
	 * Parallel array to `fields` — holds display-only data (title, image, day).
	 * Index-aligned: planItems[i] corresponds to fields[i].
	 * Only contains items where isAvailableForBooking !== false.
	 */
	const [planItems, setPlanItems] = useState<TripPlannerItem[]>([]);

	/** Items excluded from booking because they are temporarily unavailable. */
	const [unavailableItems, setUnavailableItems] = useState<TripPlannerItem[]>([]);

	// Per-item state — parallel arrays indexed by item position
	const [itemDates,    setItemDates]    = useState<string[]>([]);
	const [itemSlots,    setItemSlots]    = useState<ActivitySlot[][]>([]);
	const [slotsLoading, setSlotsLoading] = useState<boolean[]>([]);

	const idempotencyKey = useRef(crypto.randomUUID());
	const fetchIdRef     = useRef(0);

	// ── Form ──────────────────────────────────────────────────────────────────
	const {
		control,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<FromTripFormData>({
		resolver: yupResolver(fromTripSchema),
		defaultValues: { items: [] },
	});

	const { fields } = useFieldArray({ control, name: 'items' });

	// Watch all items at once to avoid calling watch() per-item inside a loop
	const watchedItems = watch('items');

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
			useApiSubmit<FromTripFormData>(async (data) => {
				const items = data.items.map((item) => ({
					tripPlanItemId: item.tripPlanItemId,
					slotId:         item.slotId,
					travellerCount: item.travellerCount,
				}));
				const booking = await TravellerBookingService.bookFromTripPlan(
					Number(planId),
					{ items },
					idempotencyKey.current,
				);
				notification.success('Trip booking created! Complete payment to confirm.');
				void navigate(
					generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: String(booking.id) }),
				);
			});

	// ── Per-item date change handler ───────────────────────────────────────────
	const handleDateChange = (index: number, date: string) => {
		setItemDates((prev) => prev.map((d, i) => (i === index ? date : d)));
		setValue(`items.${index}.slotId`, 0);  // reset slot when date changes

		const listingId = planItems[index]?.listing.id;
		if (!listingId) return;

		setSlotsLoading((prev) => prev.map((v, i) => (i === index ? true : v)));
		publicListingsService
			.getPublicSlots(listingId, date)
			.then((slots) => {
				setItemSlots((prev) => prev.map((s, i) => (i === index ? slots : s)));
			})
			.catch(() => {
				setItemSlots((prev) => prev.map((s, i) => (i === index ? [] : s)));
			})
			.finally(() => {
				setSlotsLoading((prev) => prev.map((v, i) => (i === index ? false : v)));
			});
	};

	// ── Fetch trip plan ───────────────────────────────────────────────────────
	const fetchPlan = useCallback(async () => {
		if (!planId) return;
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			setError('');
			const data = await tripPlannerService.getTripPlan(Number(planId));
			if (currentFetchId !== fetchIdRef.current) return;
			setPlan(data);

			const allItems = Object.values(data.itemsByDay)
				.flat()
				.sort((a, b) => a.dayNumber - b.dayNumber || a.order - b.order);

			const bookableItems = allItems.filter((item) => item.isAvailableForBooking !== false);
			const blockedItems  = allItems.filter((item) => item.isAvailableForBooking === false);

			setPlanItems(bookableItems);
			setUnavailableItems(blockedItems);

			const n = bookableItems.length;
			setItemDates(Array(n).fill(''));
			setItemSlots(Array(n).fill([]));
			setSlotsLoading(Array(n).fill(false));

			reset({
				items: bookableItems.map((item) => ({
					tripPlanItemId: item.id,
					travellerCount: data.travellersCount,
					slotId:         0,
				})),
			});
		} catch (err) {
			if (currentFetchId !== fetchIdRef.current) return;
			setError(
				err instanceof Error ? err.message : 'Failed to load trip plan',
			);
		} finally {
			if (currentFetchId === fetchIdRef.current) setLoading(false);
		}
	}, [planId, reset]);

	useEffect(() => {
		void fetchPlan();
	}, [fetchPlan]);

	const onSubmit = (data: FromTripFormData) => {
		void (async () => {
			await handleApiSubmit(data);
		})();
	};

	const submitLoading = isSubmitting || submitting;

	// ── Render: loading ───────────────────────────────────────────────────────
	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex justify-center py-20">
					<Loader text="Loading trip plan..." />
				</div>
			</DashboardLayout>
		);
	}

	// ── Render: error ─────────────────────────────────────────────────────────
	if (error || !plan) {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<p className="text-ink-muted mb-4">{error || 'Trip plan not found.'}</p>
					<Button onClick={() => void fetchPlan()}>Retry</Button>
				</div>
			</DashboardLayout>
		);
	}

	// ── Render: all items unavailable ────────────────────────────────────────
	if (planItems.length === 0 && unavailableItems.length > 0) {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
					<h2 className="section-heading text-ink-secondary mb-2">
						No experiences available to book
					</h2>
					<p className="text-ink-muted mb-6">
						All experiences in this trip are temporarily unavailable. Please check back later or edit your trip plan.
					</p>
					<Link
						to={generatePath(ROUTES.TRAVELLER_TRIP_DETAIL, {
							id: String(plan.id),
						})}
						className="inline-block px-5 py-2 border border-line rounded-xl text-sm font-semibold text-ink-secondary hover:bg-surface-muted"
					>
						Back to Trip Plan
					</Link>
				</div>
			</DashboardLayout>
		);
	}

	// ── Render: wrong status ──────────────────────────────────────────────────
	if (plan.status !== 'planning') {
		return (
			<DashboardLayout>
				<div className="max-w-lg mx-auto py-20 text-center">
					<AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
					<h2 className="section-heading text-ink-secondary mb-2">
						Cannot book this trip
					</h2>
					<p className="text-ink-muted mb-6">
						Only trips in <strong>Planning</strong> status can be booked. This
						trip is <strong>{plan.statusDisplay}</strong>.
					</p>
					<Link
						to={generatePath(ROUTES.TRAVELLER_TRIP_DETAIL, {
							id: String(plan.id),
						})}
						className="inline-block px-5 py-2 border border-line rounded-xl text-sm font-semibold text-ink-secondary hover:bg-surface-muted"
					>
						Back to Trip Plan
					</Link>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-3 flex items-center gap-2 text-sm">
					<Link
						to={generatePath(ROUTES.TRAVELLER_TRIP_DETAIL, {
							id: String(plan.id),
						})}
						className="flex items-center gap-1 text-ink-muted hover:text-teal-600 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" /> {plan.title}
					</Link>
					<span className="text-line">/</span>
					<span className="text-ink font-medium">Book Trip</span>
				</div>
			</div>

			<div className="max-w-2xl mx-auto">
				<h1 className="page-heading text-ink mb-2">
					Book Your Trip Plan
				</h1>
				<p className="page-subtext mb-6">
					Select a date and time slot for each experience.
				</p>

				{/* Plan summary chip */}
				<div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 mb-6">
					<div className="flex items-center gap-3">
						<CheckCircle className="w-6 h-6 text-teal-600 shrink-0" />
						<div>
							<p className="card-heading text-teal-800">{plan.title}</p>
							<p className="text-sm text-teal-600">
								{planItems.length} experience
								{planItems.length !== 1 ? 's' : ''} · {plan.totalDays} day
								{plan.totalDays !== 1 ? 's' : ''}
							</p>
						</div>
					</div>
				</div>

					<form
						onSubmit={(e) => {
							void handleSubmit(onSubmit)(e);
						}}
						className="space-y-5"
						noValidate
					>
					{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

					{/* Temporarily unavailable experiences — excluded from this booking */}
					{unavailableItems.length > 0 && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
							<div className="flex items-start gap-3">
								<AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
								<div>
									<p className="text-sm font-semibold text-amber-800 mb-1">
										{unavailableItems.length} experience{unavailableItems.length !== 1 ? 's' : ''} cannot be booked right now
									</p>
									<ul className="space-y-1">
										{unavailableItems.map((item) => (
											<li key={item.id} className="text-xs text-amber-700">
												<span className="font-medium">{item.listing.title}</span>
												{item.availabilityMessage && ` — ${item.availabilityMessage}`}
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					)}

					{fields.map((field, index) => {
						const planItem   = planItems[index];
						const itemErrors = errors.items?.[index];
						const travellerCount = watchedItems[index]?.travellerCount ?? 1;

						return (
							<div
								key={field.id}
								className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-5"
							>
								{/* Item header */}
								{planItem && (
									<div className="flex items-start gap-3">
										{planItem.listing.primaryImageThumbnail ? (
											<img
												src={planItem.listing.primaryImageThumbnail}
												alt={planItem.listing.title}
												className="w-14 h-14 rounded-xl object-cover shrink-0"
											/>
										) : (
											<div className="w-14 h-14 rounded-xl bg-surface-muted shrink-0" />
										)}
										<div>
											<p className="font-bold text-ink text-sm">
												{planItem.listing.title}
											</p>
											<p className="text-xs text-teal-600">
												Day {planItem.dayNumber}
											</p>
											<p className="text-xs text-ink-muted mt-0.5 capitalize">
												{planItem.durationTypeSnapshot.replace('_', ' ')}
											</p>
										</div>
									</div>
								)}

								{/* Traveller count */}
								<Controller
									name={`items.${index}.travellerCount`}
									control={control}
									render={({ field: f }) => (
										<InputField
											{...f}
											type="number"
											label="Travellers"
											icon={Users}
											min={1}
											error={itemErrors?.travellerCount?.message}
											required
											onChange={(e) => f.onChange(Number(e.target.value))}
										/>
									)}
								/>

								{/* Availability calendar */}
								{planItem && (
									<AvailabilityCalendar
										listingId={planItem.listing.id}
										travellerCount={travellerCount}
										value={itemDates[index] ?? ''}
										onChange={(d) => handleDateChange(index, d)}
										label="Select Date"
									/>
								)}

								{/* Slot picker — shown after date is selected */}
								{itemDates[index] && planItem && (
									<Controller
										name={`items.${index}.slotId`}
										control={control}
										render={({ field: f }) => (
											<SlotPicker
												slots={itemSlots[index] ?? []}
												loading={slotsLoading[index] ?? false}
												value={f.value || null}
												onChange={(id) => f.onChange(id)}
												error={itemErrors?.slotId?.message}
												durationType={planItem.listing.durationType}
											/>
										)}
									/>
								)}
							</div>
						);
					})}

					<Button
						type="submit"
						variant="primary"
						fullWidth
						loading={submitLoading}
						disabled={submitLoading || fields.length === 0}
					>
						Confirm & Book {fields.length} Experience
						{fields.length !== 1 ? 's' : ''}
					</Button>
				</form>
			</div>
		</DashboardLayout>
	);
};

export default BookFromTrip;
