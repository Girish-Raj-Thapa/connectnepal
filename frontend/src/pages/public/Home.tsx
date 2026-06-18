import { Link, useNavigate } from 'react-router-dom';
import { Bot, House, Layers3, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import Navbar from '@components/layout/Navbar';
import { useForYouListings } from '@/hooks/useRecommendations';
import RecommendationGrid from '@components/listings/RecommendationGrid';
import { ROUTES } from '@constants/routes';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import publicListingsService from '@/services/publicListings.service';
import { CATEGORY_OPTIONS, type ListingCategory, type RecommendationListing } from '@/types/listings';
import reviewsService from '@/services/reviews.service';
import type { Review } from '@/types/reviews';

type ActivityFilter = '' | ListingCategory;

const Home = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const isTraveller = !!user && user.role === 'traveller';
	const [destination, setDestination] = useState('');
	const [activity, setActivity] = useState<ActivityFilter>('');
	const [priceRange, setPriceRange] = useState('');
	const [guestListings, setGuestListings] = useState<RecommendationListing[]>([]);
	const [adventureListings, setAdventureListings] = useState<RecommendationListing[]>([]);
	const [guestLoading, setGuestLoading] = useState(false);
	const [guestError, setGuestError] = useState<string | null>(null);
	const [homeReviews, setHomeReviews] = useState<Review[]>([]);

	const {
		listings: forYouListings,
		meta: forYouMeta,
		loading: forYouLoading,
		error: forYouError,
	} = useForYouListings(3, isTraveller);

	useEffect(() => {
		if (isTraveller) return;
		let mounted = true;

		const fetchGuestListings = async () => {
			try {
				setGuestLoading(true);
				setGuestError(null);
				const data = await publicListingsService.getPublicListings({
					ordering: '-created_at',
					page: 1,
				});
				if (!mounted) return;
				setGuestListings(
					data.results.slice(0, 4).map((item, index) => ({
						...item,
						position: index + 1,
					})),
				);
			} catch (err) {
				if (!mounted) return;
				const message = err instanceof Error ? err.message : 'Failed to load listings';
				setGuestError(message);
			} finally {
				if (mounted) setGuestLoading(false);
			}
		};

		void fetchGuestListings();
		return () => {
			mounted = false;
		};
	}, [isTraveller]);

	useEffect(() => {
		let mounted = true;

		const fetchAdventureListings = async () => {
			try {
				const data = await publicListingsService.getPublicListings({
					category: 'adventure',
					ordering: '-created_at',
					page: 1,
				});
				if (!mounted) return;
				setAdventureListings(
					data.results.slice(0, 4).map((item, index) => ({
						...item,
						position: index + 1,
					})),
				);
			} catch {
				if (!mounted) return;
				setAdventureListings([]);
			}
		};

		void fetchAdventureListings();
		return () => {
			mounted = false;
		};
	}, []);

	const featuredListings = isTraveller ? forYouListings : guestListings;
	const featuredLoading = isTraveller ? forYouLoading : guestLoading;
	const featuredError = isTraveller ? forYouError : guestError;
	const featuredTitle = isTraveller ? 'Recommended For You' : 'Popular Right Now';
	const featuredSubtitle = isTraveller
		? 'Picked for you based on your travel interests.'
		: 'Real experiences from local hosts across Nepal.';
	const featuredColumns = isTraveller ? 3 : 4;
	const featuredSkeletonCount = isTraveller ? 3 : 4;
	const displayedHomeReviews = homeReviews.slice(0, 3);

	const goToListings = (params: Record<string, string | undefined>) => {
		const sp = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value) sp.set(key, value);
		});
		navigate({
			pathname: ROUTES.PUBLIC_LISTINGS,
			search: sp.toString() ? `?${sp.toString()}` : '',
		});
	};

	const handleSearch = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		goToListings({
			destination,
			category: activity,
			max_price: priceRange || undefined,
		});
	};

	useEffect(() => {
		let mounted = true;
		const fetchHomeReviews = async () => {
			try {
				const listingPool: RecommendationListing[] = [];
				for (let page = 1; page <= 4; page += 1) {
					const batch = await publicListingsService.getPublicListings({
						ordering: '-created_at',
						page,
					});
					listingPool.push(
						...batch.results.map((item, idx) => ({
							...item,
							position: listingPool.length + idx + 1,
						})),
					);
					if (!batch.next) break;
				}

				const targets = listingPool.slice(0, 30);
				const results = await Promise.all(
					targets.map((listing) => reviewsService.listListingReviews(listing.id, 1, 5)),
				);
				if (!mounted) return;
				const merged = results.flatMap((r) => r.results);
				const unique = merged.filter(
					(review, index, arr) => arr.findIndex((r) => r.id === review.id) === index,
				);
				setHomeReviews(unique.slice(0, 3));
			} catch {
				if (!mounted) return;
				setHomeReviews([]);
			}
		};

		void fetchHomeReviews();
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* Hero Section */}
			<section className="relative overflow-hidden py-20 md:py-28 text-center">
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{ backgroundImage: "url('https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=1920&q=80')" }}
				/>
				<div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/45 to-black/55" />
				<div className="relative max-w-4xl mx-auto px-6 animate-[fadeIn_.5s_ease-out]">
					<span className="inline-block px-4 py-1.5 bg-white/85 backdrop-blur-sm rounded-full text-sm font-semibold text-tealbrand shadow-sm mb-6">
						Authentic Nepal Awaits
					</span>
					<h1 className="font-heading text-5xl md:text-6xl font-semibold text-white mb-6 leading-tight">
						Discover Nepal Through<br />
						<span className="bg-linear-to-r from-tealbrand to-accent bg-clip-text text-transparent">
							Local Experiences
						</span>
					</h1>
					<p className="text-white/90 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
						{user
							? `Welcome back, ${user.firstName || user.email}! Ready to explore authentic homestays, adventure activities, and cultural tours?`
							: 'Explore authentic homestays, adventure activities, and cultural tours across Nepal'
						}
					</p>

					{/* Search Bar */}
					<form
						onSubmit={handleSearch}
						className="bg-surface/95 backdrop-blur-sm shadow-xl rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-3 md:gap-4 max-w-4xl mx-auto border border-line"
					>
						<select
							aria-label="Destination"
							value={destination}
							onChange={(e) => setDestination(e.target.value)}
							className="flex-1 border border-line rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-tealbrand focus:border-tealbrand bg-surface hover:border-ink-muted"
						>
							<option value="">Destination</option>
							<option>Kathmandu</option>
							<option>Pokhara</option>
							<option>Lalitpur (Patan)</option>
							<option>Bhaktapur</option>
							<option>Nagarkot</option>
							<option>Dhulikhel</option>
							<option>Bandipur</option>
							<option>Gorkha</option>
							<option>Manang</option>
							<option>Mustang</option>
							<option>Muktinath</option>
							<option>Lukla</option>
							<option>Namche Bazaar</option>
							<option>Everest Region</option>
							<option>Annapurna Region</option>
							<option>Langtang</option>
							<option>Ilam</option>
							<option>Chitwan</option>
							<option>Sauraha</option>
							<option>Bardia</option>
							<option>Lumbini</option>
							<option>Janakpur</option>
							<option>Rara</option>
						</select>
						<select
							aria-label="Activity Type"
							value={activity}
							onChange={(e) => setActivity(e.target.value as ActivityFilter)}
							className="flex-1 border border-line rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-tealbrand focus:border-tealbrand bg-surface hover:border-ink-muted"
						>
							<option value="">All Categories</option>
							{CATEGORY_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
						<select
							aria-label="Price Range"
							value={priceRange}
							onChange={(e) => setPriceRange(e.target.value)}
							className="flex-1 border border-line rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-tealbrand focus:border-tealbrand bg-surface hover:border-ink-muted"
						>
							<option value="">Price Range</option>
							<option value="5000">Up to NPR 5,000</option>
							<option value="10000">Up to NPR 10,000</option>
							<option value="20000">Up to NPR 20,000</option>
							<option value="50000">Up to NPR 50,000</option>
						</select>
						<button
							type="submit"
							className="bg-linear-to-r from-tealbrand to-accent text-white font-semibold px-8 py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
						>
							Search
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7-7 7M5 12h16" />
							</svg>
						</button>
					</form>
					<div className="mt-6 flex items-center justify-center gap-3">
						<Link to={ROUTES.PUBLIC_LISTINGS} className="px-5 py-2.5 rounded-xl bg-white text-ink font-semibold border border-white/80 hover:bg-white/90 transition-colors">
							Explore Listings
						</Link>
						<Link
							to={user ? ROUTES.HOST_DASHBOARD : ROUTES.REGISTER}
							className="px-5 py-2.5 rounded-xl bg-transparent text-white font-semibold border border-white/60 hover:bg-white/10 transition-colors"
						>
							Become a Host
						</Link>
					</div>
				</div>
			</section>

			{/* Live Listings */}
			<section className="max-w-7xl mx-auto px-6 py-10 md:py-12">
				<div className="text-center mb-8">
					<h2 className="font-heading text-3xl font-semibold text-ink mb-2">{featuredTitle}</h2>
					<p className="text-ink-muted">{featuredSubtitle}</p>
				</div>
				<div className="animate-[fadeIn_.5s_ease-out]">
					<RecommendationGrid
						title=""
						listings={featuredListings}
						meta={isTraveller ? forYouMeta : null}
						surface="for_you"
						loading={featuredLoading}
						error={featuredError}
						columns={featuredColumns}
						skeletonCount={featuredSkeletonCount}
					/>
				</div>
			</section>

			<TearDivider />

			{/* Explore + Destinations */}
			<section className="bg-surface py-12 md:py-16">
				<div className="max-w-7xl mx-auto px-6">
					<div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
						<div>
							<h2 className="font-heading text-5xl md:text-6xl text-ink leading-tight mb-4">
								Find Your<br />
								Perfect Trip
							</h2>
							<p className="text-ink-muted text-lg">From Himalayan treks to village homestays, choose journeys built by local experts.</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<DestinationCard name="Kathmandu" image="https://images.unsplash.com/photo-1605640840605-14ac1855827b?auto=format&fit=crop&w=900&q=80" />
							<DestinationCard name="Pokhara" image="https://images.unsplash.com/photo-1621681948799-99f5b9f96e65?auto=format&fit=crop&w=900&q=80" />
							<DestinationCard name="Mustang" image="https://images.unsplash.com/photo-1628011470319-63d6f2ce7cf5?auto=format&fit=crop&w=900&q=80" />
							<DestinationCard name="Chitwan" image="https://images.unsplash.com/photo-1561731216-c3a4d99437d5?auto=format&fit=crop&w=900&q=80" />
						</div>
					</div>
				</div>
			</section>

			<TearDivider flip />

			{/* Adventure Story Section */}
			<section className="relative overflow-hidden py-12 md:py-16">
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80')" }}
				/>
				<div className="absolute inset-0 bg-linear-to-br from-sky-700/80 via-tealbrand/75 to-sky-500/75" />
				<div className="relative max-w-7xl mx-auto px-6">
					<div className="flex items-end justify-between gap-6 mb-10">
						<h2 className="font-heading text-5xl text-white leading-tight">Adventure Travel Experiences</h2>
						<Link to={`${ROUTES.PUBLIC_LISTINGS}?category=adventure`} className="hidden md:inline-flex px-5 py-2.5 rounded-full border border-white/60 text-white hover:bg-white/10 transition-colors">
							Explore Adventure
						</Link>
					</div>
					<div className="grid md:grid-cols-4 gap-4">
						{adventureListings.map((listing, index) => (
							<PolaroidCard
								key={listing.id}
								title={listing.title}
								meta={`${listing.destination} · ${listing.durationDisplay}`}
								price={`NPR ${listing.pricePerPerson}`}
								image={listing.primaryImageThumbnail || "https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&w=700&q=80"}
								rotate={index % 2 === 0 ? '-rotate-2' : 'rotate-2'}
								to={`${ROUTES.PUBLIC_LISTINGS}/${listing.slug}`}
							/>
						))}
						{adventureListings.length === 0 && (
							<>
								<PolaroidCard title="Adventure Experiences" meta="Nepal · Curated by locals" price="Explore now" image="https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&w=700&q=80" rotate="-rotate-2" to={`${ROUTES.PUBLIC_LISTINGS}?category=adventure`} />
								<PolaroidCard title="Mountain Activities" meta="Trekking · Nature" price="Explore now" image="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80" rotate="rotate-2" to={`${ROUTES.PUBLIC_LISTINGS}?category=trekking`} />
							</>
						)}
					</div>
				</div>
			</section>

			<TearDivider />

			{/* System Features in editorial layout */}
			<section className="bg-surface py-12 md:py-16">
				<div className="max-w-7xl mx-auto px-6">
					<div className="text-center mb-10">
						<h2 className="font-heading text-5xl text-ink mb-3">System Features</h2>
						<p className="text-ink-muted">A full Nepal community tourism platform, not just a listings page.</p>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
						<FlipFeatureCard icon={<Map className="w-8 h-8" />} title="Trip Planner" text="Create complete travel plans with multiple stops, add experiences directly from listings, and keep your itinerary organized in one timeline before booking." />
						<FlipFeatureCard icon={<Sparkles className="w-8 h-8" />} title="Recommendation Engine" text="Get personalized suggestions using your browsing patterns, interests, and interactions so the platform surfaces experiences that better match your travel style." />
						<FlipFeatureCard icon={<Bot className="w-8 h-8" />} title="AI Chatbot" text="Ask for activity ideas, booking guidance, and destination tips, then revisit saved conversations later to continue planning without starting over." />
						<FlipFeatureCard icon={<House className="w-8 h-8" />} title="Host Workspace" text="Hosts can publish and manage listings and packages, control availability slots, track bookings, respond to reviews, and monitor operations from one dashboard." />
						<FlipFeatureCard icon={<ShieldCheck className="w-8 h-8" />} title="Trust Layer" text="Structured reviews, complaint handling, and moderation tools help keep experiences transparent, accountable, and safer for both travelers and hosts." />
						<FlipFeatureCard icon={<Layers3 className="w-8 h-8" />} title="Role-Based Platform" text="Separate traveller, host, and admin experiences with guided onboarding and purpose-built dashboards so each role gets the right tools and permissions." />
					</div>
				</div>
			</section>

			<TearDivider flip />

			{/* Testimonial + Host CTA */}
			<section className="relative overflow-hidden py-12 md:py-16">
				<div className="absolute inset-0 bg-linear-to-r from-tealbrand to-accent" />
				<div className="relative max-w-7xl mx-auto px-6">
					<h2 className="font-heading text-5xl text-white text-center mb-8">What Our Travelers Say</h2>
					<div className="grid md:grid-cols-3 gap-4 mb-10">
						{displayedHomeReviews.map((review) => (
							<TestimonialCard
								key={review.id}
								quote={review.comment}
								author={review.traveller.firstName}
								origin={review.listingTitle || 'Verified Traveler'}
							/>
						))}
						{displayedHomeReviews.length === 0 && (
							<TestimonialCard
								quote="No published public reviews are available yet."
								author="ConnectNepal"
								origin="Community updates"
							/>
						)}
					</div>
					<div className="bg-white/12 border border-white/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
						<div>
							<h3 className="font-heading text-3xl text-white mb-2">Explore the world. Live the adventure.</h3>
							<p className="text-white/90">List your experience and grow with Nepal’s local tourism community.</p>
						</div>
						<Link
							to={user?.role === 'host' ? ROUTES.HOST_DASHBOARD : ROUTES.REGISTER}
							className="px-6 py-3 rounded-xl bg-white text-tealbrand font-semibold hover:bg-white/90 transition-colors"
						>
							{user?.role === 'host' ? 'Open Host Dashboard' : 'Become a Host'}
						</Link>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="bg-linear-to-br from-gray-900 via-gray-950 to-black text-gray-300 pt-14 pb-10 mt-16 md:mt-20">
				<div className="max-w-7xl mx-auto px-6">
					<div className="grid md:grid-cols-4 gap-10 mb-12">
						{/* Brand */}
						<div>
							<div className="flex items-center gap-3 mb-4">
								<div className="w-10 h-10 bg-linear-to-br from-tealbrand to-accent rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
									CN
								</div>
								<span className="text-xl font-bold text-white">ConnectNepal</span>
							</div>
							<p className="text-sm text-gray-400 leading-relaxed">
								Connecting travellers with authentic community experiences across Nepal.
							</p>
						</div>

						{/* Company */}
						<div>
							<h4 className="font-semibold text-white mb-4">Company</h4>
							<ul className="space-y-2 text-sm">
								<li><Link to={ROUTES.ABOUT_US} className="hover:text-accent transition-colors">About Us</Link></li>
								<li><Link to={ROUTES.FAQS} className="hover:text-accent transition-colors">FAQs</Link></li>
							</ul>
						</div>

						{/* Explore */}
						<div>
							<h4 className="font-semibold text-white mb-4">Explore</h4>
							<ul className="space-y-2 text-sm">
								<li><Link to={ROUTES.PUBLIC_LISTINGS} className="hover:text-accent transition-colors">Destinations</Link></li>
								<li><Link to={ROUTES.PUBLIC_LISTINGS} className="hover:text-accent transition-colors">Experiences</Link></li>
							</ul>
						</div>

						{/* Support */}
						<div>
							<h4 className="font-semibold text-white mb-4">Support</h4>
							<ul className="space-y-2 text-sm">
								<li><Link to={ROUTES.TRUST_AND_SAFETY} className="hover:text-accent transition-colors">Help Center</Link></li>
								<li><Link to={ROUTES.COMMUNITY_GUIDELINES} className="hover:text-accent transition-colors">Community Guidelines</Link></li>
							</ul>
						</div>
					</div>

					<div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
						<p>© 2025 ConnectNepal. All rights reserved.</p>
						<div className="flex gap-6 mt-4 md:mt-0">
							<Link to={ROUTES.COMMUNITY_GUIDELINES} className="hover:text-accent transition-colors">Terms</Link>
							<Link to={ROUTES.TRUST_AND_SAFETY} className="hover:text-accent transition-colors">Privacy</Link>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
};

interface TearDividerProps {
	flip?: boolean;
}

const TearDivider = ({ flip = false }: TearDividerProps) => (
	<div className={`h-8 bg-surface relative overflow-hidden ${flip ? 'rotate-180' : ''}`}>
		<div className="absolute -top-8 left-0 right-0 h-16 bg-tealbrand/80 rounded-[100%]" />
	</div>
);

interface DestinationCardProps {
	name: string;
	image: string;
}

const destinationFallbackByName: Record<string, string> = {
	Kathmandu: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=80',
	Pokhara: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80',
	Mustang: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
	Chitwan: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=900&q=80',
};

const DestinationCard = ({ name, image }: DestinationCardProps) => {
	const [imgSrc, setImgSrc] = useState(image);

	return (
		<Link
			to={`${ROUTES.PUBLIC_LISTINGS}?destination=${encodeURIComponent(name)}`}
			className="relative block h-52 rounded-xl overflow-hidden border border-line group shadow-md"
		>
			<img
				src={imgSrc}
				alt={name}
				loading="lazy"
				decoding="async"
				onError={() => setImgSrc(destinationFallbackByName[name] || destinationFallbackByName.Kathmandu)}
				className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
			/>
			<div className="absolute inset-0 bg-linear-to-t from-black/65 to-black/10" />
			<div className="absolute bottom-3 left-3 text-white font-semibold">{name}</div>
		</Link>
	);
};

interface TestimonialCardProps {
	quote: string;
	author: string;
	origin: string;
}

const TestimonialCard = ({ quote, author, origin }: TestimonialCardProps) => (
	<div className="bg-white/90 p-6 rounded-xl border border-white/60 shadow-sm">
		<p className="text-ink leading-relaxed mb-4">“{quote}”</p>
		<p className="font-semibold text-ink">{author}</p>
		<p className="text-sm text-ink-muted">{origin}</p>
	</div>
);

interface FlipFeatureCardProps {
	icon: ReactNode;
	title: string;
	text: string;
}

const FlipFeatureCard = ({ icon, title, text }: FlipFeatureCardProps) => (
	<div className="[perspective:1000px] h-44 group">
		<div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
			<div className="absolute inset-0 rounded-xl bg-brand-subtle border border-line flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
				<div className="text-tealbrand [&_svg]:w-10 [&_svg]:h-10">{icon}</div>
				<h3 className="font-semibold text-ink text-xl text-center px-3">{title}</h3>
			</div>
			<div className="absolute inset-0 rounded-xl bg-tealbrand border border-tealbrand p-5 flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
				<p className="text-sm text-white text-center">{text}</p>
			</div>
		</div>
	</div>
);

interface PolaroidCardProps {
	title: string;
	meta: string;
	price: string;
	image: string;
	rotate: string;
	to: string;
}

const PolaroidCard = ({ title, meta, price, image, rotate, to }: PolaroidCardProps) => (
	<Link to={to} className={`block bg-white p-2 rounded-lg shadow-xl ${rotate} hover:-translate-y-1 transition-transform`}>
		<div className="h-44 rounded-md overflow-hidden mb-3">
			<img src={image} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
		</div>
		<h3 className="text-sm font-semibold text-ink">{title}</h3>
		<p className="text-xs text-ink-muted">{meta}</p>
		<p className="text-sm font-semibold text-ink mt-2">{price}</p>
	</Link>
);

export default Home;
