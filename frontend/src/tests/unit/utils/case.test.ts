import { describe, expect, it } from 'vitest';
import {
	camelizeKeys,
	shouldTransform,
	snakifyKeys,
	toCamel,
	toSnake,
} from '@utils/case';

describe('case utilities', () => {
	it('converts individual keys between snake, kebab, and camel case', () => {
		expect(toCamel('first_name')).toBe('firstName');
		expect(toCamel('trip-plan_name')).toBe('tripPlanName');
		expect(toSnake('firstName')).toBe('first_name');
		expect(toSnake('tripPlanName')).toBe('trip_plan_name');
	});

	it('camelizes nested object keys without mutating the input', () => {
		const input = {
			first_name: 'Everest',
			trip_plan: {
				total_cost: 1200,
			},
			items: [{ listing_id: 7 }],
		};

		const result = camelizeKeys(input);

		expect(result).toEqual({
			firstName: 'Everest',
			tripPlan: { totalCost: 1200 },
			items: [{ listingId: 7 }],
		});
		expect(input).toEqual({
			first_name: 'Everest',
			trip_plan: {
				total_cost: 1200,
			},
			items: [{ listing_id: 7 }],
		});
	});

	it('snake-cases nested object keys without mutating the input', () => {
		const input = {
			firstName: 'Everest',
			tripPlan: {
				totalCost: 1200,
			},
			items: [{ listingId: 7 }],
		};

		const result = snakifyKeys(input);

		expect(result).toEqual({
			first_name: 'Everest',
			trip_plan: { total_cost: 1200 },
			items: [{ listing_id: 7 }],
		});
		expect(input).toEqual({
			firstName: 'Everest',
			tripPlan: {
				totalCost: 1200,
			},
			items: [{ listingId: 7 }],
		});
	});

	it('preserves circular references while transforming keys', () => {
		const camelInput: Record<string, unknown> = { first_name: 'Everest' };
		camelInput.self_ref = camelInput;

		const camelResult = camelizeKeys(camelInput);

		expect(camelResult.firstName).toBe('Everest');
		expect(camelResult.selfRef).toBe(camelResult);

		const snakeInput: Record<string, unknown> = { firstName: 'Everest' };
		snakeInput.selfRef = snakeInput;

		const snakeResult = snakifyKeys(snakeInput);

		expect(snakeResult.first_name).toBe('Everest');
		expect(snakeResult.self_ref).toBe(snakeResult);
	});

	it('does not transform special objects and only flags plain objects for transformation', () => {
		const file = new File(['proof'], 'proof.txt', { type: 'text/plain' });
		const date = new Date('2026-04-15T00:00:00.000Z');
		const formData = new FormData();

		const input = {
			file_upload: file,
			created_at: date,
			form_data: formData,
		};

		const result = camelizeKeys(input);

		expect(result).toEqual({
			fileUpload: file,
			createdAt: date,
			formData,
		});

		expect(shouldTransform({ bookingId: 1 })).toBe(true);
		expect(shouldTransform(['bookingId'])).toBe(false);
		expect(shouldTransform(file)).toBe(false);
		expect(shouldTransform(date)).toBe(false);
		expect(shouldTransform(null)).toBe(false);
	});
});
