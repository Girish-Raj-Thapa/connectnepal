import type { Account } from '@/types/accounts';
import { ROUTES } from '@/constants/routes';

const assertNever = (role: never): never => {
	throw new Error(`Unhandled role in routing: ${String(role)}`);
};

/**
 * Determine the onboarding route based on role + current step.
*/
const getOnboardingRoute = (user: Account): string => {
	if (user.role === 'traveller') {
		switch (user.onboardingStep) {
			case 0:
				return ROUTES.TRAVELLER_ONBOARDING_BASIC;
			case 1:
				return ROUTES.TRAVELLER_ONBOARDING_PREFERENCES;
			default:
				return ROUTES.TRAVELLER_ONBOARDING_COMPLETE;
		}
	}

	if (user.role === 'host') {
		switch (user.onboardingStep) {
			case 0:
				return ROUTES.HOST_ONBOARDING_BASIC;
			case 1:
				return ROUTES.HOST_ONBOARDING_BUSINESS;
			default:
				return ROUTES.HOST_ONBOARDING_COMPLETE;
		}
	}

	return ROUTES.ADMIN_DASHBOARD;
};

/**
 * Centralized onboarding completion check.
 * Uses onboardingStep when available to avoid stale/mismatched flags.
 */
export const isOnboardingComplete = (user: Account): boolean => {
	if (user.role === 'admin') return true;

	if (Number.isFinite(user.onboardingStep)) {
		return user.onboardingStep >= 2;
	}

	return user.hasCompletedOnboarding;
};

/**
 * Single source of truth for post-login navigation.
 * Checks onboarding completion first, then routes by role.
 */
export const getPostLoginRoute = (user: Account) => {
	if (!isOnboardingComplete(user)) {
		return getOnboardingRoute(user);
	}

	switch (user.role) {
		case 'host':
			return ROUTES.HOST_DASHBOARD;
		case 'admin':
			return ROUTES.ADMIN_DASHBOARD;
		case 'traveller':
			return ROUTES.TRAVELLER_DASHBOARD;
		default:
			return assertNever(user.role);
	}
};

export default getPostLoginRoute;
