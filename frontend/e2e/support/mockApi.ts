import type { Page, Route } from '@playwright/test';

type Role = 'guest' | 'traveller' | 'host' | 'admin';

interface MockApiOptions {
	role?: Role;
}

const json = async (route: Route, status: number, body: unknown) => {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body),
	});
};

const buildUser = (role: Exclude<Role, 'guest'>) => {
	const base = {
		userId: 1,
		email: `${role}@example.com`,
		role,
		hasCompletedOnboarding: true,
		onboardingStep: 2,
		firstName: role[0].toUpperCase() + role.slice(1),
		lastName: 'User',
		fullName: `${role[0].toUpperCase() + role.slice(1)} User`,
		profilePhoto: null,
	};

	return base;
};

const travellerOverview = {
	summary: {
		activeTripPlans: 2,
		upcomingBookings: 1,
		completedTrips: 4,
		reviewsWritten: 3,
	},
	previews: {
		upcomingBookings: [
			{
				bookingItemId: 1,
				bookingId: 101,
				bookingReference: 'BK-101',
				targetType: 'listing',
				targetId: 10,
				title: 'Pokhara Ridge Hike',
				startDate: '2026-05-20',
				endDate: null,
				status: 'confirmed',
				quotedTotal: '2500',
				currency: 'NPR',
			},
		],
		tripPlans: [
			{
				id: 1,
				title: 'Spring Nepal',
				status: 'planning',
				statusDisplay: 'Planning',
				startDate: null,
				endDate: null,
				estimatedCost: '12000',
				updatedAt: '2026-05-01T00:00:00Z',
			},
		],
	},
};

const hostOverview = {
	summary: {
		activeListings: 3,
		totalBookings: 9,
		thisMonthEarnings: '15000',
		averageRating: '4.8',
		reviewCount: 6,
	},
	trends: {
		monthlyEarnings: [{ month: '2026-04', amount: '15000' }],
		monthlyBookings: [{ month: '2026-04', count: 9 }],
	},
	previews: {
		recentBookings: [
			{
				bookingItemId: 1,
				bookingId: 99,
				bookingReference: 'BK-99',
				targetType: 'listing',
				targetId: 10,
				title: 'Pokhara Ridge Hike',
				travellerName: 'Demo Traveller',
				travellerEmail: 'traveller@example.com',
				status: 'confirmed',
				startDate: '2026-05-20',
				endDate: null,
				quotedTotal: '2500',
				currency: 'NPR',
				createdAt: '2026-05-01T00:00:00Z',
			},
		],
		topPerformingListings: [
			{
				listingId: 10,
				title: 'Pokhara Ridge Hike',
				category: 'adventure',
				destination: 'Pokhara',
				bookingCount: 9,
				ratingAverage: '4.8',
				ratingCount: 6,
				isActive: true,
				isBookable: true,
			},
		],
	},
};

const adminOverview = {
	summary: {
		totalUsers: 120,
		activeHosts: 15,
		totalListings: 42,
		totalRevenue: '120000',
		totalBookings: 88,
		activePackages: 7,
		totalReviews: 31,
		averagePlatformRating: '4.6',
		openComplaints: 3,
	},
	trends: {
		monthlyRevenue: [{ month: '2026-04', amount: '120000' }],
		monthlyBookings: [{ month: '2026-04', count: 88 }],
	},
	distributions: {
		listingsByCategory: [{ category: 'adventure', categoryDisplay: 'Adventure', count: 20 }],
	},
	previews: {
		recentActivity: [
			{
				source: 'system',
				occurredAt: '2026-05-01T00:00:00Z',
				actorName: 'System',
				actorRole: 'admin',
				action: 'created',
				entityType: 'listing',
				entityId: 10,
				label: 'Listing created',
				description: 'A listing was created',
			},
		],
	},
	topPerformance: {
		listings: [
			{
				listingId: 10,
				title: 'Pokhara Ridge Hike',
				hostId: 2,
				hostName: 'Host User',
				bookingCount: 9,
				ratingAverage: '4.8',
				ratingCount: 6,
			},
		],
		hosts: [
			{
				hostId: 2,
				hostName: 'Host User',
				businessName: 'Host Co',
				bookingCount: 9,
				averageRating: '4.8',
				reviewCount: 6,
				verificationStatus: 'verified',
			},
		],
	},
};

const notificationsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 1,
			notificationType: 'booking_confirmed',
			priority: 'normal',
			title: 'Booking confirmed',
			body: 'Your booking for Pokhara Ridge Hike is confirmed.',
			actionUrl: '',
			imageUrl: '',
			metadata: { bookingId: 101 },
			actorName: 'System',
			isRead: false,
			readAt: null,
			isArchived: false,
			createdAt: '2026-05-01T00:00:00Z',
		},
	],
};

const tripPlansPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 1,
			title: 'Spring Nepal',
			status: 'planning',
			statusDisplay: 'Planning',
			startDate: '2026-05-20',
			endDate: '2026-05-24',
			itemCount: 1,
			estimatedCost: '12000',
			updatedAt: '2026-05-01T00:00:00Z',
		},
	],
};

const tripPlanDetail = {
	id: 1,
	title: 'Spring Nepal',
	status: 'planning',
	statusDisplay: 'Planning',
	startDate: '2026-05-20',
	endDate: '2026-05-24',
	totalDays: 5,
	travellersCount: 2,
	estimatedCost: '12000',
	coverImage: '',
	itemCount: 1,
	createdAt: '2026-05-01T00:00:00Z',
	updatedAt: '2026-05-01T00:00:00Z',
	itemsByDay: {
		'1': [
			{
				id: 301,
				listing: {
					id: 10,
					title: 'Pokhara Ridge Hike',
					slug: 'pokhara-ridge-hike',
					destination: 'Pokhara',
					category: 'adventure',
					categoryDisplay: 'Adventure',
					durationType: 'full_day',
					pricePerPerson: '2500',
					durationDisplay: '1 day',
					primaryImageThumbnail: null,
					isBookable: true,
					isActive: true,
				},
				dayNumber: 1,
				order: 0,
				priceSnapshot: '2500',
				durationHoursSnapshot: '6',
				durationTypeSnapshot: 'full_day',
				durationDaysSnapshot: 1,
				durationNightsSnapshot: 0,
				notes: '',
				addedAt: '2026-05-01T00:00:00Z',
				isAvailableForBooking: true,
				availabilityMessage: null,
			},
		],
	},
};

const bookingsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 101,
			reference: 'BK-101',
			status: 'confirmed',
			quotedTotal: '2500',
			currency: 'NPR',
			source: 'direct',
			createdAt: '2026-05-01T10:00:00Z',
			items: [
				{
					id: 201,
					targetType: 'listing',
					targetId: 10,
					listingId: 10,
					packageId: null,
					title: 'Pokhara Ridge Hike',
					travellerCount: 2,
					unitPrice: '1250',
					quotedTotal: '2500',
					status: 'confirmed',
					startDate: '2026-05-20',
					endDate: null,
				},
			],
		},
	],
};

const travellerReviewsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 1,
			traveller: { id: 1, firstName: 'Traveller' },
			listingId: 10,
			packageId: null,
			listingTitle: 'Pokhara Ridge Hike',
			packageTitle: null,
			rating: 5,
			comment: 'Fantastic local guide and smooth day trip.',
			status: 'published',
			hostReply: 'Thank you for travelling with us!',
			hostReplyStatus: 'published',
			hostRepliedAt: '2026-05-03T00:00:00Z',
			hasReply: true,
			editedAt: null,
			editCount: 0,
			canEdit: true,
			canDelete: true,
			createdAt: '2026-05-02T00:00:00Z',
		},
	],
};

const hostReviewsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 1,
			reviewId: 1,
			travellerName: 'Demo Traveller',
			travellerEmail: 'traveller@example.com',
			listingId: 10,
			packageId: null,
			listingTitle: 'Pokhara Ridge Hike',
			packageTitle: null,
			rating: 5,
			comment: 'Fantastic local guide and smooth day trip.',
			status: 'published',
			replyStatus: 'awaiting_reply',
			hostReply: '',
			hostReplyUpdatedAt: null,
			canReply: true,
			canReport: true,
			reported: false,
			createdAt: '2026-05-02T00:00:00Z',
		},
	],
};

const filedComplaintsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 1,
			category: 'refund_dispute',
			title: 'Refund was delayed',
			severity: 'medium',
			status: 'submitted',
			filerName: 'Traveller User',
			filedByRole: 'traveller',
			targetLabel: 'Pokhara Ridge Hike',
			eventCount: 1,
			evidenceCount: 0,
			createdAt: '2026-05-01T00:00:00Z',
		},
	],
};

const receivedComplaintsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 2,
			category: 'conduct_issue',
			title: 'Host filed complaint',
			severity: 'low',
			status: 'under_review',
			filerName: 'Host User',
			filedByRole: 'host',
			targetLabel: 'Booking BK-101',
			eventCount: 1,
			evidenceCount: 0,
			createdAt: '2026-05-03T00:00:00Z',
		},
	],
};

const chatSessionsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 10,
			title: 'Booking help',
			createdAt: '2026-05-01T10:00:00Z',
			updatedAt: '2026-05-01T10:05:00Z',
			messageCount: 3,
		},
	],
};

const chatSessionDetail = {
	id: 10,
	title: 'Booking help',
	createdAt: '2026-05-01T10:00:00Z',
	messages: [
		{
			role: 'user',
			content: 'How do I book?',
			intent: 'booking_info',
			createdAt: '2026-05-01T10:01:00Z',
		},
		{
			role: 'assistant',
			content: 'Choose a listing, select a date, and complete checkout.',
			intent: 'booking_info',
			createdAt: '2026-05-01T10:01:05Z',
		},
	],
};

const adminHostsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			userId: 22,
			fullName: 'Host Applicant',
			email: 'host-applicant@example.com',
			businessName: 'Host Co',
			documentCount: 3,
			verificationStatus: 'pending',
		},
	],
};

const adminComplaintsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 11,
			category: 'conduct_issue',
			title: 'Unsafe guest conduct',
			severity: 'high',
			status: 'under_review',
			filerName: 'Host User',
			filedByRole: 'host',
			targetLabel: 'Booking BK-99',
			eventCount: 2,
			evidenceCount: 1,
			createdAt: '2026-05-04T00:00:00Z',
		},
	],
};

const adminReviewReportsPage = {
	count: 1,
	next: null,
	previous: null,
	results: [
		{
			id: 51,
			reviewId: 1,
			targetType: 'review',
			reportedByName: 'Host User',
			reporterName: 'Host User',
			reason: 'abusive_language',
			status: 'open',
			rating: 2,
			reviewStatus: 'under_review',
			reviewComment: 'This review contains abusive language.',
			listingTitle: 'Pokhara Ridge Hike',
			packageTitle: null,
			hostReply: null,
			hostReplyStatus: 'none',
			createdAt: '2026-05-05T00:00:00Z',
		},
	],
};

export const mockApi = async (page: Page, options: MockApiOptions = {}) => {
	const role = options.role ?? 'guest';

	await page.route('**/api/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const pathname = url.pathname;
		const method = request.method();

		if (pathname.endsWith('/accounts/token/refresh/') && method === 'POST') {
			if (role === 'guest') {
				await json(route, 401, { detail: 'No active session' });
				return;
			}

			await json(route, 200, { access: 'playwright-access-token' });
			return;
		}

		if (pathname.endsWith('/accounts/me/') && method === 'GET') {
			if (role === 'guest') {
				await json(route, 401, { detail: 'Authentication required' });
				return;
			}

			await json(route, 200, buildUser(role));
			return;
		}

		if (pathname.endsWith('/accounts/logout/') && method === 'POST') {
			await json(route, 200, {});
			return;
		}

		if (pathname.endsWith('/notifications/unread-count/') && method === 'GET') {
			await json(route, 200, { unreadCount: role === 'guest' ? 0 : 2 });
			return;
		}

		if (pathname.endsWith('/notifications/recent/') && method === 'GET') {
			await json(route, 200, notificationsPage.results);
			return;
		}

		if (pathname.endsWith('/notifications/') && method === 'GET') {
			await json(route, 200, notificationsPage);
			return;
		}

		if (pathname.endsWith('/notifications/mark-all-read/') && method === 'POST') {
			await json(route, 200, { updated: 2, unreadCount: 0 });
			return;
		}

		if (/\/notifications\/\d+\/mark-read\/$/.test(pathname) && method === 'POST') {
			await json(route, 200, {
				id: 1,
				notificationType: 'booking_confirmed',
				priority: 'normal',
				title: 'Booking confirmed',
				body: 'Your booking is confirmed.',
				actionUrl: '',
				imageUrl: '',
				metadata: { bookingId: 101 },
				actorName: 'System',
				isRead: true,
				readAt: '2026-05-01T00:00:00Z',
				isArchived: false,
				createdAt: '2026-05-01T00:00:00Z',
			});
			return;
		}

		if (pathname.endsWith('/recommendations/for-you/') && method === 'GET') {
			if (role !== 'traveller') {
				await json(route, 403, { detail: 'Forbidden' });
				return;
			}

			await json(route, 200, {
				results: [],
				meta: null,
			});
			return;
		}

		if (pathname.endsWith('/recommendations/packages/for-you/') && method === 'GET') {
			if (role !== 'traveller') {
				await json(route, 403, { detail: 'Forbidden' });
				return;
			}

			await json(route, 200, {
				results: [],
				meta: null,
			});
			return;
		}

		if (pathname.endsWith('/listings/') && method === 'GET') {
			await json(route, 200, {
				count: 1,
				next: null,
				previous: null,
				results: [
					{
						id: 10,
						slug: 'pokhara-ridge-hike',
						title: 'Pokhara Ridge Hike',
						shortDescription: 'Scenic ridge walk above the lake.',
						destination: 'Pokhara',
						category: 'adventure',
						categoryDisplay: 'Adventure',
						activityType: 'hiking',
						difficultyLevel: 'easy',
						difficultyDisplay: 'Easy',
						pricePerPerson: '2500',
						durationType: 'full_day',
						averageDurationHours: '6',
						durationDays: 1,
						durationNights: 0,
						durationDisplay: '1 day',
						ratingAverage: '4.7',
						ratingCount: 12,
						hostName: 'Trail Guides Nepal',
						hostIsVerified: true,
						instantBooking: true,
						primaryImageThumbnail: null,
						position: 1,
					},
				],
			});
			return;
		}

		if (pathname.endsWith('/packages/') && method === 'GET') {
			await json(route, 200, {
				count: 1,
				next: null,
				previous: null,
				results: [
					{
						id: 20,
						title: 'Annapurna Highlights',
						slug: 'annapurna-highlights',
						description: 'Curated package',
						durationDays: 4,
						durationNights: 3,
						totalPrice: '18000',
						discountLabel: 'Save 10%',
						tags: ['trekking'],
						listingCount: 3,
						includedListingNames: ['Pokhara Ridge Hike', 'Annapurna Sunrise', 'Village Food Walk'],
						coverImageUrl: null,
						hostName: 'Annapurna Local Co',
						bookingCount: 4,
						isBookable: true,
						hasUpcomingSlots: true,
						nextAvailableSlot: {
							id: 1,
							startDate: '2026-05-20',
							endDate: '2026-05-23',
						},
						createdAt: '2026-05-01T00:00:00Z',
					},
				],
			});
			return;
		}

		if (pathname.endsWith('/trip-planner/') && method === 'GET') {
			await json(route, 200, tripPlansPage);
			return;
		}

		if (/\/trip-planner\/\d+\/$/.test(pathname) && method === 'GET') {
			await json(route, 200, tripPlanDetail);
			return;
		}

		if (pathname.endsWith('/bookings/') && method === 'GET') {
			await json(route, 200, bookingsPage);
			return;
		}

		if (pathname.endsWith('/reviews/') && method === 'GET') {
			await json(route, 200, travellerReviewsPage);
			return;
		}

		if (pathname.endsWith('/host/reviews/') && method === 'GET') {
			await json(route, 200, hostReviewsPage);
			return;
		}

		if (pathname.endsWith('/traveller/complaints/') && method === 'GET') {
			await json(route, 200, filedComplaintsPage);
			return;
		}

		if (pathname.endsWith('/traveller/complaints/received/') && method === 'GET') {
			await json(route, 200, receivedComplaintsPage);
			return;
		}

		if (pathname.endsWith('/chatbot/sessions/') && method === 'GET') {
			await json(route, 200, chatSessionsPage);
			return;
		}

		if (/\/chatbot\/sessions\/\d+\/$/.test(pathname) && method === 'GET') {
			await json(route, 200, chatSessionDetail);
			return;
		}

		if (pathname.endsWith('/chatbot/chat/') && method === 'POST') {
			await json(route, 200, {
				reply: 'Choose a listing, select a date, and complete checkout.',
				sessionId: 10,
				intent: 'booking_info',
			});
			return;
		}

		if (pathname.endsWith('/accounts/admin/hosts/') && method === 'GET') {
			await json(route, 200, adminHostsPage);
			return;
		}

		if (pathname.endsWith('/admin/complaints/') && method === 'GET') {
			await json(route, 200, adminComplaintsPage);
			return;
		}

		if (pathname.endsWith('/admin/review-reports/') && method === 'GET') {
			await json(route, 200, adminReviewReportsPage);
			return;
		}

		if (pathname.endsWith('/analytics/traveller/overview/') && method === 'GET') {
			await json(route, 200, travellerOverview);
			return;
		}

		if (pathname.endsWith('/analytics/host/overview/') && method === 'GET') {
			await json(route, 200, hostOverview);
			return;
		}

		if (pathname.endsWith('/analytics/admin/overview/') && method === 'GET') {
			await json(route, 200, adminOverview);
			return;
		}

		await json(route, 404, {
			detail: `Unhandled mock for ${method} ${pathname}`,
		});
	});
};
