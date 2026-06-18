/**
 * Route Constants
 * ---------------
 * Contains all application route paths.
 * Referenced by: AppRoutes, sidebarNav, authRouting.
 */

export const ROUTES = {
    // Public
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    ONBOARDING_BASE: '/onboarding',

    DISCOVER: '/listings',
    ABOUT_US: '/about-us',
    FAQS: '/faqs',
    COMMUNITY_GUIDELINES: '/community-guidelines',
    TRUST_AND_SAFETY: '/trust-and-safety',

    NOTIFICATIONS: '/notifications',

    // Public Listings
    PUBLIC_LISTINGS: '/listings',
    PUBLIC_LISTING_DETAIL: '/listings/:slug',
    LISTING_BOOKING_CHECKOUT: '/listings/:slug/book',

    // Public Packages
    PUBLIC_PACKAGE_DETAIL: '/packages/:id',
    PACKAGE_BOOKING_CHECKOUT: '/packages/:id/book',
    
    // Traveller
    TRAVELLER_DASHBOARD: '/traveller-dashboard',
    TRAVELLER_TRIPS: '/traveller/trip-planners',
    TRAVELLER_TRIP_DETAIL: '/traveller/trip-planners/:id',
    TRAVELLER_BOOKINGS: '/traveller/bookings',
    TRAVELLER_BOOKING_DETAIL: '/traveller/bookings/:id',
    TRAVELLER_BOOK_FROM_TRIP: '/traveller/bookings/from-trip/:planId',
    TRAVELLER_REVIEWS: '/traveller/reviews',
    TRAVELLER_COMPLAINTS: '/traveller/complaints',
    TRAVELLER_CHAT_HISTORY: '/traveller/chat-history',
    TRAVELLER_SETTINGS: '/traveller/settings',
    TRAVELLER_COMPLAINT_CREATE: '/traveller/complaints/create/:bookingItemId',
    TRAVELLER_COMPLAINT_DETAIL: '/traveller/complaints/:id',
    TRAVELLER_RECEIVED_COMPLAINT_DETAIL: '/traveller/complaints/received/:id',
    

    // Host
    HOST_DASHBOARD: '/host-dashboard',
    HOST_LISTINGS: '/host/listings',
    HOST_CREATE_LISTING: '/host/listings/create',
    HOST_EDIT_LISTING: '/host/listings/:id/edit',
    HOST_MANAGE_SLOTS: '/host/listings/:id/slots',
    HOST_PACKAGES: '/host/packages',
    HOST_CREATE_PACKAGE: '/host/packages/create',
    HOST_EDIT_PACKAGE: '/host/packages/:id/edit',
    HOST_PACKAGE_SLOTS: '/host/packages/:id/slots',
    HOST_BOOKINGS: '/host/bookings',
    HOST_BOOKING_DETAIL: '/host/bookings/:itemId',
    HOST_REVIEWS: '/host/reviews',
    HOST_SETTINGS: '/host/settings',
    HOST_COMPLAINTS: '/host/complaints',
    HOST_COMPLAINT_CREATE: '/host/complaints/create/:bookingItemId',
    HOST_COMPLAINT_DETAIL: '/host/complaints/:id',
    HOST_RECEIVED_COMPLAINT_DETAIL: '/host/complaints/received/:id',

    // Admin
    ADMIN_DASHBOARD: '/admin-dashboard',
    ADMIN_USERS: '/admin/users',
    ADMIN_USER_DETAIL: '/admin/users/:id',
    ADMIN_VERIFY_HOSTS: '/admin/verify-hosts',
    ADMIN_VERIFY_HOST_DETAIL: '/admin/verify-hosts/:id',
    ADMIN_COMPLAINTS: '/admin/complaints',
    ADMIN_SETTINGS: '/admin/settings',
    ADMIN_REVIEWS: '/admin/reviews',
    ADMIN_COMPLAINT_DETAIL: '/admin/complaints/:id',
    ADMIN_BOOKINGS: '/admin/bookings',

    // Payment
    TRAVELLER_BOOKING_PAYMENT: '/traveller/bookings/:id/payment',
    PAYMENT_PROCESSING: '/payment/processing',
    PAYMENT_SUCCESS: '/payment/success',
    PAYMENT_FAILURE: '/payment/failure',

    // Auth
    EMAIL_CONFIRMATION: '/email-confirmation',
    ACTIVATE: '/activate',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',

    // Onboarding
    TRAVELLER_ONBOARDING_BASIC: '/onboarding/traveller/basic-profile',
    TRAVELLER_ONBOARDING_PREFERENCES: '/onboarding/traveller/preferences',
    TRAVELLER_ONBOARDING_COMPLETE: '/onboarding/traveller/complete',
    HOST_ONBOARDING_BASIC: '/onboarding/host/basic-profile',
    HOST_ONBOARDING_BUSINESS: '/onboarding/host/business-info',
    HOST_ONBOARDING_DOCUMENTS: '/onboarding/host/documents',
    HOST_ONBOARDING_COMPLETE: '/onboarding/host/complete',
} as const;
