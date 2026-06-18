import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Plus, X, ImageIcon } from 'lucide-react';
import {
	createListingSchema,
	type CreateListingFormData,
} from '@utils/validators';
import InputField from '@components/form/InputField';
import TextAreaField from '@components/form/TextAreaField';
import Dropdown from '@components/form/Dropdown';
import Checkbox from '@components/form/Checkbox';
import ToggleButtonGroup from '@components/form/ToggleButtonGroup';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import useApiSubmit from '@hooks/useApiSubmit';
import ListingImageUpload from '@components/host-listings/ListingImageUpload';
import MediaUploader from '@components/host-listings/MediaUploader';
import {
	CATEGORY_OPTIONS,
	ACTIVITY_TYPE_OPTIONS,
	DIFFICULTY_OPTIONS,
	IDEAL_FOR_OPTIONS,
	CANCELLATION_POLICY_OPTIONS,
	BEST_SEASON_OPTIONS,
} from '@/types/listings';
import type { ListingImage } from '@/types/listings';


// ─── Props ──────────────────────────────────────────────

interface ListingFormProps {
	mode: 'create' | 'edit';
	initialValues?: Partial<CreateListingFormData>;
	onSubmit: (data: CreateListingFormData) => Promise<boolean>;
	apiError?: string;
	clearError?: () => void;
	submitting?: boolean;
	submitDisabled?: boolean;
	cancelTo?: string;
	/** Create mode only */
	createImageFiles?: File[];
	createPrimaryImageIndex?: number;
	onCreateImagesChange?: (files: File[]) => void;
	onCreatePrimaryImageChange?: (index: number) => void;
	/** Edit mode only */
	images?: ListingImage[];
	listingId?: number;
	onImagesChange?: () => void;
}


// ─── Defaults ───────────────────────────────────────────

const CREATE_DEFAULTS: CreateListingFormData = {
	title: '',
	description: '',
	destination: '',
	location: '',
	category: '',
	activityType: '',
	pricePerPerson: '',
	durationDays: 0,
	durationNights: 0,
	difficultyLevel: '',
	idealFor: [],
	tags: [],
	maxGroupSize: 10,
	minGroupSize: 1,
	whatToBring: '',
	requirements: '',
	inclusions: [],
	exclusions: [],
	cancellationPolicy: 'moderate',
	languagesOffered: [],
	bestSeasons: [],
	instantBooking: false,
};


// ─── Inline helper: add/remove list input ───────────────

interface ListInputProps {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
    max: number;
    placeholder?: string;
    error?: string;
}

const ListInput = ({ label, values, onChange, max, placeholder, error }: ListInputProps) => {
    const [inputValue, setInputValue] = useState('');

    const addItem = () => {
		const trimmed = inputValue.trim().toLowerCase();
		if (!trimmed || values.length >= max || values.includes(trimmed)) return;
		onChange([...values, trimmed]);
		setInputValue('');
	};

    const removeItem = (index: number) => {
		onChange(values.filter((_, i) => i !== index));
	};

    return (
        <div className="w-full">
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
				{label}
			</label>

            <div className="flex gap-2 mb-2">
                <input
					type="text"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addItem();
						}
					}}
					placeholder={placeholder}
					className="flex-1 border-2 border-line rounded-xl py-2 px-3 text-sm
						focus:outline-none focus:border-teal-600 bg-surface-muted focus:bg-surface"
				/>

                <button
					type="button"
					onClick={addItem}
					disabled={values.length >= max}
					className="p-2 rounded-xl border-2 border-line text-ink-muted hover:text-teal-600
						hover:border-teal-600 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<Plus className="w-4 h-4" />
				</button>
            </div>
            {values.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{values.map((item, i) => (
						<span
							key={i}
							className="inline-flex items-center gap-1 bg-surface-muted text-ink-secondary
								text-xs font-medium px-2.5 py-1 rounded-full"
						>
							{item}
							<button
								type="button"
								onClick={() => removeItem(i)}
								className="text-ink-muted hover:text-red-500"
							>
								<X className="w-3 h-3" />
							</button>
						</span>
					))}
				</div>
			)}
            { error && <p className="text-red-500 text-xs mt-1">{ error }</p>}
        </div>
    );
};


// ─── Main Component ─────────────────────────────────────

const ListingForm = ({
    mode, 
    initialValues,
    onSubmit,
    apiError = '',
    clearError = () => {},
    submitting = false,
    submitDisabled = false,
	cancelTo,
	createImageFiles,
	createPrimaryImageIndex = 0,
	onCreateImagesChange,
	onCreatePrimaryImageChange,
    images,
    listingId,
    onImagesChange,
}: ListingFormProps) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<CreateListingFormData>({
        resolver: yupResolver(createListingSchema),
        defaultValues: { ...CREATE_DEFAULTS, ...initialValues},
    });

    const {
		apiError: submitApiError,
		submitting: apiSubmitting,
		handleSubmit: handleApiSubmit,
		clearError: clearSubmitError,
	} = useApiSubmit<CreateListingFormData>(async (data) => {
		const ok = await onSubmit(data);
		if (!ok) {
			throw new Error('Failed to submit listing');
		}
	});

	    const loading = isSubmitting || submitting || apiSubmitting;
	const isSubmitDisabled = loading || submitDisabled;
	const displayApiError = apiError || submitApiError;

    const submitForm = (data: CreateListingFormData) => {
		clearError();
		clearSubmitError();
		void handleApiSubmit(data);
    };

    const submitHandler = handleSubmit(submitForm);

    return (
        <form
			onSubmit={(e) => void submitHandler(e)}
			className="max-w-5xl"
		>
            {displayApiError && (
				<div className="mb-5">
					<FormErrorBanner>{displayApiError}</FormErrorBanner>
				</div>
			)}

            {/* ── Section: Basic Information ──────────────── */}
            <div className="bg-surface rounded-xl border border-line p-5 mb-5">
                <h2 className="section-heading text-ink mb-4">
                    Basic Information
                </h2>
                <div className="space-y-4">
                    {/* Title */}
                    <Controller
						name="title"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Listing Title"
								placeholder="e.g., Ghorepani Poon Hill Trek"
								error={errors.title?.message}
								required
							/>
						)}
					/>

                    {/* Category + Activity Type */}
					<div className="grid sm:grid-cols-2 gap-4">
                        
                        {/* Category  */}
                        <Controller
							name="category"
							control={control}
							render={({ field }) => (
								<Dropdown
									label="Category"
									options={CATEGORY_OPTIONS}
									value={field.value}
									onChange={field.onChange}
									name={field.name}
									error={errors.category?.message}
									placeholder="Select a category"
									required
								/>
							)}
						/>

                        {/* Activity Type  */}
                        <Controller
							name="activityType"
							control={control}
							render={({ field }) => (
								<Dropdown
									label="Activity Type"
									options={ACTIVITY_TYPE_OPTIONS}
									value={field.value}
									onChange={field.onChange}
									name={field.name}
									error={errors.activityType?.message}
									placeholder="Select an activity"
									required
								/>
							)}
						/>
                    </div>

                    {/* Destination + Location */}
                    <div className="grid sm:grid-cols-2 gap-4">

                        {/* Destination  */}
                        <Controller
							name="destination"
							control={control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Destination"
									placeholder="e.g., Pokhara"
									error={errors.destination?.message}
									required
								/>
							)}
						/>

                        {/* Location  */}
                        <Controller
							name="location"
							control={control}
							render={({ field }) => (
								<InputField
									{...field}
									label="Meeting Point / Location"
									placeholder="e.g., Lakeside, Pokhara"
									error={errors.location?.message}
									required
								/>
							)}
						/>
                    </div>

                    {/* Description  */}
                    <Controller
						name="description"
						control={control}
						render={({ field }) => (
							<TextAreaField
								{...field}
								label="Description"
								placeholder="Describe your experience in detail (min. 50 characters)..."
								rows={5}
								error={errors.description?.message}
								required
							/>
						)}
					/>
                </div>
            </div>

            {/* ── Section: Pricing & Duration ─────────────── */}
            <div className="bg-surface rounded-xl border border-line p-5 mb-5">
                <h2 className="section-heading text-ink mb-4">
                    Pricing & Duration
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">

                    {/* Price per Person  */}
                    <Controller
						name="pricePerPerson"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								label="Price (NPR)"
								type="number"
								placeholder="8500"
								error={errors.pricePerPerson?.message}
								required
							/>
						)}
					/>

                    {/* Min Group Size  */}
                    <Controller
						name="minGroupSize"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								value={String(field.value)}
								onChange={(e) => field.onChange(Number(e.target.value))}
								label="Min Group"
								type="number"
								placeholder="1"
								error={errors.minGroupSize?.message}
							/>
						)}
					/>

                    {/* Max Group Size  */}
                    <Controller
						name="maxGroupSize"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								value={String(field.value)}
								onChange={(e) => field.onChange(Number(e.target.value))}
								label="Max Group"
								type="number"
								placeholder="10"
								error={errors.maxGroupSize?.message}
							/>
						)}
					/>

                    {/* Duration Days  */}
                    <Controller
						name="durationDays"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								value={String(field.value)}
								onChange={(e) => field.onChange(Number(e.target.value))}
								label="Days"
								type="number"
								placeholder="3"
								error={errors.durationDays?.message}
								required
							/>
						)}
					/>

                    {/* Duration Nights  */}
                    <Controller
						name="durationNights"
						control={control}
						render={({ field }) => (
							<InputField
								{...field}
								value={String(field.value)}
								onChange={(e) => field.onChange(Number(e.target.value))}
								label="Nights"
								type="number"
								placeholder="2"
								error={errors.durationNights?.message}
								required
							/>
						)}
					/>
                </div>
            </div>

            {/* ── Two-column layout ───────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-5 mb-5">
                
                {/* Left column */}
                <div className="space-y-5">
                    {/* Availability */}
					<div className="bg-surface rounded-xl border border-line p-5">
                        <h2 className="section-heading text-ink mb-4">
                            Availability
                        </h2>

                        <div className="space-y-4">
                            {/* Best Seasons  */}
                            <Controller
								name="bestSeasons"
								control={control}
								render={({ field }) => (
									<ToggleButtonGroup
										label="Best Seasons"
										options={BEST_SEASON_OPTIONS.map((o) => o.label)}
										value={(field.value ?? []).map(
											(v) =>
												BEST_SEASON_OPTIONS.find((o) => o.value === v)
													?.label ?? v,
										)}
										onChange={(labels) =>
											field.onChange(
												labels.map(
													(l) =>
														BEST_SEASON_OPTIONS.find(
															(o) => o.label === l,
														)?.value ?? l,
												),
											)
										}
										error={errors.bestSeasons?.message}
									/>
								)}
							/>
                        </div>
                    </div>

                    {/* Additional Details */}
                    <div className="bg-surface rounded-xl border border-line p-5">
                        <h2 className="section-heading text-ink mb-4">
                            Additional Details 
                        </h2>
                        <div className="space-y-4">
                            
                            {/* Difficulty Level */}
                            <Controller
								name="difficultyLevel"
								control={control}
								render={({ field }) => (
									<Dropdown
										label="Difficulty Level"
										options={DIFFICULTY_OPTIONS}
										value={field.value}
										onChange={field.onChange}
										name={field.name}
										placeholder="Select difficulty"
										error={errors.difficultyLevel?.message}
									/>
								)}
							/>

                            {/* Ideal For  */}
                            <Controller
								name="idealFor"
								control={control}
								render={({ field }) => (
									<ToggleButtonGroup
										label="Ideal For"
										options={IDEAL_FOR_OPTIONS.map((o) => o.label)}
										value={(field.value ?? []).map(
											(v) =>
												IDEAL_FOR_OPTIONS.find((o) => o.value === v)
													?.label ?? v,
										)}
										onChange={(labels) =>
											field.onChange(
												labels.map(
													(l) =>
														IDEAL_FOR_OPTIONS.find(
															(o) => o.label === l,
														)?.value ?? l,
												),
											)
										}
										error={errors.idealFor?.message}
									/>
								)}
							/>

                            {/* Requirements  */}
                            <Controller
								name="requirements"
								control={control}
								render={({ field }) => (
									<TextAreaField
										{...field}
										label="Requirements"
										placeholder="Any fitness, age, or gear requirements..."
										rows={3}
										error={errors.requirements?.message}
									/>
								)}
							/>

                            {/* What to Bring  */}
                            <Controller
								name="whatToBring"
								control={control}
								render={({ field }) => (
									<TextAreaField
										{...field}
										label="What to Bring"
										placeholder="Comfortable clothing, sunscreen, camera..."
										rows={3}
										error={errors.whatToBring?.message}
									/>
								)}
							/>
                        </div>
                    </div>
                </div>


                {/* Right column */}
                <div className="space-y-5">

                    {/* Inclusions & Exclusions */}
					<div className="bg-surface rounded-xl border border-line p-5">
                        <h2 className="section-heading text-ink mb-4">
                            What's Included / Excluded
                        </h2>

                        <div className="space-y-4">

                            {/* Inclusions  */}
                            <Controller
								name="inclusions"
								control={control}
								render={({ field }) => (
									<ListInput
										label="Inclusions"
										values={field.value ?? []}
										onChange={field.onChange}
										max={20}
										placeholder="e.g., Licensed guide"
										error={errors.inclusions?.message}
									/>
								)}
							/>

                            {/* Exclusions  */}
                            <Controller
								name="exclusions"
								control={control}
								render={({ field }) => (
									<ListInput
										label="Exclusions"
										values={field.value ?? []}
										onChange={field.onChange}
										max={20}
										placeholder="e.g., Travel insurance"
										error={errors.exclusions?.message}
									/>
								)}
							/>
                        </div>
                    </div>

	                    {/* Images */}
						<div className="bg-surface rounded-xl border border-line p-5">
	                        <h2 className="section-heading text-ink mb-4">
								Images
							</h2>

	                        {mode === 'edit' && listingId && onImagesChange ? (
								<MediaUploader
									listingId={listingId}
									images={images ?? []}
									onImagesChange={onImagesChange}
									disabled={loading}
								/>
							) : mode === 'create' && createImageFiles && onCreateImagesChange && onCreatePrimaryImageChange ? (
								<ListingImageUpload
									files={createImageFiles}
									onChange={onCreateImagesChange}
									primaryIndex={createPrimaryImageIndex}
									onPrimaryChange={onCreatePrimaryImageChange}
								/>
							) : (
								<div className="border-2 border-dashed border-line rounded-lg p-6 text-center">
									<ImageIcon className="w-10 h-10 mx-auto text-ink-muted mb-2" />
								<p className="text-sm text-ink-muted mb-1">
									Images can be uploaded after creating the listing
								</p>
								<p className="text-xs text-ink-muted">
									You'll need at least 1 image to activate it
								</p>
							</div>
						)}
                    </div>
                </div>
            </div>


            {/* ── Section: Cancellation Policy ────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5 mb-5">
				<h2 className="section-heading text-ink mb-4">
					Cancellation Policy
				</h2>
				<Controller
					name="cancellationPolicy"
					control={control}
					render={({ field }) => (
						<Dropdown
							label="Policy"
							options={CANCELLATION_POLICY_OPTIONS}
							value={field.value}
							onChange={field.onChange}
							name={field.name}
							error={errors.cancellationPolicy?.message}
						/>
					)}
				/>
			</div>


            {/* ── Section: More Options ───────────────────── */}
			<div className="bg-surface rounded-xl border border-line p-5 mb-5">
                <h2 className="section-heading text-ink mb-4">
					More Options
				</h2>

                <div className="space-y-4">

                    {/* Tags  */}
                    <Controller
						name="tags"
						control={control}
						render={({ field }) => (
							<ListInput
								label="Tags"
								values={field.value ?? []}
								onChange={field.onChange}
								max={15}
								placeholder="e.g., sunrise, adventure"
								error={errors.tags?.message}
							/>
						)}
					/>

                    {/* Languages Offered  */}
                    <Controller
						name="languagesOffered"
						control={control}
						render={({ field }) => (
							<ListInput
								label="Languages Offered"
								values={field.value ?? []}
								onChange={field.onChange}
								max={10}
								placeholder="e.g., english"
								error={errors.languagesOffered?.message}
							/>
						)}
					/>

                    {/* Instant Booking  */}
                    <Controller
						name="instantBooking"
						control={control}
						render={({ field }) => (
							<label className="flex items-center gap-3 cursor-pointer">
								<Checkbox
									checked={field.value}
									onChange={field.onChange}
									className="focus:ring-teal-500"
								/>
								<span className="text-sm font-medium text-ink-secondary">
									Enable Instant Booking
								</span>
							</label>
						)}
					/>
                </div>
            </div>

	            {/* ── Action Buttons ──────────────────────────── */}
	            <div className="flex gap-3">
					{cancelTo && (
						<Link to={cancelTo}>
							<Button type="button" variant="secondary">
								Cancel
							</Button>
						</Link>
					)}
					<Button
						type="submit"
						variant="primary"
						loading={loading}
						disabled={isSubmitDisabled}
						className={cancelTo ? 'flex-1' : undefined}
					>
						{mode === 'create'
							? loading
							? 'Creating...'
							: 'Create Listing'
						: loading
							? 'Saving...'
							: 'Save Changes'}
				</Button>
			</div>
        </form>
    );
};

export default ListingForm;
