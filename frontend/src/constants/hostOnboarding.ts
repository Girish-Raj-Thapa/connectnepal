/**
 * Host Onboarding Constants
 * -------------------------
 * Sidebar content for host onboarding steps.
 */

export const HOST_SIDEBAR = {
    1: {
		heading: 'Set Up Your\nHosting Profile',
		description:
			'Join the ConnectNepal community and share your unique experiences with travellers from around the world.',
		bullets: [
			'Earn by sharing local culture',
			'Get bookings directly from travellers',
			'Build trust with verified host profile',
		],
	},
	2: {
		heading: 'Tell Us About\nYour Business',
		description:
			'Provide your business details so travellers can find and trust your services on ConnectNepal.',
		bullets: [
			'Showcase your unique offerings',
			'Attract the right travellers',
			'Stand out with a complete profile',
		],
	},
	3: {
		heading: 'Upload Your\nVerification Documents',
		description:
			'Submit your documents for verification so travellers can trust your services. This step is optional and can be completed later.',
		bullets: [
			'Get verified faster with complete documents',
			'Build trust with a verified badge',
			'Upload citizenship, PAN, or business license',
		],
	},
	4: {
		heading: "Congratulations,\nYou're Now a Host!",
		description:
			'Your profile setup is complete and your verification is under review. You can start adding your listings while we verify your documents within 24–48 hours.',
		bullets: [
			'Create and publish your first listing',
			'Reach travellers from across the world',
			'Manage your bookings in one dashboard',
		],
	},
} as const;
