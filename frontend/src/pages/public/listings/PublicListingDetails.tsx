import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
	MapPin,
	Clock,
	Users,
	Tag,
	BadgeCheck,
	MessageCircle,
} from 'lucide-react';
import { FEATURE_FLAGS } from '@config/features';
import { useAuth } from '@context/AuthContext';
import { useChat } from '@context/ChatContext';
import publicListingsService from '@/services/publicListings.service';
import { useSimilarListings } from '@/hooks/useRecommendations';
import RecommendationsService, {
	getRecommendationSessionId,
	type ListingNavigationState,
} from '@services/recommendations.service';
import RecommendationGrid from '@components/listings/RecommendationGrid';
import PublicReviewsSection from '@components/reviews/PublicReviewsSection';
import notification from '@/utils/notifications';
import PageLoader from '@/components/feedback/PageLoader';
import SectionDivider from '@components/common/SectionDivider';
import ListingGallery from '@/components/listings/ListingGallery';
import ListingHostCard from '@/components/listings/ListingHostCard';
import BookingSidebar from '@/components/listings/BookingSidebar';
import Navbar from '@components/layout/Navbar';
import { IDEAL_FOR_OPTIONS } from '@/types/listings';
import type { ListingDetail } from '@/types/listings';
import { ROUTES } from '@/constants/routes';

const PublicListingDetails = () => {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();
	const { openChat, setContext } = useChat();
	const recommendationsEnabled = FEATURE_FLAGS.recommendations;
	const chatbotEnabled = FEATURE_FLAGS.chatbot;
	const canTrackBrowsingInteractions = !!user && recommendationsEnabled;

	const [listing, setListing] = useState<ListingDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
	const [canExpandOverview, setCanExpandOverview] = useState(false);
	const hasTrackedDetailOpenRef = useRef(false);
	const lastFetchedSlugRef = useRef<string | null>(null);
	const overviewMeasureRef = useRef<HTMLParagraphElement | null>(null);

	// Fire detail_open exactly once, routed to the correct tracking endpoint.
	useEffect(() => {
		if (!recommendationsEnabled) return;
		const navigationContext = (location.state as ListingNavigationState | null)
			?.listingNavigationContext;

		if (hasTrackedDetailOpenRef.current) {
			return;
		}

		if (navigationContext?.source === 'recommendation') {
			hasTrackedDetailOpenRef.current = true;
			void RecommendationsService.sendEvents([{
				requestId: navigationContext.requestId,
				listingId: navigationContext.listingId,
				eventType: 'detail_open',
				surface: navigationContext.surface,
				strategy: navigationContext.strategy,
				modelVersion: navigationContext.modelVersion || undefined,
				position: navigationContext.position,
				sessionId: getRecommendationSessionId(),
			}]);
			return;
		}

		if (navigationContext?.source === 'browse') {
			if (!canTrackBrowsingInteractions) return;

			hasTrackedDetailOpenRef.current = true;
			void RecommendationsService.sendInteractions([{
				listingId: navigationContext.listingId,
				eventType: 'detail_open',
				surface: navigationContext.surface,
				position: navigationContext.position,
				metadata: navigationContext.metadata,
			}]);
			return;
		}

		if (!canTrackBrowsingInteractions || !listing?.id) return;

		hasTrackedDetailOpenRef.current = true;
		void RecommendationsService.sendInteractions([{
			listingId: listing.id,
			eventType: 'detail_open',
			surface: 'listing_detail',
		}]);
	}, [canTrackBrowsingInteractions, listing?.id, location.state, recommendationsEnabled]);

	useEffect(() => {
		if (!chatbotEnabled) return;
		if (!listing?.id) return;
		setContext({ listingId: listing.id });
		return () => setContext({ listingId: null });
	}, [chatbotEnabled, listing?.id, setContext]);

	useEffect(() => {
		setIsOverviewExpanded(false);
	}, [listing?.id]);

	useEffect(() => {
		const measureNode = overviewMeasureRef.current;
		if (!measureNode || !listing?.description) {
			setCanExpandOverview(false);
			return;
		}

		const updateOverviewOverflow = () => {
			const computedStyle = window.getComputedStyle(measureNode);
			const lineHeight = Number.parseFloat(computedStyle.lineHeight);
			const fontSize = Number.parseFloat(computedStyle.fontSize) || 16;
			const fallbackLineHeight = fontSize * 1.5;
			const effectiveLineHeight = Number.isNaN(lineHeight)
				? fallbackLineHeight
				: lineHeight;

			setCanExpandOverview(
				measureNode.scrollHeight > effectiveLineHeight * 3 + 1,
			);
		};

		updateOverviewOverflow();

		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', updateOverviewOverflow);
			return () =>
				window.removeEventListener('resize', updateOverviewOverflow);
		}

		const resizeObserver = new ResizeObserver(updateOverviewOverflow);
		resizeObserver.observe(measureNode);

		return () => resizeObserver.disconnect();
	}, [listing?.description]);

	const {
		listings: similarListings,
		meta: similarMeta,
		loading: similarLoading,
		error: similarError,
	} = useSimilarListings(listing?.id ?? null, 3);

	useEffect(() => {
		if (!slug) {
			lastFetchedSlugRef.current = null;
			return;
		}
		if (lastFetchedSlugRef.current === slug) return;
		lastFetchedSlugRef.current = slug;

		const fetchListing = async () => {
			try {
				setLoading(true);
				const data = await publicListingsService.getPublicListingBySlug(slug);
				setListing(data);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to load listing';
				notification.error(message);
				void navigate(ROUTES.PUBLIC_LISTINGS, { replace: true });
			} finally {
				setLoading(false);
			}
		};

		void fetchListing();
	}, [slug, navigate]);

	if (loading) return <PageLoader />;
	if (!listing) return null;

	const idealForLabel = (value: string) =>
		IDEAL_FOR_OPTIONS.find((o) => o.value === value)?.label || value;

	const renderStars = (rating: number) =>
		'★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />
			{/* Breadcrumb */}
			<div className="bg-surface border-b border-line-muted">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
					<div className="flex items-center gap-2 text-sm">
						<Link
							to={ROUTES.HOME}
							className="text-ink-muted hover:text-teal-600 transition-colors"
						>
							Home
						</Link>
						<span className="text-line">/</span>
						<Link
							to={ROUTES.PUBLIC_LISTINGS}
							className="text-ink-muted hover:text-teal-600 transition-colors"
						>
							{listing.destination || 'Listings'}
						</Link>
						<span className="text-line">/</span>
						<Link
							to={`${ROUTES.PUBLIC_LISTINGS}?category=${listing.category}`}
							className="text-ink-muted hover:text-teal-600 transition-colors"
						>
							{listing.categoryDisplay}
						</Link>
						<span className="text-line">/</span>
						<span className="text-ink font-medium truncate max-w-xs">
							{listing.title}
						</span>
					</div>
				</div>
			</div>

			{/* Hero Section with Gallery */}
			<section className="bg-surface">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					{/* Title & Quick Info */}
					<div className="mb-5">
						<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
							<div className="grow">
								{/* Badges */}
								<div className="flex items-center gap-3 mb-3">
									<span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-xs font-bold uppercase tracking-wide">
										{listing.categoryDisplay}
									</span>
									{listing.difficultyLevelDisplay && (
										<span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wide">
											{listing.difficultyLevelDisplay}
										</span>
									)}
									{listing.host.isVerified && (
										<span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
											<BadgeCheck className="w-3 h-3" />
											Verified Host
										</span>
									)}
									{listing.instantBooking && (
										<span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wide">
											Instant Booking
										</span>
									)}
								</div>

								{/* Title */}
								<h1 className="font-heading text-3xl md:text-4xl font-semibold text-ink mb-2">
									{listing.title}
								</h1>

								{/* Location & Duration */}
								<div className="flex items-center gap-4 text-sm text-ink-muted">
									<div className="flex items-center gap-1">
										<MapPin className="w-4 h-4" />
										<span className="font-medium">
											{listing.destination}
											{listing.location &&
												`, ${listing.location}`}
										</span>
									</div>
									<div className="flex items-center gap-1">
										<Clock className="w-4 h-4" />
										<span className="font-medium">
											{listing.durationDisplay}
										</span>
									</div>
								</div>
							</div>

								{/* Share & Save — temporarily disabled until real share and wishlist flows are implemented */}
							</div>

						{/* Rating */}
						{listing.ratingCount > 0 && (
							<div className="flex items-center gap-4 mb-6">
								<div className="flex items-center gap-2">
									<span className="text-xl font-bold text-ink">
										{listing.ratingAverage}
									</span>
									<span className="text-amber-400 text-base">
										{renderStars(
											Number(listing.ratingAverage),
										)}
									</span>
								</div>
								<span className="text-line">|</span>
								<span className="text-sm font-medium text-teal-600">
									{listing.ratingCount} review
									{listing.ratingCount !== 1 ? 's' : ''}
								</span>
							</div>
						)}
					</div>

					{/* Gallery */}
					<ListingGallery
						images={listing.images}
						title={listing.title}
					/>
				</div>
			</section>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid lg:grid-cols-3 gap-8">
					{/* Left Content */}
					<div className="lg:col-span-2">
						{/* Overview */}
							<section>
								<h2 className="section-heading text-ink mb-4">
									Experience Overview
								</h2>
								<div className="relative">
									<p
										ref={overviewMeasureRef}
										aria-hidden
										className="pointer-events-none invisible absolute inset-x-0 top-0 text-ink-muted leading-relaxed whitespace-pre-line"
									>
										{listing.description}
									</p>
									<p
										className={`text-ink-muted leading-relaxed whitespace-pre-line ${
											!isOverviewExpanded && canExpandOverview
												? 'truncate-3'
												: ''
										}`}
									>
										{listing.description}
									</p>
								</div>
								{canExpandOverview && (
									<button
										type="button"
										onClick={() =>
											setIsOverviewExpanded((prev) => !prev)
										}
										className="mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700"
									>
										{isOverviewExpanded
											? 'View less'
											: 'View more'}
									</button>
								)}
							</section>

						{/* Quick Stats */}
						<div className="flex gap-6 flex-wrap mt-6">
							<div className="flex items-center gap-2 text-ink-secondary">
								<Clock className="w-5 h-5 text-ink-muted" />
								<span>{listing.durationDisplay}</span>
							</div>
							<div className="flex items-center gap-2 text-ink-secondary">
								<Users className="w-5 h-5 text-ink-muted" />
								<span>
									{listing.minGroupSize}&ndash;
									{listing.maxGroupSize} people
								</span>
							</div>
						</div>

						<SectionDivider />

						{/* Inclusions */}
						{listing.inclusions.length > 0 && (
							<>
									<section>
										<h2 className="section-heading text-ink mb-4">
											What&apos;s Included
										</h2>
										<div className="grid sm:grid-cols-2 gap-4">
											{listing.inclusions.map((item, i) => (
												<div
													key={i}
													className="rounded-xl border border-line bg-surface p-4"
												>
													<span className="font-medium text-ink-secondary">
														{item}
													</span>
												</div>
											))}
										</div>
									</section>
								<SectionDivider />
							</>
						)}

						{/* Exclusions */}
						{listing.exclusions.length > 0 && (
							<>
									<section>
										<h2 className="section-heading text-ink mb-4">
											What&apos;s Not Included
										</h2>
										<div className="grid sm:grid-cols-2 gap-4">
											{listing.exclusions.map((item, i) => (
												<div
													key={i}
													className="rounded-xl border border-line bg-surface p-4"
												>
													<span className="font-medium text-ink-secondary">
														{item}
													</span>
												</div>
											))}
										</div>
									</section>
								<SectionDivider />
							</>
						)}

						{/* Ideal For */}
						{listing.idealFor.length > 0 && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">
										Ideal For
									</h2>
										<div className="flex gap-2 flex-wrap">
											{listing.idealFor.map((val) => (
												<span
													key={val}
													className="rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-secondary"
												>
													{idealForLabel(val)}
												</span>
											))}
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* What to Bring */}
						{listing.whatToBring && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">
										What to Bring
									</h2>
									<p className="text-ink-secondary whitespace-pre-line">
										{listing.whatToBring}
									</p>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Requirements */}
							{listing.requirements && (
								<>
									<section className="rounded-2xl border border-line bg-surface p-5">
										<h2 className="section-heading text-ink mb-3">
											Requirements
										</h2>
										<p className="text-ink-secondary leading-relaxed whitespace-pre-line">
											{listing.requirements}
										</p>
									</section>
									<SectionDivider />
								</>
						)}

						{/* Best Seasons */}
						{listing.bestSeasonsDisplay.length > 0 && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">
										Best Seasons
									</h2>
										<div className="flex gap-2 flex-wrap">
											{listing.bestSeasonsDisplay.map(
												(season) => (
													<span
														key={season}
														className="rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-secondary"
													>
														{season}
													</span>
												),
										)}
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Tags */}
						{listing.tags.length > 0 && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">
										Tags
									</h2>
									<div className="flex gap-2 flex-wrap">
										{listing.tags.map((tag) => (
											<span
												key={tag}
												className="flex items-center gap-1 px-3 py-1 bg-surface-muted text-ink-muted text-sm rounded-full"
											>
												<Tag className="w-3 h-3" />
												{tag}
											</span>
										))}
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Rating Summary */}
						{listing.ratingCount > 0 && (
							<>
									<section>
										<h2 className="section-heading text-ink mb-4">
											Traveller Rating
										</h2>
										<div className="rounded-2xl border border-line bg-surface p-5">
											<div className="text-center">
												<div className="mb-1 text-3xl font-semibold text-ink">
													{listing.ratingAverage}
												</div>
												<div className="mb-2 flex items-center justify-center gap-1">
													<span className="text-lg text-amber-400">
														{renderStars(
															Number(
																listing.ratingAverage,
														),
														)}
													</span>
												</div>
												<p className="text-sm text-ink-muted">
													Based on {listing.ratingCount}{' '}
													review
													{listing.ratingCount !== 1
													? 's'
													: ''}
											</p>
										</div>
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* All Reviews */}
						{listing.ratingCount > 0 && (
							<>
									<section>
										<h2 className="section-heading text-ink mb-4">
											Traveller Reviews
										</h2>
										<PublicReviewsSection
											targetType="listing"
											targetId={listing.id}
											ratingAverage={listing.ratingAverage ? Number(listing.ratingAverage) : undefined}
											ratingCount={listing.ratingCount}
											showRatingSummary={false}
										/>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Host Card */}
							<section>
								<h2 className="section-heading text-ink mb-4">
									Your Host
								</h2>
								<ListingHostCard host={listing.host} />
							</section>

						{/* Similar Listings */}
						{recommendationsEnabled && (
							<RecommendationGrid
								title="You Might Also Like"
								listings={similarListings}
								meta={similarMeta}
								surface="similar"
								loading={similarLoading}
								error={similarError}
								columns={3}
								skeletonCount={3}
							/>
						)}
					</div>

					{/* Right Sidebar */}
					<aside className="lg:col-span-1">
						<BookingSidebar listing={listing} />
						{chatbotEnabled && (
							<button
								type="button"
								onClick={() => openChat({ listingId: listing.id })}
								className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2.5 text-sm font-semibold text-teal-700 border-2 border-teal-200 rounded-xl hover:bg-teal-50 hover:border-teal-400 transition-all"
							>
								<MessageCircle className="w-4 h-4" />
								Ask about this listing
							</button>
						)}
					</aside>
				</div>
			</div>
		</div>
	);
};

export default PublicListingDetails;
