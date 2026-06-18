import { format, parseISO } from 'date-fns';
import type { BookingItem, HostBookingItem } from '@/types/bookings';

// Backend media files live on the API server, not the frontend.
// Snapshot image URLs may be stored as relative paths (/media/...) by older
// backend versions. Once the backend is fixed to return absolute URLs, this
// helper becomes a no-op for those cases.
const API_ORIGIN = (() => {
	try {
		return new URL(import.meta.env.VITE_API_URL as string).origin;
	} catch {
		return '';
	}
})();

function resolveMediaUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (url.startsWith('http://') || url.startsWith('https://')) return url;
	return `${API_ORIGIN}${url}`;
}

type BookingItemLike = BookingItem | HostBookingItem;

// Determines whether a booking item represents a listing or package booking.
export function getBookingItemKind(item: BookingItemLike): 'listing' | 'package' {
	return item.durationType === 'package' ? 'package' : 'listing';
}

// Returns a safe display title for both listing and package bookings.
export function getBookingItemTitle(item: BookingItemLike): string {
	if (getBookingItemKind(item) === 'package') {
		return item.snapshot?.packageTitle ?? 'Package Booking';
	}
	return item.listingTitle ?? 'Experience Booking';
}

// Returns the best available snapshot image URL for the booking item.
// Handles both absolute URLs (returned by fixed backend) and relative paths
// (stored by older backend versions) by resolving them against the API origin.
export function getBookingItemImage(item: BookingItemLike): string | null {
	if (getBookingItemKind(item) === 'package') {
		return resolveMediaUrl(item.snapshot?.coverImageUrl);
	}

	const snapshot = item.snapshot as
		| (typeof item.snapshot & {
				listingImageUrl?: string | null;
				primaryImageThumbnail?: string | null;
		  })
		| undefined;

	return (
		resolveMediaUrl(snapshot?.listingImageUrl) ??
		resolveMediaUrl(snapshot?.primaryImageThumbnail) ??
		resolveMediaUrl(snapshot?.primaryImageUrl) ??
		null
	);
}

// Returns a readable date range for either booking kind.
export function getBookingItemDateRange(item: BookingItemLike): string {
	const startDate = item.startDate ?? item.snapshot?.startDate;
	const endDate = item.endDate ?? item.snapshot?.endDate;

	if (!startDate) return '—';

	const start = format(parseISO(startDate), 'd MMM yyyy');
	if (!endDate || endDate === startDate) return start;
	return `${start} - ${format(parseISO(endDate), 'd MMM yyyy')}`;
}

// Returns time text for listing bookings only (packages use date ranges).
export function getBookingItemTimeDisplay(item: BookingItemLike): string | null {
	if (getBookingItemKind(item) === 'package') return null;
	if (!item.startTime) return null;
	if (!item.endTime) return item.startTime;
	return `${item.startTime} - ${item.endTime}`;
}
