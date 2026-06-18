// Through model item (inside PackageDetail)

export interface PackageListingItem {
    id: number;
    listingId: number;
    title: string;
    category: string;
    pricePerPerson: string;
    durationDays: number;
    sortOrder: number;
    dayNumber: number | null;
    primaryImageThumbnail: string | null;
    note: string;
    // Availability metadata (host-side only, populated after soft-delete backend changes)
    isAvailableForPackage: boolean;
    availabilityMessage: string | null;
    isActive: boolean;
    isBookable: boolean;
}


export interface NextAvailableSlot {
  id: number;
  startDate: string;  // ISO date "YYYY-MM-DD"
  endDate: string;
}


// Summary Shape 
export interface PackageSummary {
    id: number;
    title: string;
    slug: string;
    listingCount: number;
    includedListingNames: string[];
    durationDays: number;
    durationNights: number;
    totalPrice: string;
    discountLabel: string;
    bookingCount: number;
    isBookable: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    hasUpcomingSlot?: boolean;
    nextAvailableSlot?: NextAvailableSlot | null;
}

// Full Detail
export interface PackageDetail {
    id: number;
    title: string;
    slug: string;
    description: string;
    durationDays: number;
    durationNights: number;
    totalPrice: string;
    discountLabel: string;
    maxGroupSize: number;
    maxBookings: number | null;
    tags: string[];
    inclusions: string[];
    highlights: string;
    termsAndConditions: string;
    coverImageUrl: string | null;
    validFrom: string | null;
    validUntil: string | null;
    isBookable: boolean;
    isActive: boolean;
    bookingCount: number;
    listingCount: number;
    packageListings: PackageListingItem[];
    // Publish validation metadata (host-side only, populated after soft-delete backend changes)
    activeListingCount: number;
    hasUnavailableListings: boolean;
    canPublish: boolean;
    publishIssue: string | null;
    createdAt: string;
    updatedAt: string;
}

// Request Payloads 
export interface CreatePackagePayload {
    title: string;
    description: string;
    durationDays: number;
    durationNights: number;
    totalPrice: string;
    discountLabel?: string;
    maxGroupSize: number;
    maxBookings?: number | null;
    tags?: string[];
    inclusions?: string[];
    highlights?: string;
    termsAndConditions?: string;
    validFrom?: string | null;
    validUntil?: string | null;
    isBookable?: boolean;
    listingIds?: number[]; // included on create; array index = sort_order
}


// PATCH — all fields optional; listingIds NOT accepted here (use setPackageListings)
export type UpdatePackagePayload = Partial<Omit<CreatePackagePayload, 'listingIds'>> & {
    isActive?: boolean;
};


// List params & Filter tab
export type PackageTabFilter = 'all' | 'active' | 'inactive';

export interface ListPackagesParams {
    isBookable?: boolean;
    page?: number;
}


// Host: Slot / Schedule / Exception models

// Returned by GET /api/host/packages/{id}/slots/
export interface PackageSlot {
    id: number;
    packageId: number;
    startDate: string;        // departure date "YYYY-MM-DD"
    endDate: string;          // return date
    capacity: number;
    bookedCount: number;
    availableCapacity: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Returned by GET /api/host/packages/{id}/schedules/
export interface PackageSchedule {
    id: number;
    packageId: number;
    daysOfWeek: number[];     // 0=Mon … 6=Sun
    capacity: number;
    advanceDays: number;
    validFrom: string | null;
    validUntil: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Returned by GET /api/host/packages/{id}/exceptions/
export interface PackageSlotException {
    id: number;
    packageId: number;
    date: string;             // "YYYY-MM-DD"
    isClosed: boolean;
    capacityOverride: number | null;
    note: string;
    createdAt: string;
}


// Public (traveller-facing) shapes

// Card shape from GET /api/packages/
export interface PublicPackageSummary {
	    id: number;
	    title: string;
	    slug: string;
    description: string;
    durationDays: number;
    durationNights: number;
    totalPrice: string;
    discountLabel: string;
    tags: string[];
    listingCount: number;
    coverImageUrl: string | null;
    hostName: string;
    bookingCount: number;
    hasUpcomingSlots: boolean;
    nextAvailableSlot: NextAvailableSlot | null;
	    createdAt: string;
}

export interface RecommendedPackage extends PublicPackageSummary {
	    position: number;
}

// Listing card inside a public package detail (no notes field exposed publicly)
export interface PublicPackageListingItem {
    id: number;
    title: string;
    category: string;
    pricePerPerson: string;
    durationDays: number;
    sortOrder: number;
    dayNumber: number | null;
    primaryImageThumbnail: string | null;
}

// Full detail from GET /api/packages/{id}/
export interface PublicPackageDetail {
    id: number;
    title: string;
    slug: string;
    description: string;
    durationDays: number;
    durationNights: number;
    totalPrice: string;
    discountLabel: string;
    maxGroupSize: number;
    tags: string[];
    inclusions: string[];
    highlights: string;
    termsAndConditions: string;
    coverImageUrl: string | null;
    validFrom: string | null;
    validUntil: string | null;
    ratingAverage: string;
    ratingCount: number;
    hostId: number;
    hostName: string;
    bookingCount: number;
    hasUpcomingSlots: boolean;
    nextAvailableSlot: NextAvailableSlot | null;
    packageListings: PublicPackageListingItem[];
    createdAt: string;
}

// Slot card in the traveller departure picker — GET /api/packages/{id}/slots/
export interface PublicPackageSlot {
    id: number;
    startDate: string;
    endDate: string;
    availableCapacity: number;
}

// One day entry in the availability calendar response
export interface PackageAvailabilityDay {
    available: boolean;
    slotCount: number;
}

// Full availability response — GET /api/packages/{id}/availability/
export interface PackageAvailabilityMonth {
    year: number;
    month: number;
    days: Record<string, PackageAvailabilityDay>;  // key = "YYYY-MM-DD"
}


// Host payload types

export interface CreatePackageSlotPayload {
    startDate: string;
    endDate: string;
    capacity: number;
    isActive?: boolean;
}

export interface UpdatePackageSlotPayload {
    endDate?: string;
    capacity?: number;
    isActive?: boolean;
    // startDate cannot be changed — omit always
}

export interface CreatePackageSchedulePayload {
    daysOfWeek: number[];
    capacity: number;
    advanceDays?: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive?: boolean;
}

export type UpdatePackageSchedulePayload = Partial<CreatePackageSchedulePayload>;

export interface CreatePackageExceptionPayload {
    date: string;
    isClosed: boolean;
    capacityOverride?: number | null;
    note?: string;
}

export type UpdatePackageExceptionPayload = Partial<Omit<CreatePackageExceptionPayload, 'date'>>;

export interface GenerateSlotsResult {
    slotsCreated: number;  // API returns { slots_created: N }
}

export interface ListPackageSlotsParams {
    isActive?: boolean;
    dateFrom?: string;
    page?: number;
}

export interface ListPublicPackageSlotsParams {
    dateFrom?: string;
    dateTo?: string;
}


// Public service params & responses

export interface PublicListPackagesParams {
    search?: string;
    tags?: string;
    priceMax?: number;
    durationDaysMax?: number;
    ordering?: 'total_price' | '-total_price' | '-created_at' | '-booking_count';
    page?: number;
}

export interface PublicPackageListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: PublicPackageSummary[];
}

// Form state for the public package filter sidebar (all strings to allow empty/controlled inputs)
export interface PublicPackageFilterState {
    search: string;
    tags: string;
    priceMax: string;
    durationDaysMax: string;
    ordering: string;
    page: number;
}
