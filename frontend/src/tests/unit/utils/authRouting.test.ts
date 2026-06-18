import { describe, expect, it } from 'vitest';
import type { Account, UserRole } from '@/types/accounts';
import { ROUTES } from '@/constants/routes';
import { getPostLoginRoute, isOnboardingComplete } from '@utils/authRouting';

const buildUser = (
	role: UserRole,
	overrides: Partial<Account> = {},
): Account => ({
	userId: 1,
	email: `${role}@example.com`,
	role,
	hasCompletedOnboarding: false,
	onboardingStep: 0,
	...overrides,
});

describe('authRouting', () => {
	it('routes travellers to the correct onboarding step', () => {
		expect(getPostLoginRoute(buildUser('traveller', { onboardingStep: 0 }))).toBe(
			ROUTES.TRAVELLER_ONBOARDING_BASIC,
		);
		expect(getPostLoginRoute(buildUser('traveller', { onboardingStep: 1 }))).toBe(
			ROUTES.TRAVELLER_ONBOARDING_PREFERENCES,
		);
		expect(getPostLoginRoute(buildUser('traveller', { onboardingStep: 2 }))).toBe(
			ROUTES.TRAVELLER_DASHBOARD,
		);
	});

	it('routes hosts to the correct onboarding step', () => {
		expect(getPostLoginRoute(buildUser('host', { onboardingStep: 0 }))).toBe(
			ROUTES.HOST_ONBOARDING_BASIC,
		);
		expect(getPostLoginRoute(buildUser('host', { onboardingStep: 1 }))).toBe(
			ROUTES.HOST_ONBOARDING_BUSINESS,
		);
		expect(getPostLoginRoute(buildUser('host', { onboardingStep: 2 }))).toBe(
			ROUTES.HOST_DASHBOARD,
		);
	});

	it('always routes admins to the admin dashboard', () => {
		expect(getPostLoginRoute(buildUser('admin'))).toBe(ROUTES.ADMIN_DASHBOARD);
		expect(isOnboardingComplete(buildUser('admin'))).toBe(true);
	});

	it('prefers onboardingStep over hasCompletedOnboarding when the step is finite', () => {
		const user = buildUser('traveller', {
			hasCompletedOnboarding: true,
			onboardingStep: 1,
		});

		expect(isOnboardingComplete(user)).toBe(false);
		expect(getPostLoginRoute(user)).toBe(ROUTES.TRAVELLER_ONBOARDING_PREFERENCES);
	});

	it('falls back to hasCompletedOnboarding when onboardingStep is not finite', () => {
		const user = buildUser('host', {
			hasCompletedOnboarding: true,
			onboardingStep: Number.NaN,
		});

		expect(isOnboardingComplete(user)).toBe(true);
		expect(getPostLoginRoute(user)).toBe(ROUTES.HOST_DASHBOARD);
	});
});
