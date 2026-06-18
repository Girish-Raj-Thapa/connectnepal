import { expect, test } from '@playwright/test';
import { mockApi } from '../support/mockApi';

test.describe('Dashboard smoke', () => {
	test('traveller dashboard loads for an authenticated traveller @smoke', async ({ page }) => {
		await mockApi(page, { role: 'traveller' });

		await page.goto('/traveller-dashboard');

		await expect(page).toHaveURL(/\/traveller-dashboard$/);
		await expect(page.getByRole('heading', { name: /Welcome back, Traveller!/i })).toBeVisible();
		await expect(page.getByText('Upcoming Bookings')).toBeVisible();
	});

	test('host dashboard loads for an authenticated host @smoke', async ({ page }) => {
		await mockApi(page, { role: 'host' });

		await page.goto('/host-dashboard');

		await expect(page).toHaveURL(/\/host-dashboard$/);
		await expect(page.getByRole('heading', { name: /Welcome back, Host!/i })).toBeVisible();
		await expect(page.getByText('Recent Bookings')).toBeVisible();
	});

	test('admin dashboard loads for an authenticated admin @smoke', async ({ page }) => {
		await mockApi(page, { role: 'admin' });

		await page.goto('/admin-dashboard');

		await expect(page).toHaveURL(/\/admin-dashboard$/);
		await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible();
		await expect(page.getByText('Top Performing Hosts')).toBeVisible();
	});
});
