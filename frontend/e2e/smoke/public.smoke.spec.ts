import { expect, test } from '@playwright/test';
import { mockApi } from '../support/mockApi';

test.describe('Public smoke', () => {
	test('guest can load the home page and open the chatbot @smoke', async ({ page }) => {
		await mockApi(page, { role: 'guest' });

		await page.goto('/');

		await expect(page.getByRole('heading', { name: /Discover Nepal Through/i })).toBeVisible();
		await expect(page.getByText('Welcome to ConnectNepal!')).toBeVisible();

		await page.getByRole('button', { name: 'Open chat' }).click();
		await expect(page.getByText('ConnectNepal Assistant')).toBeVisible();
	});

	test('guest can load login and listings pages @smoke', async ({ page }) => {
		await mockApi(page, { role: 'guest' });

		await page.goto('/login');
		await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

		await page.goto('/listings');
		await expect(page.getByRole('heading', { name: "Discover Nepal's Heart" })).toBeVisible();
		await expect(page.getByText('Showing 1 experience')).toBeVisible();
		await expect(page.getByText('Pokhara Ridge Hike')).toBeVisible();
	});

	test('guest is redirected to login for protected traveller routes @smoke', async ({ page }) => {
		await mockApi(page, { role: 'guest' });

		await page.goto('/traveller-dashboard');

		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
	});
});
