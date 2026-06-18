// ─── Trip Planner Types ─────────────────────────────────

// ─── Enums ──────────────────────────────────────────────

export type TripPlanStatus = 'planning' | 'booked' | 'completed' | 'archived';

export const TRIP_STATUS_OPTIONS: readonly { value: TripPlanStatus; label: string }[] = [
	{ value: 'planning', label: 'Planning' },
	{ value: 'booked', label: 'Booked' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'archived', label: 'Archived' },
] as const;

export type DurationType = 'hourly' | 'full_day' | 'multi_day';

// ─── Listing Snapshot (embedded in trip item) ───────────

export interface TripItemListing {
	id: number;
	title: string;
	slug: string;
	destination: string;
	category: string;
	categoryDisplay: string;
	durationType: DurationType;
	pricePerPerson: string;
	durationDisplay: string;
	primaryImageThumbnail: string | null;
	isBookable: boolean;
	isActive: boolean;
}

// ─── Trip Plan Item ─────────────────────────────────────

export interface TripPlannerItem {
	id: number;
	listing: TripItemListing;
	dayNumber: number;
	order: number;
	priceSnapshot: string;
	durationHoursSnapshot: string;
	durationTypeSnapshot: DurationType;
	durationDaysSnapshot: number;
	durationNightsSnapshot: number;
	notes: string;
	addedAt: string;
	// Availability fields (populated after soft-delete backend changes)
	isAvailableForBooking: boolean;
	availabilityMessage: string | null;
}

// ─── Items grouped by day (detail response) ─────────────

export type ItemsByDay = Record<string, TripPlannerItem[]>;

// ─── Trip Plan List Item (GET /api/trip-planner/) ───────

export interface TripPlanListItem {
	id: number;
	title: string;
	status: TripPlanStatus;
	statusDisplay: string;
	startDate: string | null;
	endDate: string | null;
	totalDays: number;
	travellersCount: number;
	estimatedCost: string;
	coverImage: string;
	itemCount: number;
	createdAt: string;
	updatedAt: string;
}

// ─── Trip Plan Detail (GET /api/trip-planner/<id>/) ─────

export interface TripPlanDetail extends TripPlanListItem {
	itemsByDay: ItemsByDay;
}

// ─── Request Payloads ───────────────────────────────────

export interface CreateTripPlanRequest {
	title: string;
	totalDays: number;
	travellersCount: number;
	startDate?: string | null;
	endDate?: string | null;
}

export interface UpdateTripPlanRequest {
	title?: string;
	totalDays?: number;
	travellersCount?: number;
	startDate?: string | null;
	endDate?: string | null;
	status?: 'planning' | 'archived';
}

export interface AddTripItemRequest {
	listingId: number;
	dayNumber: number;
	notes?: string;
}

export interface UpdateTripItemRequest {
	dayNumber?: number;
	order?: number;
	notes?: string;
}

export interface ReorderEntry {
	itemId: number;
	dayNumber: number;
	order: number;
}

// ─── Query Params ───────────────────────────────────────

export interface TripPlanListParams {
	status?: TripPlanStatus;
	page?: number;
}

// ─── Day-blocking helpers ────────────────────────────────

/**
 * Computes the set of days that are fully blocked by existing plan items.
 *
 */
export const computeBlockedDays = (itemsByDay: ItemsByDay): Set<number> => {
	const blocked = new Set<number>();
	Object.values(itemsByDay)
		.flat()
		.forEach((item) => {
			if (item.durationTypeSnapshot === 'full_day') {
				blocked.add(item.dayNumber);
			} else if (item.durationTypeSnapshot === 'multi_day') {
				const span = item.durationDaysSnapshot > 0 ? item.durationDaysSnapshot : 1;
				for (let d = item.dayNumber; d < item.dayNumber + span; d++) {
					blocked.add(d);
				}
			}
		});
	return blocked;
};

/**
 * Picks the first available listing image to use as a trip cover.
 * 
 * Ordering: earliest day → lowest order within that day.
 */
export const getTripCoverFromItems = (itemsByDay: ItemsByDay): string | null => {
	const dayNumbers = Object.keys(itemsByDay)
		.map((key) => Number(key))
		.filter((day) => !Number.isNaN(day))
		.sort((a, b) => a - b);

	for (const day of dayNumbers) {
		const items = [...(itemsByDay[String(day)] ?? [])].sort(
			(a, b) => a.order - b.order,
		);
		for (const item of items) {
			if (item.listing.primaryImageThumbnail) {
				return item.listing.primaryImageThumbnail;
			}
		}
	}

	return null;
};
