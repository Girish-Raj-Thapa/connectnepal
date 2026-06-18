// Shared trend point shapes

export interface MonthAmountPoint {
  month: string;   // "YYYY-MM"
  amount: string;  // decimal string e.g. "3390.00"
}

export interface MonthCountPoint {
  month: string;   // "YYYY-MM"
  count: number;
}


// Traveller

export interface TravellerOverviewSummary {
    activeTripPlans: number;
    upcomingBookings: number;
    completedTrips: number;
    reviewsWritten: number;
}

export interface TravellerUpcomingBookingPreview {
    bookingItemId: number;
    bookingId: number;
    bookingReference: string;
    targetType: 'listing' | 'package';
    targetId: number;
    title: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    quotedTotal: string;
    currency: string;
}

export interface TravellerTripPlanPreview {
    id: number;
    title: string;
    status: string;
    statusDisplay: string;
    startDate: string | null;
    endDate: string | null;
    estimatedCost: string;
    updatedAt: string;
}

export interface TravellerOverviewResponse {
    summary: TravellerOverviewSummary;
    previews: {
        upcomingBookings: TravellerUpcomingBookingPreview[];
        tripPlans: TravellerTripPlanPreview[];
    };
}


// Host 

export interface HostOverviewSummary {
    activeListings: number;
    totalBookings: number;
    thisMonthEarnings: string;   // decimal string
    averageRating: string;       // decimal string
    reviewCount: number;
}

export interface HostRecentBookingPreview {
    bookingItemId: number;
    bookingId: number;
    bookingReference: string;
    targetType: 'listing' | 'package';
    targetId: number;
    title: string;
    travellerName: string | null;
    travellerEmail: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    quotedTotal: string;
    currency: string;
    createdAt: string;
}

export interface HostTopPerformingListing {
    listingId: number;
    title: string;
    category: string;
    destination: string;
    bookingCount: number;
    ratingAverage: string;   // decimal string
    ratingCount: number;
    isActive: boolean;
    isBookable: boolean;
}

export interface HostOverviewResponse {
    summary: HostOverviewSummary;
    trends: {
        monthlyEarnings: MonthAmountPoint[];
        monthlyBookings: MonthCountPoint[];
    };
    previews: {
        recentBookings: HostRecentBookingPreview[];
        topPerformingListings: HostTopPerformingListing[];
    };
}


// Admin 
export interface AdminOverviewSummary {
    totalUsers: number;
    activeHosts: number;
    totalListings: number;
    totalRevenue: string;        // decimal string
    totalBookings: number;
    activePackages: number;
    totalReviews: number;
    averagePlatformRating: string;  // decimal string
    openComplaints: number | null;  // always null in phase 1
}

export interface ListingsByCategoryItem {
    category: string;
    categoryDisplay: string;
    count: number;
}

export interface RecentActivityItem {
    source: string;
    occurredAt: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: number;
    label: string;
    description: string;
}

export interface AdminTopListing {
    listingId: number;
    title: string;
    hostId: number;
    hostName: string;
    bookingCount: number;
    ratingAverage: string;
    ratingCount: number;
}

export interface AdminTopHost {
    hostId: number;
    hostName: string;
    businessName: string | null;
    bookingCount: number;
    averageRating: string;
    reviewCount: number;
    verificationStatus: string;
}

export interface AdminOverviewResponse {
    summary: AdminOverviewSummary;
    trends: {
        monthlyRevenue: MonthAmountPoint[];
        monthlyBookings: MonthCountPoint[];
    };
    distributions: {
        listingsByCategory: ListingsByCategoryItem[];
    };
    previews: {
        recentActivity: RecentActivityItem[];
    };
    topPerformance: {
        listings: AdminTopListing[];
        hosts: AdminTopHost[];
    };
}
