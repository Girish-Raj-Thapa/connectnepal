import { USER_ROLES } from './roles';

export const ROLE_OPTIONS = [
	{ value: USER_ROLES.TRAVELLER, label: 'Tourist' },
	{ value: USER_ROLES.HOST, label: 'Host' },
] as const;
