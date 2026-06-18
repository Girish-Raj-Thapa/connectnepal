import { expect, test } from '@playwright/test';
import { mockApi } from '../support/mockApi';

test.describe('Intelligent feature flow', () => {
	test('traveller can review notifications and use the chatbot assistant @system', async ({ page }) => {
		await mockApi(page, { role: 'traveller' });

		await page.goto('/traveller-dashboard');

		await page.getByRole('button', { name: 'Notifications' }).click();
		await expect(page.getByText('Booking confirmed')).toBeVisible();
		await page.getByRole('link', { name: 'View all notifications' }).click();

		await expect(page).toHaveURL(/\/notifications$/);
		await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
		await expect(page.getByText('Your booking for Pokhara Ridge Hike is confirmed.')).toBeVisible();

		await page.getByRole('button', { name: 'Open chat' }).click();
		await expect(page.getByText('ConnectNepal Assistant')).toBeVisible();

		await page.getByPlaceholder('Type your message...').fill('How do I book an experience?');
		await page.getByRole('button', { name: 'Send message' }).click();

		await expect(
			page.getByText('Choose a listing, select a date, and complete checkout.'),
		).toBeVisible();
	});
});
