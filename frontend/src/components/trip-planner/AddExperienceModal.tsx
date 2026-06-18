import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { X, Search } from 'lucide-react';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Loader from '@components/feedback/Loader';
import useApiSubmit from '@hooks/useApiSubmit';
import { addExperienceSchema } from '@utils/validators/tripPlanner';
import type { AddExperienceFormData } from '@utils/validators/tripPlanner';
import tripPlannerService from '@services/tripPlanner.service';
import publicListingsService from '@services/publicListings.service';
import type { PublicListing, DurationType } from '@/types/listings';
import type { TripPlannerItem, ItemsByDay } from '@/types/tripPlanner';

interface AddExperienceModalProps {
	open: boolean;
	onClose: () => void;
	planId: number;
	totalDays: number;
	/** Days already blocked by existing full_day or multi_day items in the plan. */
	blockedDays: Set<number>;
	itemsByDay?: ItemsByDay;
	mode?: 'add' | 'edit';
	initialItem?: TripPlannerItem | null;
	onAdded: () => void;
	onUpdated?: () => void;
}

// ── Duration type helpers ────────────────────────────────

const DURATION_TYPE_COLORS: Record<DurationType, string> = {
	hourly: 'bg-teal-50 text-teal-700 border-teal-200',
	full_day: 'bg-amber-50 text-amber-700 border-amber-200',
	multi_day: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DURATION_TYPE_NOTES: Record<DurationType, string> = {
	hourly: 'Can share a day with other hourly experiences.',
	full_day: 'Will block the entire selected day — no other items can be added to it.',
	multi_day: `Will block a contiguous range of days starting from the selected day.`,
};

type ListingOption = {
	id: number;
	title: string;
	destination: string;
	pricePerPerson: string;
	primaryImageThumbnail: string | null;
	durationType: DurationType;
	durationDisplay: string;
};

const toListingOption = (listing: PublicListing): ListingOption => ({
	id: listing.id,
	title: listing.title,
	destination: listing.destination,
	pricePerPerson: listing.pricePerPerson,
	primaryImageThumbnail: listing.primaryImageThumbnail,
	durationType: listing.durationType,
	durationDisplay: listing.durationDisplay,
});

const fromTripItem = (item: TripPlannerItem): ListingOption => ({
	id: item.listing.id,
	title: item.listing.title,
	destination: item.listing.destination,
	pricePerPerson: item.listing.pricePerPerson,
	primaryImageThumbnail: item.listing.primaryImageThumbnail,
	durationType: item.listing.durationType,
	durationDisplay: item.listing.durationDisplay,
});

const getDurationChipLabel = (listing: ListingOption): string => {
	if (listing.durationType === 'multi_day') {
		return `Multi-Day \u2022 ${listing.durationDisplay}`;
	}
	if (listing.durationType === 'hourly') {
		return `Hourly \u2022 ${listing.durationDisplay}`;
	}
	return 'Full Day';
};

// ── Component ────────────────────────────────────────────

const AddExperienceModal = ({
	open,
	onClose,
	planId,
	totalDays,
	blockedDays,
	itemsByDay,
	mode = 'add',
	initialItem,
	onAdded,
	onUpdated,
}: AddExperienceModalProps) => {
	const [hasSearched, setHasSearched] = useState(false);

	// Listing search
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<ListingOption[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedListing, setSelectedListing] = useState<ListingOption | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
		setValue,
		watch,
	} = useForm<AddExperienceFormData>({
		resolver: yupResolver(addExperienceSchema),
		defaultValues: {
			listingId: 0,
			dayNumber: 1,
		},
	});

	const selectedDay = watch('dayNumber');
	const isEdit = mode === 'edit' && !!initialItem;
	const currentDay = initialItem?.dayNumber;

	const occupiedDays = itemsByDay
		? new Set(
				Object.entries(itemsByDay)
					.filter(([, items]) => items.length > 0)
					.map(([day]) => Number(day)),
			)
		: new Set<number>();

	const isDayUnavailable = (day: number) => {
		if (currentDay !== undefined && day === currentDay) return false;
		return blockedDays.has(day) || occupiedDays.has(day);
	};

	const firstAvailableDay = Array.from({ length: totalDays }, (_, i) => i + 1).find(
		(d) => !isDayUnavailable(d),
	);

	useEffect(() => {
		if (!open) return;
		if (isEdit && initialItem) {
			const option = fromTripItem(initialItem);
			setSelectedListing(option);
			setValue('listingId', option.id);
			setValue('dayNumber', initialItem.dayNumber);
			setSearchResults([]);
			setSearchQuery('');
			setHasSearched(false);
		} else if (!isEdit && firstAvailableDay !== undefined) {
			setValue('dayNumber', firstAvailableDay);
			setHasSearched(false);
		}
	}, [open, isEdit, initialItem, setValue, firstAvailableDay]);

	const handleSearch = async () => {
		if (!searchQuery.trim()) return;
		try {
			setHasSearched(true);
			setSearching(true);
			const data = await publicListingsService.getPublicListings({
				search: searchQuery.trim(),
			});
			setSearchResults(data.results.map(toListingOption));
		} catch {
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	};

	const handleSearchKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			void handleSearch();
		}
	};

	const selectListing = (listing: ListingOption) => {
		setSelectedListing(listing);
		setValue('listingId', listing.id);
		if (!isEdit) {
			// Auto-pick the first non-blocked day when a listing is selected
			if (firstAvailableDay !== undefined) {
				setValue('dayNumber', firstAvailableDay);
			}
		}
		setSearchResults([]);
		setSearchQuery('');
		setHasSearched(false);
	};

	const clearSelection = () => {
		setSelectedListing(null);
		setValue('listingId', 0);
	};

	const getNextOrder = (dayNumber: number) => {
		if (!itemsByDay) return undefined;
		const items = itemsByDay[String(dayNumber)] ?? [];
		const maxOrder = items.reduce((max, item) => Math.max(max, item.order), -1);
		return maxOrder + 1;
	};

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
		clearError,
	} = useApiSubmit<AddExperienceFormData>(async (data) => {
		if (isEdit && initialItem) {
			const listingChanged = data.listingId !== initialItem.listing.id;
			const dayChanged = data.dayNumber !== initialItem.dayNumber;

			if (!listingChanged && !dayChanged) {
				handleReset();
				onUpdated?.();
				return;
			}

			if (!listingChanged) {
				const nextOrder = dayChanged ? getNextOrder(data.dayNumber) : undefined;
				await tripPlannerService.updateTripItem(planId, initialItem.id, {
					dayNumber: data.dayNumber,
					...(nextOrder !== undefined ? { order: nextOrder } : {}),
				});
				handleReset();
				onUpdated?.();
				return;
			}

			// Listing changed — replace item (delete then add)
			await tripPlannerService.deleteTripItem(planId, initialItem.id);
			await tripPlannerService.addTripItem(planId, {
				listingId: data.listingId,
				dayNumber: data.dayNumber,
			});
			handleReset();
			onUpdated?.();
			return;
		}

		await tripPlannerService.addTripItem(planId, {
			listingId: data.listingId,
			dayNumber: data.dayNumber,
		});
		handleReset();
		onAdded();
	});

	const onSubmit = (data: AddExperienceFormData) => {
		void handleApiSubmit(data);
	};

	const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		void handleSubmit(onSubmit)(event);
	};

	const handleReset = () => {
		reset();
		setSelectedListing(null);
		setSearchQuery('');
		setSearchResults([]);
		clearError();
		setHasSearched(false);
	};

	const handleClose = () => {
		if (!submitting) {
			handleReset();
			onClose();
		}
	};

	if (!open) return null;

	const durationType = selectedListing?.durationType;
	const dayIsUnavailable = isDayUnavailable(selectedDay);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={handleClose}
			/>

			{/* Modal */}
			<div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 z-10 max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="section-heading text-ink">
						{isEdit ? 'Edit Experience' : 'Add Experience'}
					</h2>
					<button
						onClick={handleClose}
						className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
					>
						<X className="w-5 h-5 text-ink-muted" />
					</button>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<form onSubmit={handleFormSubmit} className="space-y-4">
					{/* ── Listing Search ── */}
					<div>
						<label className="block text-sm font-medium text-ink-secondary mb-1.5">
							Search Experience
						</label>

						{selectedListing ? (
							<div>
								{/* Selected listing card */}
								<div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
									{selectedListing.primaryImageThumbnail && (
										<img
											src={selectedListing.primaryImageThumbnail}
											alt=""
											className="w-12 h-12 rounded-lg object-cover shrink-0"
										/>
									)}
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-ink truncate">
											{selectedListing.title}
										</p>
										<p className="text-xs text-ink-muted">
											{selectedListing.destination} &bull; {selectedListing.durationDisplay} &bull; NPR{' '}
											{Number(selectedListing.pricePerPerson).toLocaleString('en-NP')}
										</p>
									</div>
									{/* Duration type chip */}
									{durationType && (
										<span
											className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${DURATION_TYPE_COLORS[durationType]}`}
										>
											{getDurationChipLabel(selectedListing)}
										</span>
									)}
									<button
										type="button"
										onClick={clearSelection}
										className="p-1 hover:bg-teal-100 rounded shrink-0"
									>
										<X className="w-4 h-4 text-ink-muted" />
									</button>
								</div>

								{/* Duration type note */}
								{durationType && (
									<p
										className={`mt-2 text-xs px-3 py-2 rounded-lg border ${DURATION_TYPE_COLORS[durationType]}`}
									>
										{DURATION_TYPE_NOTES[durationType]}
									</p>
								)}
							</div>
						) : (
							<div>
								<div className="flex gap-2">
									<div className="flex-1 relative">
										<input
											type="text"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											onKeyDown={handleSearchKeyDown}
											placeholder="Search listings by name..."
											className="w-full px-4 py-2.5 pl-10 border border-line rounded-xl text-sm
												focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
										/>
										<Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
									</div>
									<Button
										type="button"
										onClick={() => void handleSearch()}
										variant="secondary"
										loading={searching}
									>
										Search
									</Button>
								</div>

								{/* Search results */}
								{searchResults.length > 0 && (
									<div className="mt-2 border border-line rounded-xl overflow-hidden max-h-52 overflow-y-auto">
										{searchResults.map((listing) => (
											<button
												key={listing.id}
												type="button"
												onClick={() => selectListing(listing)}
												className="w-full flex items-center gap-3 p-3 hover:bg-surface-muted transition-colors text-left border-b border-line-muted last:border-0"
											>
												{listing.primaryImageThumbnail ? (
													<img
														src={listing.primaryImageThumbnail}
														alt=""
														className="w-10 h-10 rounded-lg object-cover shrink-0"
													/>
												) : (
													<div className="w-10 h-10 rounded-lg bg-surface-raised shrink-0" />
												)}
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-ink truncate">
														{listing.title}
													</p>
													<p className="text-xs text-ink-muted">
														{listing.destination} &bull;{' '}
														{listing.durationDisplay} &bull; NPR{' '}
														{Number(listing.pricePerPerson).toLocaleString('en-NP')}
													</p>
												</div>
												{/* Duration type chip in search results */}
												<span
													className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${DURATION_TYPE_COLORS[listing.durationType]}`}
												>
													{getDurationChipLabel(listing)}
												</span>
											</button>
										))}
									</div>
								)}
								{!searching && hasSearched && searchResults.length === 0 && (
									<p className="mt-2 text-sm text-red-500">
										No experiences found.
									</p>
								)}

								{searching && (
									<div className="mt-2 flex justify-center py-4">
										<Loader size="sm" text="Searching..." />
									</div>
								)}

								{errors.listingId && (
									<p className="text-xs text-red-500 mt-1">
										{errors.listingId.message}
									</p>
								)}
							</div>
						)}
						<input type="hidden" {...register('listingId', { valueAsNumber: true })} />
					</div>

					{/* ── Day Selector ── */}
					<div>
						<label className="block text-sm font-medium text-ink-secondary mb-1.5">
							Day
						</label>
						<select
							{...register('dayNumber', { valueAsNumber: true })}
							className="w-full px-4 py-2.5 border border-line rounded-xl text-sm
								focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
						>
							{Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
								const blocked = isDayUnavailable(d);
								return (
									<option key={d} value={d} disabled={blocked}>
										Day {d}
									</option>
								);
							})}
						</select>
						{errors.dayNumber && (
							<p className="text-xs text-red-500 mt-1">{errors.dayNumber.message}</p>
						)}
					</div>

					<div className="flex gap-3 pt-2">
						<Button
							type="button"
							variant="secondary"
							onClick={handleClose}
							disabled={submitting}
							fullWidth
						>
							Cancel
						</Button>
						<Button
							type="submit"
							loading={submitting}
							disabled={dayIsUnavailable}
							fullWidth
						>
							{isEdit ? 'Save Changes' : 'Add to Trip'}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AddExperienceModal;
