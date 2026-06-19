import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PrivateRoutes from './PrivateRoutes';
import RoleRoutes from './RoleRoutes';
import PageLoader from '@components/feedback/PageLoader';
import { FEATURE_FLAGS } from '@config/features';
import { ROUTES } from '@/constants/routes';

// Lazy load auth pages
const Register = lazy(() => import('@pages/auth/Register'));
const EmailConfirmation = lazy(() => import('@pages/auth/EmailConfirmation'));
const EmailVerified = lazy(() => import('@pages/auth/EmailVerified'));
const Login = lazy(() => import('@pages/auth/Login'));
const ForgotPassword = lazy(() => import('@pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@pages/auth/ResetPassword'));

// Lazy load public pages
const Home = lazy(() => import('@pages/public/Home'));
const AboutUs = lazy(() => import('@pages/public/AboutUs'));
const FAQs = lazy(() => import('@pages/public/FAQs'));
const CommunityGuidelines = lazy(() => import('@pages/public/CommunityGuidelines'));
const TrustAndSafety = lazy(() => import('@pages/public/TrustAndSafety'));
const NotFound = lazy(() => import('@pages/public/NotFound'));
const PublicListings = lazy(
	() => import('@pages/public/listings/PublicListings'),
);
const PublicListingDetails = lazy(
	() => import('@pages/public/listings/PublicListingDetails'),
);
const PublicPackageDetail = lazy(
	() => import('@pages/public/packages/PublicPackageDetail'),
);
const PackageBooking = lazy(
	() => import('@pages/public/packages/PackageBooking'),
);

// Lazy load protected pages
const TravellerDashboard = lazy(() => import('@pages/traveller/TravellerDashboard'));
const TravellerComplaints = lazy(
	() => import('@pages/traveller/complaints/TravellerComplaints'),
);
const FileComplaint = lazy(
	() => import('@pages/traveller/complaints/FileComplaint'),
);
const TravellerComplaintDetail = lazy(
	() => import('@pages/traveller/complaints/TravellerComplaintDetail'),
);
const ReceivedComplaintDetail = lazy(
	() => import('@pages/traveller/complaints/ReceivedComplaintDetail'),
);
const Settings = lazy(() => import('@pages/traveller/Settings'));
const HostDashboard = lazy(() => import('@pages/host/HostDashboard'));
const AdminDashboard = lazy(() => import('@pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@pages/admin/users/AdminUsers'));
const AdminVerifyHosts = lazy(
	() => import('@pages/admin/hosts/AdminVerifyHosts'),
);
const AdminVerifyHostDetail = lazy(
	() => import('@pages/admin/hosts/AdminVerifyHostDetail'),
);
const AdminComplaints = lazy(
	() => import('@pages/admin/complaints/AdminComplaints'),
);
const AdminComplaintDetail = lazy(
	() => import('@pages/admin/complaints/AdminComplaintDetail'),
);
const AdminUserDetail = lazy(
	() => import('@pages/admin/users/AdminUserDetail'),
);
const AdminBookings = lazy(
	() => import('@pages/admin/bookings/AdminBookings'),
);

// Lazy load Traveller onboarding pages
const BasicProfile = lazy(
	() => import('@pages/traveller/onboarding/BasicProfile'),
);
const TravellerPreferences = lazy(
	() => import('@pages/traveller/onboarding/TravellerPreferences'),
);
const OnboardingComplete = lazy(
	() => import('@pages/traveller/onboarding/OnboardingComplete'),
);

// Lazy load Host onboarding pages
const HostBasicProfile = lazy(
	() => import('@pages/host/onboarding/HostBasicProfile'),
);
const HostBusinessInfo = lazy(
	() => import('@pages/host/onboarding/HostBusinessInfo'),
);
const HostDocumentUpload = lazy(
	() => import('@pages/host/onboarding/HostDocumentUpload'),
);
const HostOnboardingComplete = lazy(
	() => import('@pages/host/onboarding/HostOnboardingComplete'),
);

// Lazy load traveller trip planner pages
const TripPlansList = lazy(
	() => import('@pages/traveller/trips/TripPlansList'),
);
const TripPlannerDetail = lazy(
	() => import('@pages/traveller/trips/TripPlannerDetail'),
);

// Booking checkout — standalone page (Navbar only, no sidebar)
const BookingCheckout = lazy(
	() => import('@pages/traveller/bookings/BookingCheckout'),
);

// Lazy load traveller booking pages
const MyBookings = lazy(
	() => import('@pages/traveller/bookings/MyBookings'),
);
const BookingDetail = lazy(
	() => import('@pages/traveller/bookings/BookingDetail'),
);
const BookFromTrip = lazy(
	() => import('@pages/traveller/bookings/BookFromTrip'),
);

// Lazy load host booking pages
const ManageBookings = lazy(
	() => import('@pages/host/bookings/ManageBookings'),
);
const BookingItemDetail = lazy(
	() => import('@pages/host/bookings/BookingItemDetail'),
);

// Lazy load payment pages
const BookingPayment = lazy(
	() => import('@pages/traveller/bookings/BookingPayment'),
);
const PaymentProcessing = lazy(
	() => import('@pages/payment/PaymentProcessing'),
);
const PaymentSuccess = lazy(
	() => import('@pages/payment/PaymentSuccess'),
);
const PaymentFailure = lazy(
	() => import('@pages/payment/PaymentFailure'),
);

// Lazy load host listing pages
const ManageListings = lazy(
	() => import('@pages/host/listings/ManageListings'),
);
const CreateListing = lazy(
	() => import('@pages/host/listings/CreateListing'),
);
const EditListing = lazy(
	() => import('@pages/host/listings/EditListing'),
);
const ManageSlots = lazy(
	() => import('@pages/host/listings/ManageSlots'),
);

// Lazy load host package pages
const ManagePackages = lazy(
	() => import('@pages/host/packages/ManagePackages'),
);
const CreatePackage = lazy(
	() => import('@pages/host/packages/CreatePackage'),
);
const EditPackage = lazy(
	() => import('@pages/host/packages/EditPackage'),
);
const ManagePackageSlots = lazy(
	() => import('@pages/host/packages/ManagePackageSlots'),
);

// Lazy load reviews pages
const HostReviews = lazy(
	() => import('@pages/host/reviews/HostReviews'),
);

// Lazy load host complaint pages
const HostComplaints = lazy(
	() => import('@pages/host/complaints/HostComplaints'),
);
const HostFileComplaint = lazy(
	() => import('@pages/host/complaints/HostFileComplaint'),
);
const HostComplaintDetail = lazy(
	() => import('@pages/host/complaints/HostComplaintDetail'),
);
const HostReceivedComplaintDetail = lazy(
	() => import('@pages/host/complaints/HostReceivedComplaintDetail'),
);
const TravellerReviews = lazy(
	() => import('@pages/traveller/reviews/TravellerReviews'),
);
const ModerationDashboard = lazy(
	() => import('@pages/admin/reviews/ModerationDashboard'),
);

const NotificationsPage = lazy(
  () => import('@pages/notifications/NotificationsPage'),
);
const ChatHistory = lazy(
  () => import('@pages/traveller/chat/ChatHistory'),
);

const AppRoutes = () => {
	return (
		<Suspense fallback={<PageLoader />}>
			<Routes>
				<Route path={ROUTES.REGISTER} element={<Register />} />
				<Route path={ROUTES.EMAIL_CONFIRMATION} element={<EmailConfirmation />} />
				<Route path={ROUTES.ACTIVATE} element={<EmailVerified />} />
				<Route path={ROUTES.LOGIN} element={<Login />} />
				<Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
				<Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />

					{/* Public Routes (Guest + Traveller only) */}
					<Route
						element={
							<RoleRoutes
								allowGuests
								allowedRoles={['traveller']}
							/>
						}
					>
						<Route path={ROUTES.HOME} element={<Home />} />
						<Route path={ROUTES.ABOUT_US} element={<AboutUs />} />
						<Route path={ROUTES.FAQS} element={<FAQs />} />
						<Route path={ROUTES.COMMUNITY_GUIDELINES} element={<CommunityGuidelines />} />
						<Route path={ROUTES.TRUST_AND_SAFETY} element={<TrustAndSafety />} />
						<Route path={ROUTES.PUBLIC_LISTINGS} element={<PublicListings />} />
						<Route path={ROUTES.PUBLIC_LISTING_DETAIL} element={<PublicListingDetails />} />
						<Route path={ROUTES.PUBLIC_PACKAGE_DETAIL} element={<PublicPackageDetail />} />
					</Route>

				{/* Private Routes (Protected) */}
					<Route element={<PrivateRoutes />}>
					
					{/* Notification Page  */}
					<Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />

						{/* Traveller-only Routes */}
						<Route element={<RoleRoutes allowedRoles={['traveller']} />}>
							{/* Booking Checkout — auth required */}
							<Route
								path={ROUTES.LISTING_BOOKING_CHECKOUT}
								element={<BookingCheckout />}
							/>
							<Route
								path={ROUTES.PACKAGE_BOOKING_CHECKOUT}
								element={<PackageBooking />}
							/>

						<Route path={ROUTES.TRAVELLER_DASHBOARD} element={<TravellerDashboard />} />
						<Route
							path={ROUTES.TRAVELLER_TRIPS}
							element={<TripPlansList />}
						/>
						<Route
							path={ROUTES.TRAVELLER_TRIP_DETAIL}
							element={<TripPlannerDetail />}
						/>

						{/* Traveller Booking Routes */}
						<Route path={ROUTES.TRAVELLER_BOOKINGS} element={<MyBookings />} />
						{/* IMPORTANT: from-trip must be before :id to avoid collision */}
						<Route
							path={ROUTES.TRAVELLER_BOOK_FROM_TRIP}
							element={<BookFromTrip />}
						/>
						<Route
							path={ROUTES.TRAVELLER_BOOKING_DETAIL}
							element={<BookingDetail />}
						/>
						<Route
							path={ROUTES.TRAVELLER_BOOKING_PAYMENT}
							element={<BookingPayment />}
						/>
							<Route
								path={ROUTES.TRAVELLER_REVIEWS}
								element={<TravellerReviews />}
							/>
							<Route
								path={ROUTES.TRAVELLER_COMPLAINTS}
								element={<TravellerComplaints />}
							/>
							<Route
								path={ROUTES.TRAVELLER_COMPLAINT_CREATE}
								element={<FileComplaint />}
							/>
							{/* IMPORTANT: received/:id must come before :id to avoid route collision */}
							<Route
								path={ROUTES.TRAVELLER_RECEIVED_COMPLAINT_DETAIL}
								element={<ReceivedComplaintDetail />}
							/>
							<Route
								path={ROUTES.TRAVELLER_COMPLAINT_DETAIL}
								element={<TravellerComplaintDetail />}
							/>
							<Route
								path={ROUTES.TRAVELLER_SETTINGS}
								element={<Settings />}
							/>
							{FEATURE_FLAGS.chatbot && (
								<Route
									path={ROUTES.TRAVELLER_CHAT_HISTORY}
									element={<ChatHistory />}
								/>
							)}

						{/* Payment callback landing pages */}
						<Route path={ROUTES.PAYMENT_PROCESSING} element={<PaymentProcessing />} />
						<Route path={ROUTES.PAYMENT_SUCCESS} element={<PaymentSuccess />} />
						<Route path={ROUTES.PAYMENT_FAILURE} element={<PaymentFailure />} />

						{/* Traveller Onboarding Routes */}
						<Route
							path={ROUTES.TRAVELLER_ONBOARDING_BASIC}
							element={<BasicProfile />}
						/>
						<Route
							path={ROUTES.TRAVELLER_ONBOARDING_PREFERENCES}
							element={<TravellerPreferences />}
						/>
						<Route
							path={ROUTES.TRAVELLER_ONBOARDING_COMPLETE}
							element={<OnboardingComplete />}
						/>
					</Route>

					{/* Host-only Routes */}
					<Route element={<RoleRoutes allowedRoles={['host']} />}>
						<Route path={ROUTES.HOST_DASHBOARD} element={<HostDashboard />} />

						{/* Host Onboarding Routes */}
						<Route
							path={ROUTES.HOST_ONBOARDING_BASIC}
							element={<HostBasicProfile />}
						/>
						<Route
							path={ROUTES.HOST_ONBOARDING_BUSINESS}
							element={<HostBusinessInfo />}
						/>
						<Route
							path={ROUTES.HOST_ONBOARDING_DOCUMENTS}
							element={<HostDocumentUpload />}
						/>
						<Route
							path={ROUTES.HOST_ONBOARDING_COMPLETE}
							element={<HostOnboardingComplete />}
						/>
						<Route
							path={ROUTES.HOST_LISTINGS}
							element={<ManageListings />}
						/>
						<Route
							path={ROUTES.HOST_CREATE_LISTING}
							element={<CreateListing />}
						/>
						<Route
							path={ROUTES.HOST_EDIT_LISTING}
							element={<EditListing />}
						/>
						<Route
							path={ROUTES.HOST_MANAGE_SLOTS}
							element={<ManageSlots />}
						/>

						{/* Host Package Routes */}
						<Route
							path={ROUTES.HOST_PACKAGES}
							element={<ManagePackages />}
						/>
						<Route
							path={ROUTES.HOST_CREATE_PACKAGE}
							element={<CreatePackage />}
						/>
						<Route
							path={ROUTES.HOST_EDIT_PACKAGE}
							element={<EditPackage />}
						/>
							<Route
								path={ROUTES.HOST_PACKAGE_SLOTS}
								element={<ManagePackageSlots />}
							/>

						{/* Host Booking Routes */}
						<Route path={ROUTES.HOST_BOOKINGS} element={<ManageBookings />} />
						<Route
							path={ROUTES.HOST_BOOKING_DETAIL}
							element={<BookingItemDetail />}
						/>

						{/* Host Reviews */}
							<Route
								path={ROUTES.HOST_REVIEWS}
								element={<HostReviews />}
							/>

						{/* Host Complaint Routes */}
						<Route
							path={ROUTES.HOST_COMPLAINTS}
							element={<HostComplaints />}
						/>
						<Route
							path={ROUTES.HOST_COMPLAINT_CREATE}
							element={<HostFileComplaint />}
						/>
						{/* IMPORTANT: received/:id must come before :id to avoid route collision */}
						<Route
							path={ROUTES.HOST_RECEIVED_COMPLAINT_DETAIL}
							element={<HostReceivedComplaintDetail />}
						/>
						<Route
							path={ROUTES.HOST_COMPLAINT_DETAIL}
							element={<HostComplaintDetail />}
						/>

							<Route
								path={ROUTES.HOST_SETTINGS}
								element={<Settings />}
							/>
						</Route>

						{/* Admin-only Routes */}
						<Route element={<RoleRoutes allowedRoles={['admin']} />}>
							<Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboard />} />
							<Route path={ROUTES.ADMIN_USERS} element={<AdminUsers />} />
							<Route path={ROUTES.ADMIN_USER_DETAIL} element={<AdminUserDetail />} />
							<Route path={ROUTES.ADMIN_VERIFY_HOSTS} element={<AdminVerifyHosts />} />
							<Route path={ROUTES.ADMIN_VERIFY_HOST_DETAIL} element={<AdminVerifyHostDetail />} />
							<Route path={ROUTES.ADMIN_COMPLAINTS} element={<AdminComplaints />} />
							<Route path={ROUTES.ADMIN_COMPLAINT_DETAIL} element={<AdminComplaintDetail />} />
							<Route path={ROUTES.ADMIN_BOOKINGS} element={<AdminBookings />} />
							<Route path={ROUTES.ADMIN_SETTINGS} element={<Settings />} />
							<Route path={ROUTES.ADMIN_REVIEWS} element={<ModerationDashboard />} />
						</Route>
				</Route>

				{/* Catch-all */}
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Suspense>
	);
};

export default AppRoutes;
