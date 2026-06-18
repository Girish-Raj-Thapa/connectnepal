import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	formatDate,
	formatDateRange,
	formatMonthLabel,
	formatNPR,
	formatRating,
	getInitials,
	timeAgo,
} from '@utils/format';

describe('format utilities', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('formats NPR currency in standard and compact modes', () => {
		expect(formatNPR('3390.00')).toBe('NPR 3,390');
		expect(formatNPR('7000.00', true)).toBe('NPR 7K');
		expect(formatNPR('7500.00', true)).toBe('NPR 7.5K');
		expect(formatNPR('18500000.00', true)).toBe('NPR 18.5M');
		expect(formatNPR('not-a-number')).toBe('NPR not-a-number');
	});

	it('formats month and single-date values', () => {
		expect(formatMonthLabel('2026-03')).toBe('Mar');
		expect(formatDate('2026-03-21')).toBe('Mar 21, 2026');
		expect(formatDate(null)).toBe('—');
	});

	it('formats date ranges within the same month and across months', () => {
		expect(formatDateRange('2026-03-21', '2026-03-25')).toBe('Mar 21-25, 2026');
		expect(formatDateRange('2026-03-21', '2026-04-02')).toBe('Mar 21 - Apr 2, 2026');
		expect(formatDateRange('2026-03-21', '2026-03-21')).toBe('Mar 21, 2026');
		expect(formatDateRange(null, '2026-03-21')).toBe('—');
	});

	it('formats ratings and initials', () => {
		expect(formatRating('4.50')).toBe('4.5');
		expect(getInitials('Everest Trails')).toBe('ET');
		expect(getInitials('  connect   nepal  ')).toBe('CN');
	});

	it('returns relative time labels', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

		expect(timeAgo('2026-04-15T11:59:45.000Z')).toBe('Just now');
		expect(timeAgo('2026-04-15T11:15:00.000Z')).toBe('45m ago');
		expect(timeAgo('2026-04-15T09:00:00.000Z')).toBe('3h ago');
		expect(timeAgo('2026-04-12T12:00:00.000Z')).toBe('3d ago');
	});
});
