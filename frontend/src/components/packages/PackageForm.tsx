import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Image, Search, X } from 'lucide-react';
import { packageSchema, type PackageFormData } from '@utils/validators/packages';
import listingsService from '@services/listings.service';
import InputField from '@components/form/InputField';
import TextAreaField from '@components/form/TextAreaField';
import Dropdown from '@components/form/Dropdown';
import StringListInput from '@components/host-listings/StringListInput';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Loader from '@components/feedback/Loader';
import useApiSubmit from '@hooks/useApiSubmit';
import type { MyListing } from '@/types/listings';


const STATUS_OPTIONS = [
	{ value: 'false', label: 'Inactive (Draft)' },
	{ value: 'true', label: 'Active (Published)' },
] as const;


interface PackageFormProps {
	mode: 'create' | 'edit';
	initialValues?: Partial<PackageFormData>;
	initialSelectedListings?: {
		id: number;
		title: string;
		categoryDisplay: string;
		durationDisplay: string;
		pricePerPerson: string;
		isAvailableForPackage?: boolean;
		availabilityMessage?: string | null;
	}[];
	onSubmit: (data: PackageFormData) => Promise<void>;
	isSubmitting: boolean;
	submitError: string;
	publishIssue?: string | null;
	coverImageUrl?: string | null;
	onImageFileChange?: (file: File | null) => void;
	isUploadingImage?: boolean;
}

type PackageFormInput = Omit<PackageFormData, 'maxBookings'> & {
	maxBookings: PackageFormData['maxBookings'];
};


export default function PackageForm({
	mode,
	initialValues,
	initialSelectedListings = [],
	onSubmit,
	isSubmitting,
	submitError,
	publishIssue,
	coverImageUrl,
	onImageFileChange,
	isUploadingImage = false,
}: PackageFormProps) {
	const [hostListings, setHostListings] = useState<MyListing[]>([]);
	const [listingsLoading, setListingsLoading] = useState(true);
	const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
	const [listingSearch, setListingSearch] = useState('');
	const [isListingMenuOpen, setIsListingMenuOpen] = useState(false);
	const objectUrlRef = useRef<string | null>(null);
	const listingPickerRef = useRef<HTMLDivElement | null>(null);

	const previewUrl = localPreviewUrl ?? coverImageUrl ?? null;

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		const url = URL.createObjectURL(file);
		objectUrlRef.current = url;
		setLocalPreviewUrl(url);
		onImageFileChange?.(file);
		// Reset input so same file can be re-selected after removal
		e.target.value = '';
	};

	const handleImageRemove = () => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
		setLocalPreviewUrl(null);
		onImageFileChange?.(null);
	};

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting: formSubmitting },
	} = useForm<PackageFormInput, unknown, PackageFormData>({
		resolver: yupResolver(packageSchema),
		defaultValues: {
			durationNights: 0,
			maxGroupSize: 8,
			isBookable: false,
			tags: [],
			inclusions: [],
			listingIds: [],
			maxBookings: undefined,
			...initialValues,
		},
	});

	useEffect(() => {
		const load = async () => {
			try {
				const data = await listingsService.getMyListings({ isBookable: true });
				setHostListings(data.results);
			} finally {
				setListingsLoading(false);
			}
		};
		void load();
	}, []);

	useEffect(() => {
		const handlePointerDown = (event: MouseEvent) => {
			if (
				listingPickerRef.current &&
				!listingPickerRef.current.contains(event.target as Node)
			) {
				setIsListingMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		return () => document.removeEventListener('mousedown', handlePointerDown);
	}, []);

	const {
		apiError,
		submitting,
		handleSubmit: handleApiSubmit,
	} = useApiSubmit<PackageFormData>(async (data) => {
		await onSubmit(data);
	});

	const submitHandler = handleSubmit((data) => {
		void handleApiSubmit(data);
	});
	const loading = isSubmitting || formSubmitting || submitting;
	const displaySubmitError = submitError || apiError;

	return (
		<form
			onSubmit={(e) => void submitHandler(e)}
			className="max-w-5xl space-y-5"
		>
			{/* ── Section 1: Basic Information ───────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-4">Basic Information</h2>
				<div className="space-y-4">

					<Controller
						name="title"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Package Name"
								placeholder="e.g., Pokhara Adventure Combo"
								error={errors.title?.message}
								required
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="description"
						control={control}
						render={({ field }) => (
							<TextAreaField
								{...field}
								label="Package Description"
								placeholder="Describe what's included in this package..."
								rows={4}
								error={errors.description?.message}
								required
								disabled={loading}
							/>
						)}
					/>

				</div>
			</div>

			{/* ── Section 2: Cover Image ─────────────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-4">Cover Image</h2>

				<div className="flex items-center gap-4">
					{/* Thumbnail */}
					<div className="relative w-24 h-24 rounded-xl overflow-hidden border border-line bg-surface-muted shrink-0">
						{previewUrl ? (
							<img src={previewUrl} alt="Cover preview" className="w-full h-full object-cover" />
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<Image className="w-7 h-7 text-ink-muted" />
							</div>
						)}
						{isUploadingImage && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
								<Loader size="sm" />
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="space-y-2">
						<label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-line rounded-lg transition-colors text-ink ${loading || isUploadingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-muted'}`}>
							<input
								type="file"
								accept="image/*"
								className="sr-only"
								disabled={loading || isUploadingImage}
								onChange={handleImageChange}
							/>
							<Image className="w-3.5 h-3.5" />
							{previewUrl ? 'Change' : 'Upload Image'}
						</label>
						{previewUrl && (
							<button
								type="button"
								onClick={handleImageRemove}
								disabled={loading || isUploadingImage}
								className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
							>
								<X className="w-3.5 h-3.5" />
								Remove
							</button>
						)}
						<p className="text-xs text-ink-muted">JPG, PNG, WebP</p>
					</div>
				</div>
			</div>

			{/* ── Section 3: Select Listings ──────────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-1">
					Select Listings for Package *
				</h2>
				<p className="text-sm text-ink-muted mb-4">
					Choose 2 or more listings to include in this package
				</p>

				{listingsLoading ? (
					<Loader />
				) : hostListings.length === 0 && initialSelectedListings.length === 0 ? (
					<p className="text-sm text-ink-muted">
						No active listings found. Create and publish at least 2 listings first.
					</p>
				) : (
					<Controller
						name="listingIds"
						control={control}
						render={({ field }) => (
							<div className="space-y-3">
								{(() => {
									const selectedIds = field.value ?? [];
									const selectedListingMap = new Map<
										number,
										{
											id: number;
											title: string;
											categoryDisplay: string;
											durationDisplay: string;
											pricePerPerson: string;
											isAvailableForPackage: boolean;
											availabilityMessage: string | null;
										}
									>();

									hostListings.forEach((listing) => {
										selectedListingMap.set(listing.id, {
											id: listing.id,
											title: listing.title,
											categoryDisplay: listing.categoryDisplay,
											durationDisplay: listing.durationDisplay,
											pricePerPerson: listing.pricePerPerson,
											isAvailableForPackage: true,
											availabilityMessage: null,
										});
									});

									initialSelectedListings.forEach((listing) => {
										if (!selectedListingMap.has(listing.id)) {
											selectedListingMap.set(listing.id, {
												id: listing.id,
												title: listing.title,
												categoryDisplay: listing.categoryDisplay,
												durationDisplay: listing.durationDisplay,
												pricePerPerson: listing.pricePerPerson,
												isAvailableForPackage: listing.isAvailableForPackage ?? true,
												availabilityMessage: listing.availabilityMessage ?? null,
											});
										}
									});

									const selectedListings = selectedIds.map(
										(id) =>
											selectedListingMap.get(id) ?? {
												id,
												title: `Listing #${id}`,
												categoryDisplay: 'Listing',
												durationDisplay: 'Unavailable',
												pricePerPerson: '0',
												isAvailableForPackage: false,
												availabilityMessage: 'This listing is no longer available.',
											},
									);

									const filteredListings = hostListings.filter((listing) => {
										if (selectedIds.includes(listing.id)) return false;
										const query = listingSearch.trim().toLowerCase();
										if (!query) return true;
										return (
											listing.title.toLowerCase().includes(query) ||
											listing.categoryDisplay.toLowerCase().includes(query) ||
											listing.destination.toLowerCase().includes(query)
										);
									});

									const addListing = (listingId: number) => {
										field.onChange([...(field.value ?? []), listingId]);
										setListingSearch('');
										setIsListingMenuOpen(false);
									};

									const removeListing = (listingId: number) => {
										field.onChange(
											(field.value ?? []).filter((id) => id !== listingId),
										);
									};

									return (
										<>
											<div ref={listingPickerRef} className="relative">
												<label className="block text-xs font-semibold text-ink-secondary mb-1">
													Search and add listings
												</label>
												<div className="relative">
													<span className="absolute inset-y-0 left-0 flex items-center pl-4 text-ink-muted">
														<Search size={18} />
													</span>
													<input
														type="text"
														value={listingSearch}
														onChange={(e) => {
															setListingSearch(e.target.value);
															setIsListingMenuOpen(true);
														}}
														onFocus={() => setIsListingMenuOpen(true)}
														placeholder="Search by listing name, category, or destination"
														disabled={loading}
														className="w-full rounded-xl border-2 border-line bg-surface-muted py-2.5 pl-11 pr-4 text-ink transition-all focus:border-brand focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
													/>
												</div>

												{isListingMenuOpen && (
													<div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
														{filteredListings.length > 0 ? (
															filteredListings.map((listing) => (
																<button
																	key={listing.id}
																	type="button"
																	onClick={() => addListing(listing.id)}
																	className="flex w-full items-start justify-between gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-muted"
																	disabled={loading}
																>
																	<div className="min-w-0">
																		<div className="truncate text-sm font-semibold text-ink">
																			{listing.title}
																		</div>
																		<div className="mt-0.5 text-xs text-ink-muted">
																			{listing.categoryDisplay} • {listing.destination} •{' '}
																			{listing.durationDisplay}
																		</div>
																	</div>
																	<div className="shrink-0 text-xs font-medium text-teal-700">
																		NPR {Number(listing.pricePerPerson).toLocaleString()}
																	</div>
																</button>
															))
														) : (
															<p className="px-4 py-3 text-sm text-ink-muted">
																No matching listings found.
															</p>
														)}
													</div>
												)}
											</div>

											<div className="rounded-xl border border-dashed border-line bg-surface-muted/60 p-3">
												<div className="mb-2 flex items-center justify-between gap-3">
													<p className="text-sm font-semibold text-ink">
														Selected listings ({selectedListings.length})
													</p>
													<p className="text-xs text-ink-muted">
														At least 2 required
													</p>
												</div>

												{selectedListings.length === 0 ? (
													<p className="text-sm text-ink-muted">
														Search above and add listings to build this package.
													</p>
												) : (
													<div className="space-y-2.5">
														{selectedListings.map((listing) => (
															<div
																key={listing.id}
																className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
																	listing.isAvailableForPackage
																		? 'border-line bg-surface'
																		: 'border-amber-200 bg-amber-50'
																}`}
															>
																<div className="min-w-0">
																	<div className="flex flex-wrap items-center gap-2">
																		<p className="text-sm font-semibold text-ink">
																			{listing.title}
																		</p>
																		{!listing.isAvailableForPackage && (
																			<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
																				Unavailable
																			</span>
																		)}
																	</div>
																	<p className="mt-0.5 text-xs text-ink-muted">
																		{listing.categoryDisplay} • {listing.durationDisplay} • NPR{' '}
																		{Number(listing.pricePerPerson).toLocaleString()}
																	</p>
																	{listing.availabilityMessage && (
																		<p className="mt-1 text-xs text-amber-700">
																			{listing.availabilityMessage}
																		</p>
																	)}
																</div>

																<button
																	type="button"
																	onClick={() => removeListing(listing.id)}
																	disabled={loading}
																	className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
																>
																	<X className="h-3.5 w-3.5" />
																	Remove
																</button>
															</div>
														))}
													</div>
												)}
											</div>
										</>
									);
								})()}
							</div>
						)}
					/>
				)}

				{errors.listingIds && (
					<p className="text-red-500 text-xs mt-2">{errors.listingIds.message}</p>
				)}
			</div>

			{/* ── Section 4: Pricing & Discount ──────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-4">Pricing & Discount</h2>
				<div className="grid sm:grid-cols-2 gap-4">

					<div>
						<Controller
							name="totalPrice"
							control={control}
							render={({ field }) => (
								<InputField
									{...field}
									type="number"
									label="Package Price (NPR)"
									placeholder="24055"
									error={errors.totalPrice?.message}
									required
									disabled={loading}
								/>
							)}
						/>
						<p className="text-xs text-ink-muted mt-1">Per-person, all-inclusive package price</p>
					</div>

					<div>
						<Controller
							name="discountLabel"
							control={control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Discount Label"
									placeholder="e.g., 15% OFF"
									maxLength={20}
									error={errors.discountLabel?.message}
									disabled={loading}
								/>
							)}
						/>
						<p className="text-xs text-ink-muted mt-1">Display string only — max 20 chars</p>
					</div>

				</div>
			</div>

			{/* ── Section 5: Duration & Validity ─────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-4">Duration & Validity</h2>
				<div className="grid sm:grid-cols-3 gap-4">

					<Controller
						name="durationDays"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								type="number"
								label="Total Days"
								placeholder="5"
								min={1}
								value={field.value ?? ''}
								onChange={(e) => field.onChange(e.target.valueAsNumber)}
								error={errors.durationDays?.message}
								required
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="durationNights"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								type="number"
								label="Total Nights"
								placeholder="4"
								min={0}
								value={field.value ?? ''}
								onChange={(e) => field.onChange(e.target.valueAsNumber)}
								error={errors.durationNights?.message}
								required
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="maxGroupSize"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								type="number"
								label="Max Group Size"
								placeholder="8"
								min={1}
								value={field.value ?? ''}
								onChange={(e) => field.onChange(e.target.valueAsNumber)}
								error={errors.maxGroupSize?.message}
								required
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="validFrom"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								type="date"
								label="Valid From"
								value={field.value ?? ''}
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="validUntil"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								type="date"
								label="Valid Until"
								value={field.value ?? ''}
								error={errors.validUntil?.message}
								disabled={loading}
							/>
						)}
					/>

					<div>
						<Controller
							name="maxBookings"
							control={control}
							render={({ field }) => (
								<InputField
									{...field}
									type="number"
									label="Max Bookings"
									placeholder="50"
									min={1}
									value={field.value ?? ''}
									onChange={(e) => field.onChange(
										e.target.value === '' ? null : e.target.valueAsNumber,
									)}
									error={errors.maxBookings?.message}
									disabled={loading}
								/>
							)}
						/>
						<p className="text-xs text-ink-muted mt-1">Leave empty for unlimited</p>
					</div>

				</div>
			</div>

			{/* ── Section 6: Additional Details ──────────────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5">
				<h2 className="section-heading text-ink mb-4">Additional Details</h2>
				<div className="space-y-4">

					<Controller
						name="highlights"
						control={control}
						render={({ field }) => (
							<TextAreaField
								{...field}
								label="Package Highlights"
								placeholder="Key highlights of this package..."
								rows={3}
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="termsAndConditions"
						control={control}
						render={({ field }) => (
							<TextAreaField
								{...field}
								label="Terms & Conditions"
								placeholder="Package terms, cancellation policy, etc..."
								rows={3}
								disabled={loading}
							/>
						)}
					/>

					<Controller
						name="tags"
						control={control}
						render={({ field }) => (
							<StringListInput
								label="Tags"
								value={field.value ?? []}
								onChange={field.onChange}
								placeholder="Add a tag (e.g. Adventure, Nature)"
								error={errors.tags?.message}
								max={15}
							/>
						)}
					/>

					<Controller
						name="inclusions"
						control={control}
						render={({ field }) => (
							<StringListInput
								label="Inclusions"
								value={field.value ?? []}
								onChange={field.onChange}
								placeholder="Add an inclusion (e.g. Breakfast, Guide)"
								error={errors.inclusions?.message}
								max={20}
							/>
						)}
					/>

					<div>
						<Controller
							name="isBookable"
							control={control}
							render={({ field }) => (
								<Dropdown
									label="Package Status"
									name={field.name}
									options={STATUS_OPTIONS}
									value={String(field.value)}
									onChange={(val) => field.onChange(val === 'true')}
									error={errors.isBookable?.message}
									required
									disabled={loading}
								/>
							)}
						/>
						{publishIssue ? (
							<p className="text-xs text-amber-600 mt-1 font-medium">
								{publishIssue}
							</p>
						) : (
							<p className="text-xs text-ink-muted mt-1">
								Publishing requires ≥ 2 listings to be selected
							</p>
						)}
					</div>

				</div>
			</div>

			{/* ── Submit Error Banner ─────────────────────────────────────── */}
			{displaySubmitError && (
				<FormErrorBanner>{displaySubmitError}</FormErrorBanner>
			)}

			{/* ── Action Buttons ──────────────────────────────────────────── */}
			<div className="flex gap-3">
				<Button
					type="button"
					variant="secondary"
					onClick={() => window.history.back()}
					disabled={loading}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					fullWidth
					loading={loading}
				>
					{mode === 'create' ? 'Create Package' : 'Save Changes'}
				</Button>
			</div>

		</form>
	);
}
