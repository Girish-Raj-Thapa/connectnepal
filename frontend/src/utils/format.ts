import { format, parseISO } from 'date-fns';

/**
 * Format a decimal string as NPR currency.
 * "3390.00" → "NPR 3,390"
 * "7500.00" → "NPR 7.5K"  (if compact is true)
 * "18500000.00" → "NPR 18.5M"  (if compact is true)
 */
export function formatNPR(value: string, compact = false): string {
	const num = Number(value);
	if (isNaN(num)) return `NPR ${value}`;

	if (compact) {
		if (num >= 1_000_000) {
			const m = num / 1_000_000;
			return `NPR ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
		}
		if (num >= 1_000) {
			const k = num / 1_000;
			return `NPR ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
		}
	}

	return `NPR ${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Format a "YYYY-MM" month string into a short label.
 * "2026-03" → "Mar"
 */
export function formatMonthLabel(yyyyMM: string): string {
	// Append "-01" so date-fns can parse it
	return format(parseISO(`${yyyyMM}-01`), 'MMM');
}

/**
 * Format an ISO date string for display.
 * "2026-03-21" → "Mar 21, 2026"
 */
export function formatDate(dateStr: string | null): string {
	if (!dateStr) return '—';
	return format(parseISO(dateStr), 'MMM d, yyyy');
}

/**
 * Format a date range.
 * Same month: "Mar 21-25, 2026"
 * Different months: "Mar 21 - Apr 2, 2026"
 */
export function formatDateRange(
	start: string | null,
	end: string | null,
): string {
	if (!start) return '—';
	if (!end || start === end) return formatDate(start);

	const s = parseISO(start);
	const e = parseISO(end);

	if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
		return `${format(s, 'MMM d')}-${format(e, 'd, yyyy')}`;
	}
	return `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}`;
}

/**
 * Format a decimal rating string.
 * "4.50" → "4.5"
 */
export function formatRating(value: string): string {
	return parseFloat(value).toFixed(1);
}

/**
 * Get initials from a name string (for avatar fallbacks).
 * "Everest Trails" → "ET"
 */
export function getInitials(name: string): string {
	return name
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('');
}

/**
 * Relative time for activity feeds.
 * Uses date-fns formatDistanceToNow under the hood, but simplified.
 */
export function timeAgo(isoDate: string): string {
	const diff = Date.now() - new Date(isoDate).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
