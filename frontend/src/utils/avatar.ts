const AVATAR_GRADIENTS = [
	'from-red-400 to-red-600',
	'from-blue-400 to-blue-600',
	'from-green-400 to-green-600',
	'from-purple-400 to-purple-600',
	'from-teal-400 to-teal-600',
	'from-orange-400 to-orange-600',
];

/**
 * Returns a Tailwind gradient class pair based on the first character of the
 * provided initials string. Cycles deterministically through AVATAR_GRADIENTS.
 */
export const getAvatarGradient = (initials: string): string => {
	if (!initials) return AVATAR_GRADIENTS[0];
	return AVATAR_GRADIENTS[initials.charCodeAt(0) % AVATAR_GRADIENTS.length];
};
