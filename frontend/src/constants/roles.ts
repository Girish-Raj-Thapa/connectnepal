/**
 * User Roles
 * ----------
 * Constants for user role types throughout the application.
 */

export const USER_ROLES = Object.freeze({
	ADMIN: 'admin',
	TRAVELLER: 'traveller',
	HOST: 'host',
} as const);

export type UserRoleKey = keyof typeof USER_ROLES;
export type UserRoleValue = (typeof USER_ROLES)[UserRoleKey];
