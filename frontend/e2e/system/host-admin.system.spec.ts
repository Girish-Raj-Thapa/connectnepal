import { expect, test } from '@playwright/test';
import { mockApi } from '../support/mockApi';

test.describe('Host and admin system flows', () => {
	test('host can move from dashboard to package and review management @system', async ({ page }) => {
		await mockApi(page, { role: 'host' });

		await page.goto('/host-dashboard');

		await expect(page.getByRole('heading', { name: /Welcome back, Host!/i })).toBeVisible();

		await page.getByRole('link', { name: 'Manage Packages' }).click();
		await expect(page).toHaveURL(/\/host\/packages$/);
		await expect(page.getByRole('heading', { name: 'Manage Packages' })).toBeVisible();
		await expect(page.getByText('Annapurna Highlights')).toBeVisible();

		await page.getByRole('link', { name: 'Reviews' }).click();
		await expect(page).toHaveURL(/\/host\/reviews$/);
		await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
		await expect(
			page.getByRole('button', { name: /View review for Pokhara Ridge Hike/i }),
		).toBeVisible();
	});

	test('admin can move from system overview to moderation pages @system', async ({ page }) => {
		await mockApi(page, { role: 'admin' });

		await page.goto('/admin-dashboard');

		await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible();

		await page.getByRole('link', { name: 'Verify Hosts' }).click();
		await expect(page).toHaveURL(/\/admin\/verify-hosts$/);
		await expect(page.getByRole('heading', { name: 'Verify Hosts' })).toBeVisible();
		await expect(page.getByText('Host Applicant')).toBeVisible();
	});
});
