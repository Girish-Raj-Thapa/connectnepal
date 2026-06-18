// ─── Enum Types ─────────────────────────────────────────

export type ListingCategory = 
    | 'adventure' | 'cultural' | 'nature' | 'food_tours'
	| 'wellness' | 'photography' | 'trekking' | 'heritage'
	| 'village' | 'festival';

export type ActivityType =
	| 'hiking' | 'trekking' | 'rafting' | 'paragliding'
	| 'bungee' | 'cycling' | 'temple_visit' | 'cooking_class'
	| 'meditation' | 'yoga' | 'wildlife_safari' | 'bird_watching'
	| 'city_tour' | 'homestay' | 'mountain_flight';

export type DifficultyLevel =
	| 'easy' | 'moderate' | 'challenging' | 'difficult' | 'expert';

export type IdealFor =
	| 'solo' | 'couples' | 'families' | 'groups'
	| 'seniors' | 'adventure_seekers';

export type CancellationPolicy =
	| 'flexible' | 'moderate' | 'strict' | 'non_refundable';

export type BookableFilter = 'all' | 'active' | 'inactive';

export type BestSeason =
	| 'spring' | 'summer' | 'autumn' | 'winter' | 'year_round';

export type ListingAction = 'edit' | 'manageSlots' | 'toggleBookable' | 'delete';

export type DurationType = 'hourly' | 'full_day' | 'multi_day';
    

// ─── Dropdown/Toggle Option Arrays ──────────────────────

export const CATEGORY_OPTIONS: readonly { value: ListingCategory; label: string }[] = [
	{ value: 'adventure', label: 'Adventure' },
	{ value: 'cultural', label: 'Cultural' },
	{ value: 'nature', label: 'Nature & Wildlife' },
	{ value: 'food_tours', label: 'Food Tours' },
	{ value: 'wellness', label: 'Wellness & Spiritual' },
	{ value: 'photography', label: 'Photography Tours' },
	{ value: 'trekking', label: 'Trekking & Hiking' },
	{ value: 'heritage', label: 'Heritage Tours' },
	{ value: 'village', label: 'Village Experiences' },
	{ value: 'festival', label: 'Festival & Events' },
] as const;

export const ACTIVITY_TYPE_OPTIONS: readonly { value: ActivityType; label: string }[] = [
	{ value: 'hiking', label: 'Hiking' },
	{ value: 'trekking', label: 'Trekking' },
	{ value: 'rafting', label: 'Rafting' },
	{ value: 'paragliding', label: 'Paragliding' },
	{ value: 'bungee', label: 'Bungee Jumping' },
	{ value: 'cycling', label: 'Cycling' },
	{ value: 'temple_visit', label: 'Temple Visit' },
	{ value: 'cooking_class', label: 'Cooking Class' },
	{ value: 'meditation', label: 'Meditation' },
	{ value: 'yoga', label: 'Yoga Retreat' },
	{ value: 'wildlife_safari', label: 'Wildlife Safari' },
	{ value: 'bird_watching', label: 'Bird Watching' },
	{ value: 'city_tour', label: 'City Tour' },
	{ value: 'homestay', label: 'Homestay Experience' },
	{ value: 'mountain_flight', label: 'Mountain Flight' },
] as const;

export const DIFFICULTY_OPTIONS: readonly { value: DifficultyLevel; label: string }[] = [
	{ value: 'easy', label: 'Easy' },
	{ value: 'moderate', label: 'Moderate' },
	{ value: 'challenging', label: 'Challenging' },
	{ value: 'difficult', label: 'Difficult' },
	{ value: 'expert', label: 'Expert Only' },
] as const;

export const IDEAL_FOR_OPTIONS: readonly { value: IdealFor; label: string }[] = [
	{ value: 'solo', label: 'Solo Travelers' },
	{ value: 'couples', label: 'Couples' },
	{ value: 'families', label: 'Families' },
	{ value: 'groups', label: 'Groups' },
	{ value: 'seniors', label: 'Seniors' },
	{ value: 'adventure_seekers', label: 'Adventure Seekers' },
] as const;

export const CANCELLATION_POLICY_OPTIONS: readonly { value: CancellationPolicy; label: string }[] = [
	{ value: 'flexible', label: 'Flexible — Free cancellation up to 24 hours before' },
	{ value: 'moderate', label: 'Moderate — Free cancellation up to 3 days before' },
	{ value: 'strict', label: 'Strict — 50% refund up to 7 days before' },
	{ value: 'non_refundable', label: 'Non-Refundable — No refunds' },
] as const;

export const BEST_SEASON_OPTIONS: readonly { value: BestSeason; label: string }[] = [
	{ value: 'spring', label: 'Spring (Mar–May)' },
	{ value: 'summer', label: 'Summer/Monsoon (Jun–Aug)' },
	{ value: 'autumn', label: 'Autumn (Sep–Nov)' },
	{ value: 'winter', label: 'Winter (Dec–Feb)' },
	{ value: 'year_round', label: 'Year Round' },
] as const;

export const BOOKABLE_FILTER_OPTIONS: readonly { value: BookableFilter; label: string }[] = [
	{ value: 'all', label: 'All Listings' },
	{ value: 'active', label: 'Active' },
	{ value: 'inactive', label: 'Inactive' },
] as const;


// ─── API Response Interfaces ────────────────────────────

export interface ListingImage {
    id: number;
    imageUrl: string;
    thumbnailUrl: string;
    isPrimary: boolean;
    caption: string;
    altText: string;
    order: number;
    uploadedAt: string;
}

export interface ListingHost {
    userId: number;
	businessName: string;
	fullName: string;
	profilePhotoUrl: string | null;
	isVerified: boolean;
	verificationStatus: string;
	hostSince: string;
}


/** Each item from GET /api/listings/host/ */
export interface MyListing {
    id: number;
    slug: string;
	title: string;
	destination: string;
	category: ListingCategory;
	categoryDisplay: string;
	pricePerPerson: string;
	durationDays: number;
	durationNights: number;
	durationDisplay: string;
	ratingAverage: string;
	ratingCount: number;
	isBookable: boolean;
	instantBooking: boolean;
	primaryImageThumbnail: string | null;
	bookingCount: number | string;
	createdAt: string;
	updatedAt: string;
}


/** Full listing detail — returned by create/update/get-by-id */
export interface ListingDetail {
	id: number;
	slug: string;
	host: ListingHost;
	images: ListingImage[];
	title: string;
	description: string;
	destination: string;
	location: string;
	category: ListingCategory;
	categoryDisplay: string;
	activityType: ActivityType;
	activityTypeDisplay: string;
	difficultyLevel: DifficultyLevel;
	difficultyLevelDisplay: string;
	idealFor: IdealFor[];
	pricePerPerson: string;
	durationDays: number;
	durationNights: number;
	durationType: DurationType;
	averageDurationHours: string;
	durationDisplay: string;
	totalHours: number;
	tags: string[];
	ratingAverage: string;
	ratingCount: number;
	bestSeasons: BestSeason[];
	bestSeasonsDisplay: string[];
	isBookable: boolean;
	isActive?: boolean;
	maxGroupSize: number;
	minGroupSize: number;
	whatToBring: string;
	requirements: string;
	inclusions: string[];
	exclusions: string[];
	cancellationPolicy: CancellationPolicy;
	cancellationPolicyDisplay: string;
	languagesOffered: string[];
	instantBooking: boolean;
	hostName: string;
	createdAt: string;
	updatedAt: string;
}


/** Django PageNumberPagination wrapper */
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}


/** POST /api/listings/host/create/ request body */
export interface CreateListingRequest {
	title: string;
	description: string;
	destination: string;
	location: string;
	category: ListingCategory;
	activityType: ActivityType;
	pricePerPerson: string;
	durationDays: number;
	durationNights: number;
	difficultyLevel?: DifficultyLevel;
	idealFor?: IdealFor[];
	tags?: string[];
	maxGroupSize?: number;
	minGroupSize?: number;
	whatToBring?: string;
	requirements?: string;
	inclusions?: string[];
	exclusions?: string[];
	cancellationPolicy?: CancellationPolicy;
	languagesOffered?: string[];
	bestSeasons?: BestSeason[];
	instantBooking?: boolean;
}


/** PATCH /api/listings/host/<id>/ — all fields optional */
export type UpdateListingRequest = Partial<CreateListingRequest> & {
	isBookable?: boolean;
	isActive?: boolean;
};


/** GET /api/listings/host/limits/ response */
export interface HostLimits {
	isVerified: boolean;
	canCreate: boolean;
	listingsUsed: number | null;
	listingsLimit: number | null;
	transactionLimit: string | null;
}

/** Query params for getMyListings */
export interface MyListingsParams {
	isBookable?: boolean;
	search?: string;
	category?: ListingCategory;
	ordering?: string;
	page?: number;
}


// ─── Public Browse Card ─────────────────────────────────
// Each item from GET /api/listings/ (public browse)
// Different shape from MyListing (host manage table)
export interface PublicListing {
	id: number;
	slug: string;
	title: string;
	shortDescription: string;
	destination: string;
	category: ListingCategory;
	categoryDisplay: string;
	activityType: ActivityType;
	difficultyLevel: DifficultyLevel;
	difficultyDisplay: string;
	pricePerPerson: string;
	durationType: DurationType;
	averageDurationHours: string | null;
	durationDays: number;
	durationNights: number;
	durationDisplay: string;
	ratingAverage: string;
	ratingCount: number;
	hostName: string;
	hostIsVerified: boolean;
	instantBooking: boolean;
	primaryImageThumbnail: string | null;
	position?: number;
}

export interface RecommendationListing {
	id: number;
	slug: string;
	title: string;
	shortDescription: string;
	destination: string;
	category: ListingCategory;
	categoryDisplay: string;
	difficultyLevel: DifficultyLevel;
	difficultyDisplay: string;
	pricePerPerson: string;
	durationType: DurationType;
	durationDays: number;
	durationNights: number;
	durationDisplay: string;
	ratingAverage: string;
	ratingCount: number;
	instantBooking: boolean;
	hostName: string;
	hostIsVerified: boolean;
	primaryImageThumbnail: string | null;
	position: number;
}

export interface ListingCardListing {
	id: number;
	slug: string;
	title: string;
	shortDescription: string;
	category: ListingCategory;
	categoryDisplay: string;
	difficultyLevel: DifficultyLevel;
	difficultyDisplay: string;
	pricePerPerson: string;
	durationDisplay: string;
	ratingAverage: string;
	ratingCount: number;
	hostIsVerified: boolean;
	primaryImageThumbnail: string | null;
}

// Browse filters 
export interface PublicListingsParams {
	search?: string;
	category?: ListingCategory;
	activityType?: ActivityType;
	difficultyLevel?: DifficultyLevel;
	destination?: string;
	minPrice?: string;
	maxPrice?: string;
	minDays?: string;
	maxDays?: string;
	minDuration?: string;
	maxDuration?: string;
	instantBooking?: boolean;
	hostVerified?: boolean;
	minRating?: string;
	idealFor?: IdealFor;
	bestSeason?: BestSeason;
	tag?: string;
	ordering?: string;
	page?: number;
}


// ordering options 
export const ORDERING_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: '-created_at', label: 'Newest First' },
	{ value: 'price_per_person', label: 'Price: Low to High' },
	{ value: '-price_per_person', label: 'Price: High to Low' },
	{ value: '-rating_average', label: 'Highest Rated' },
	{ value: 'duration_days', label: 'Duration: Shortest' },
	{ value: '-duration_days', label: 'Duration: Longest' },
] as const;
