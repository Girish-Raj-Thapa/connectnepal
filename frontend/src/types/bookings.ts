/**
 * Booking Types
 */

import type { DurationType } from '@/types/listings';
import type { ReviewStatus } from '@/types/reviews';

// Enums

export type BookingStatus = 
    | 'pending_payment'
    | 'confirmed'
    | 'completed'
    | 'cancelled'
    | 'expired';


export type PaymentStatus =
    | 'payment_pending'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'payment_refunded'
    | 'payment_partially_refunded'
    | 'payment_cancelled';

export type BookingSource = 'direct' | 'trip_plan' | 'admin';

export type CancellationReason =
    | 'traveller_request'
    | 'host_unavailable'
    | 'payment_failed'
    | 'payment_refunded'
    | 'payment_cancelled'
    | 'admin_action'
    | 'other';

export type AvailabilityStatus = 'available' | 'conflict' | 'unavailable';


// Labels 

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    pending_payment: 'Pending Payment',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus,{ bg: string; text: string; dot: string }> = {
    pending_payment: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
    confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    completed: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
    expired: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    payment_pending: 'Payment Pending',
    payment_succeeded: 'Payment Succeeded',
    payment_failed: 'Payment Failed',
    payment_refunded: 'Refunded',
    payment_partially_refunded: 'Partially Refunded',
    payment_cancelled: 'Payment Cancelled',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus,{ bg: string; text: string }> = {
    payment_pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
    payment_succeeded: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    payment_failed: { bg: 'bg-red-50', text: 'text-red-700' },
    payment_refunded: { bg: 'bg-blue-50', text: 'text-blue-700' },
    payment_partially_refunded: { bg: 'bg-blue-50', text: 'text-blue-700' },
    payment_cancelled: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
    traveller_request: 'Traveller Request',
    host_unavailable: 'Host Unavailable',
    payment_failed: 'Payment Failed',
    payment_refunded: 'Payment Refunded',
    payment_cancelled: 'Payment Cancelled',
    admin_action: 'Admin Action',
    other: 'Other',
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
    available: 'Available',
    conflict: 'Possible Conflict',
    unavailable: 'Not Available',
};


// Interfaces 

// embedded sub-shapes 

export interface BookingItemSnapshot {
    // Listing item fields
    title?: string;
    destination?: string;
    pricePerPerson?: string;
    durationType?: DurationType;
    durationDays?: number;
    durationNights?: number;
    cancellationPolicy?: string;
    hostName?: string;
    primaryImageUrl?: string | null;
    // Package item fields (present when BookingItem.durationType === 'package')
    packageId?: number;
    packageTitle?: string;
    totalPrice?: string;
    coverImageUrl?: string | null;
    slotId?: number;
    startDate?: string;
    endDate?: string;
}

export interface BookingStatusHistoryEntry {
    id: number;
    bookingItemId: number | null;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus;
    note: string;
    changedByEmail: string | null;
    changedAt: string;
}


export interface BookingItem {
    id: number;
    listingId: number | null;
    listingTitle: string | null;
    durationType: DurationType | 'package';
    startDate: string;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    days: number;
    nights: number;
    travellerCount: number;
    status: BookingStatus;
    snapshot?: BookingItemSnapshot;
    pricePerPerson?: string;
    subtotal?: string;
    discountAmount?: string;
    feeAmount?: string;
    taxAmount?: string;
    grossAmount?: string;
    quotedTotal: string;
    currency: string;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string | null;
    history?: BookingStatusHistoryEntry[];
    // Review State
    reviewId: number | null;
	hasReview: boolean;
	reviewStatus: ReviewStatus | null;
	canReview: boolean;
	cannotReviewReason: string | null;
}


export interface Booking {
    id: number;
    reference: string;
    status: BookingStatus;
    paymentStatus?: PaymentStatus;
    paymentProvider?: string | null;
    transactionId?: string | null;
    expiresAt?: string | null;
    paidAt?: string | null;
    paidAmount?: string | null;
    subtotal?: string;
    discountAmount?: string;
    feeAmount?: string;
    taxAmount?: string;
    grossAmount?: string;
    quotedTotal: string;
    currency: string;
    source: BookingSource;
    tripPlanId?: number | null;
    cancelledAt?: string | null;
    cancellationReason?: string;
    cancellationNote?: string;
    createdAt: string;
    updatedAt?: string;
    items?: BookingItem[];
    history?: BookingStatusHistoryEntry[];
    // list-view only
    itemCount?: number;
}


// list + detail 
export interface HostBookingItem {
    id: number;
    bookingReference: string;
    bookingId: number;
    listingId: number | null;
    listingTitle: string | null;
    durationType: DurationType | 'package';
    startDate: string;
    endDate: string | null;
    startTime?: string | null;
    endTime?: string | null;
    days?: number;
    nights?: number;
    travellerCount: number;
    travellerName: string;
    travellerEmail?: string;
    status: BookingStatus;
    snapshot?: BookingItemSnapshot;
    pricePerPerson?: string;
    subtotal?: string;
    discountAmount?: string;
    feeAmount?: string;
    taxAmount?: string;
    grossAmount?: string;
    quotedTotal: string;
    currency: string;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string | null;
    history?: BookingStatusHistoryEntry[];
}


export interface QuoteItem {
    listingId: number;
    listingTitle: string;
    durationType: DurationType;
    startDate: string;
    endDate: string | null;
    days: number;
    travellerCount: number;
    pricePerPerson: string;
    subtotal: string;
    feeAmount: string;
    taxAmount: string;
    discountAmount: string;
    grossAmount: string;
    quotedTotal: string;
    availability: AvailabilityStatus;
    currency: string;
}


export interface QuoteTotals {
    subtotal: string;
    feeAmount: string;
    taxAmount: string;
    discountAmount: string;
    grossAmount: string;
    quotedTotal: string;
    currency: string;
}


export interface BookingQuote {
    items: QuoteItem[];
    totals: QuoteTotals;
}


// Shared slot interface — the minimal shape required by generic slot UI components.
// Both ActivitySlot and PackageSlot satisfy this.
export interface SlotLike {
    id:                number;
    startDate:         string;
    capacity:          number;
    availableCapacity: number;
    isActive:          boolean;
}

/** Minimum shape shared by SlotException and PackageSlotException */
export interface ExceptionLike {
    id:               number;
    date:             string;
    isClosed:         boolean;
    capacityOverride: number | null;
    note:             string;
}

/** Minimum shape shared by ListingSchedule and PackageSchedule */
export interface ScheduleLike {
    id:          number;
    daysOfWeek:  number[];
    timeSlots?:  ScheduleTimeSlot[];
    capacity:    number;
    advanceDays: number;
    validFrom:   string | null;
    validUntil:  string | null;
    isActive:    boolean;
}

// Activity Slot

export interface ActivitySlot {
    id:                number;
    listingId:         number;
    startDate:         string;
    endDate:           string | null;
    startTime:         string | null;
    endTime:           string | null;
    capacity:          number;
    availableCapacity: number;
    isActive:          boolean;
    createdAt:         string;
}


// Request / Payload Types

export interface BookingItemPayload {
    listingId:      number;
    slotId:         number;
    travellerCount: number;
    tripPlanId?:    number;
}

export interface QuoteRequest {
    items: BookingItemPayload[];
}

export interface CreateBookingPayload {
    items: BookingItemPayload[];
}

export interface CancelBookingPayload {
    reason: CancellationReason;
    note?: string;
}

export interface BookFromTripItemPayload {
    tripPlanItemId: number;
    slotId:         number;
    travellerCount: number;
}

export interface BookFromTripPayload {
    items: BookFromTripItemPayload[];
}


// Schedule-based Slot Auto-Generation

export interface ScheduleTimeSlot {
    start: string;  // "HH:MM"
    end:   string;  // "HH:MM"
}

export interface ListingSchedule {
    id:          number;
    listingId:   number;
    daysOfWeek:  number[];            // 0=Mon … 6=Sun
    timeSlots:   ScheduleTimeSlot[];  // hourly only, else []
    capacity:    number;
    advanceDays: number;
    validFrom:   string | null;
    validUntil:  string | null;
    isActive:    boolean;
    createdAt:   string;
}

export interface SlotException {
    id:               number;
    listingId:        number;
    date:             string;          // "YYYY-MM-DD"
    isClosed:         boolean;
    capacityOverride: number | null;
    note:             string;
    createdAt:        string;
}

export interface CreateSchedulePayload {
    daysOfWeek:   number[];
    timeSlots?:   ScheduleTimeSlot[];
    capacity:     number;
    advanceDays?: number;
    validFrom?:   string;
    validUntil?:  string;
}

export interface UpdateSchedulePayload {
    daysOfWeek?:  number[];
    timeSlots?:   ScheduleTimeSlot[];
    capacity?:    number;
    advanceDays?: number;
    validFrom?:   string | null;
    validUntil?:  string | null;
    isActive?:    boolean;
}

export interface CreateExceptionPayload {
    date:              string;
    isClosed?:         boolean;
    capacityOverride?: number;
    note?:             string;
}

export interface UpdateExceptionPayload {
    isClosed?:         boolean;
    capacityOverride?: number | null;
    note?:             string;
}

export interface GenerateSlotsResult {
    slotsCreated: number;
}


// Host Slot Management

export interface CreateSlotPayload {
    startDate:  string;
    endDate?:   string;   // multi_day only
    startTime?: string;   // hourly only
    endTime?:   string;   // hourly only
    capacity?:  number;
}

export interface UpdateSlotPayload {
    capacity?:  number;
    isActive?:  boolean;
}

export interface DeleteSlotResult {
    deactivated: boolean;   // false = hard deleted (204), true = deactivated (200)
    slot?:       ActivitySlot;
}


// List Query Params 

export interface BookingListParams {
    status?: BookingStatus;
    source?: BookingSource;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}


export interface HostBookingListParams {
    status?: BookingStatus;
    listingId?: number;
    packageId?: number;
    durationType?: DurationType;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
}


// Package Booking

export interface CreatePackageBookingPayload {
    packageId: number;
    travellerCount: number;
    packageSlotId?: number;  // always pass for explicit-slot UX; omit only for auto-assign
}

// All machine-readable error codes the backend can return for package bookings
export type PackageErrorCode =
    | 'package_not_bookable'
    | 'package_empty'
    | 'group_size_exceeded'
    | 'package_fully_booked'
    | 'package_not_yet_valid'
    | 'package_expired'
    | 'package_slot_not_found'
    | 'package_slot_out_of_window'
    | 'package_slot_full'
    | 'package_no_available_slots'
    | 'xor_required';
