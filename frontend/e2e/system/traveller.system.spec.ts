import { expect, test } from '@playwright/test';
import { mockApi } from '../support/mockApi';

test.describe('Traveller system flow', () => {
	test('traveller can move across core dashboard sections @system', async ({ page }) => {
		await mockApi(page, { role: 'traveller' });

		await page.goto('/traveller-dashboard');

		await expect(page.getByRole('heading', { name: /Welcome back, Traveller!/i })).toBeVisible();

		await page.getByRole('link', { name: 'Trip Planner' }).click();
		await expect(page).toHaveURL(/\/traveller\/trip-planners$/);
		await expect(page.getByRole('heading', { name: 'My Trip Plans' })).toBeVisible();
		await expect(page.getByText('Spring Nepal')).toBeVisible();

		await page.getByRole('link', { name: 'My Bookings' }).click();
		await expect(page).toHaveURL(/\/traveller\/bookings$/);
		await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
		await expect(page.getByText('BK-101', { exact: true })).toBeVisible();

		await page.getByRole('link', { name: 'My Reviews' }).click();
		await expect(page).toHaveURL(/\/traveller\/reviews$/);
		await expect(page.getByRole('heading', { name: 'My Reviews' })).toBeVisible();
		await expect(
			page.getByRole('button', { name: /View review for Pokhara Ridge Hike/i }),
		).toBeVisible();

		await page.getByRole('link', { name: 'Complaints' }).click();
		await expect(page).toHaveURL(/\/traveller\/complaints$/);
		await expect(page.getByRole('heading', { name: 'Complaints' })).toBeVisible();
		await expect(page.getByText('Refund was delayed')).toBeVisible();

		await page.getByRole('link', { name: 'Chat History' }).click();
		await expect(page).toHaveURL(/\/traveller\/chat-history$/);
		await expect(page.getByRole('heading', { name: 'Chat History' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Booking help/i })).toBeVisible();
	});
});
