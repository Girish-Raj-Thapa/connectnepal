import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import { FEATURE_FLAGS } from '@config/features';
import { useAuth } from '@context/AuthContext';
import {
	useForYouListings,
	useForYouPackages,
} from '@/hooks/useRecommendations';
import RecommendationGrid from '@components/listings/RecommendationGrid';
import PackageRecommendationGrid from '@components/packages/PackageRecommendationGrid';
import RecommendationsService from '@services/recommendations.service';
import type {
	BrowsingInteractionSurface,
	ListingNavigationState,
} from '@services/recommendations.service';
import publicListingsService from '@/services/publicListings.service';
import publicPackagesService from '@/services/publicPackages.service';
import notification from '@/utils/notifications';
import ListingCard from '@/components/listings/ListingCard';
import Pagination from '@/components/listings/Pagination';
import Checkbox from '@components/form/Checkbox';
import PageLoader from '@/components/feedback/PageLoader';
import Navbar from '@components/layout/Navbar';
import PackageFilters from '@/components/packages/PackageFilters';
import PublicPackageCard from '@/components/packages/PublicPackageCard';
import {
	CATEGORY_OPTIONS,
	DIFFICULTY_OPTIONS,
	IDEAL_FOR_OPTIONS,
	BEST_SEASON_OPTIONS,
	ORDERING_OPTIONS,
	type PublicListing,
	type PublicListingsParams,
} from '@/types/listings';
import type {
	PublicPackageSummary,
	PublicListPackagesParams,
	PublicPackageFilterState,
} from '@/types/packages';


// Defaults & URL helpers

type ActiveTab = 'listings' | 'packages';

const DEFAULTS: PublicListingsParams = {
	page: 1,
	ordering: '-created_at',
};

const PKG_DEFAULT_ORDERING = '-created_at';

const parseParams = (sp: URLSearchParams): PublicListingsParams => ({
	search: sp.get('search') || undefined,
	category: (sp.get('category') as PublicListingsParams['category']) || undefined,
	difficultyLevel: (sp.get('difficulty') as PublicListingsParams['difficultyLevel']) || undefined,
	destination: sp.get('destination') || undefined,
	minPrice: sp.get('min_price') || undefined,
	maxPrice: sp.get('max_price') || undefined,
	minDays: sp.get('min_days') || undefined,
	maxDays: sp.get('max_days') || undefined,
	bestSeason: (sp.get('best_season') as PublicListingsParams['bestSeason']) || undefined,
	idealFor: (sp.get('ideal_for') as PublicListingsParams['idealFor']) || undefined,
	instantBooking: sp.get('instant_booking') === 'true' || undefined,
	hostVerified: sp.get('host_verified') === 'true' || undefined,
	ordering: sp.get('ordering') || DEFAULTS.ordering,
	page: parseInt(sp.get('page') || '1', 10),
});

const buildParams = (f: PublicListingsParams): URLSearchParams => {
	const sp = new URLSearchParams();
	if (f.search) sp.set('search', f.search);
	if (f.category) sp.set('category', f.category);
	if (f.difficultyLevel) sp.set('difficulty', f.difficultyLevel);
	if (f.destination) sp.set('destination', f.destination);
	if (f.minPrice) sp.set('min_price', f.minPrice);
	if (f.maxPrice) sp.set('max_price', f.maxPrice);
	if (f.minDays) sp.set('min_days', f.minDays);
	if (f.maxDays) sp.set('max_days', f.maxDays);
	if (f.bestSeason) sp.set('best_season', f.bestSeason);
	if (f.idealFor) sp.set('ideal_for', f.idealFor);
	if (f.instantBooking) sp.set('instant_booking', 'true');
	if (f.hostVerified) sp.set('host_verified', 'true');
	if (f.ordering && f.ordering !== DEFAULTS.ordering) sp.set('ordering', f.ordering);
	if (f.page && f.page > 1) sp.set('page', String(f.page));
	return sp;
};

const parsePackageParams = (sp: URLSearchParams): PublicPackageFilterState => ({
	search: sp.get('search') || '',
	tags: sp.get('tags') || '',
	priceMax: sp.get('price_max') || '',
	durationDaysMax: sp.get('duration_days_max') || '',
	ordering: sp.get('pkg_ordering') || PKG_DEFAULT_ORDERING,
	page: parseInt(sp.get('page') || '1', 10),
});

const buildPackageParams = (f: PublicPackageFilterState): URLSearchParams => {
	const sp = new URLSearchParams();
	if (f.search) sp.set('search', f.search);
	if (f.tags) sp.set('tags', f.tags);
	if (f.priceMax) sp.set('price_max', f.priceMax);
	if (f.durationDaysMax) sp.set('duration_days_max', f.durationDaysMax);
	if (f.ordering && f.ordering !== PKG_DEFAULT_ORDERING) sp.set('pkg_ordering', f.ordering);
	if (f.page > 1) sp.set('page', String(f.page));
	return sp;
};


// Page component

const PublicListings = () => {
	const { user } = useAuth();
	const recommendationsEnabled = FEATURE_FLAGS.recommendations;
	const isTraveller = !!user && user.role === 'traveller' && recommendationsEnabled;
	const canTrackBrowsingInteractions = !!user && recommendationsEnabled;
	const [searchParams, setSearchParams] = useSearchParams();

	// Tab state — initialized from ?tab URL param; defaults to listings
	const isPackagesTab = searchParams.get('tab') === 'packages';
	const [activeTab, setActiveTab] = useState<ActiveTab>(
		() => (isPackagesTab ? 'packages' : 'listings'),
	);
	const {
		listings: suggestedListings,
		meta: suggestedMeta,
		loading: suggestedLoading,
		error: suggestedError,
	} = useForYouListings(3, isTraveller);
	const {
		packages: suggestedPackages,
		meta: suggestedPackagesMeta,
		loading: suggestedPackagesLoading,
		error: suggestedPackagesError,
	} = useForYouPackages(3, isTraveller && activeTab === 'packages');

	// Listings state
	const [filters, setFilters] = useState<PublicListingsParams>(() => parseParams(searchParams));
	const [listings, setListings] = useState<PublicListing[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Packages state
	const [packageFilters, setPackageFilters] = useState<PublicPackageFilterState>(() =>
		isPackagesTab ? parsePackageParams(searchParams) : {
			search: '', tags: '', priceMax: '', durationDaysMax: '',
			ordering: PKG_DEFAULT_ORDERING, page: 1,
		},
	);
	const [packages, setPackages] = useState<PublicPackageSummary[]>([]);
	const [packageCount, setPackageCount] = useState(0);
	const [pkgLoading, setPkgLoading] = useState(() => isPackagesTab);
	const [pkgError, setPkgError] = useState<string | null>(null);

	// Local text inputs decoupled for debounce
	const [searchInput, setSearchInput] = useState(() =>
		isPackagesTab ? (searchParams.get('search') || '') : (filters.search || ''),
	);
	const [destinationInput, setDestinationInput] = useState(filters.destination || '');
	const [priceInputs, setPriceInputs] = useState({ min: filters.minPrice || '', max: filters.maxPrice || '' });
	const [daysInputs, setDaysInputs] = useState({ min: filters.minDays || '', max: filters.maxDays || '' });
	const [pkgTagsInput, setPkgTagsInput] = useState(packageFilters.tags);

	const debounceRef = useRef<number | null>(null);
	const pkgDebounceRef = useRef<number | null>(null);

	// Race condition guards
	const requestIdRef = useRef(0);
	const pkgRequestIdRef = useRef(0);
	const hasFetchedRef = useRef(false);
	const pkgHasFetchedRef = useRef(false);
	const lastListingsFetchKeyRef = useRef<string | null>(null);
	const lastPackagesFetchKeyRef = useRef<string | null>(null);


	// Fetch listings

	const fetchListings = useCallback(async (params: PublicListingsParams) => {
		const requestId = ++requestIdRef.current;
		try {
			setLoading(true);
			setError(null);
			const data = await publicListingsService.getPublicListings(params);
			if (requestId !== requestIdRef.current) return;
			setListings(data.results);
			setTotalCount(data.count);
		} catch (err) {
			if (requestId !== requestIdRef.current) return;
			const message = err instanceof Error ? err.message : 'Failed to load listings';
			setError(message);
			notification.error(message);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
				hasFetchedRef.current = true;
			}
		}
	}, []);


	// Fetch packages

	const fetchPackages = useCallback(async (params: PublicPackageFilterState) => {
		const requestId = ++pkgRequestIdRef.current;
		try {
			setPkgLoading(true);
			setPkgError(null);
			const apiParams: PublicListPackagesParams = {
				search: params.search || undefined,
				tags: params.tags || undefined,
				priceMax: params.priceMax ? Number(params.priceMax) : undefined,
				durationDaysMax: params.durationDaysMax ? Number(params.durationDaysMax) : undefined,
				ordering: (params.ordering as PublicListPackagesParams['ordering']) || undefined,
				page: params.page,
			};
			const data = await publicPackagesService.listPackages(apiParams);
			if (requestId !== pkgRequestIdRef.current) return;
			setPackages(data.results);
			setPackageCount(data.count);
		} catch (err) {
			if (requestId !== pkgRequestIdRef.current) return;
			const message = err instanceof Error ? err.message : 'Failed to load packages';
			setPkgError(message);
			notification.error(message);
		} finally {
			if (requestId === pkgRequestIdRef.current) {
				setPkgLoading(false);
				pkgHasFetchedRef.current = true;
			}
		}
	}, []);


	// Listings: sync filters → URL → fetch

	useEffect(() => {
		if (activeTab !== 'listings') {
			lastListingsFetchKeyRef.current = null;
			return;
		}
		const sp = buildParams(filters);
		const fetchKey = sp.toString();
		if (lastListingsFetchKeyRef.current === fetchKey) return;
		lastListingsFetchKeyRef.current = fetchKey;

		setSearchParams(sp, { replace: true });
		void fetchListings(filters);
	}, [filters, activeTab, fetchListings, setSearchParams]);


	// Packages: sync filters → URL → fetch

	useEffect(() => {
		if (activeTab !== 'packages') {
			lastPackagesFetchKeyRef.current = null;
			return;
		}
		const sp = buildPackageParams(packageFilters);
		const fetchKey = sp.toString();
		if (lastPackagesFetchKeyRef.current === fetchKey) return;
		lastPackagesFetchKeyRef.current = fetchKey;

		sp.set('tab', 'packages');
		setSearchParams(sp, { replace: true });
		void fetchPackages(packageFilters);
	}, [packageFilters, activeTab, fetchPackages, setSearchParams]);


	// Debounce cleanup

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			if (pkgDebounceRef.current) clearTimeout(pkgDebounceRef.current);
		};
	}, []);


	// Tab switching — sync search input to new tab's search value

	const handleTabChange = (tab: ActiveTab) => {
		if (tab === activeTab) return;
		setActiveTab(tab);
		setSearchInput(tab === 'packages' ? packageFilters.search : (filters.search || ''));
	};


	// Debounced update helpers

	const debouncedUpdate = (updates: Partial<PublicListingsParams>) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = window.setTimeout(() => {
			setFilters((prev) => ({ ...prev, ...updates, page: 1 }));
		}, 400);
	};

	const debouncedPkgUpdate = (updates: Partial<PublicPackageFilterState>) => {
		if (pkgDebounceRef.current) clearTimeout(pkgDebounceRef.current);
		pkgDebounceRef.current = window.setTimeout(() => {
			setPackageFilters((prev) => ({ ...prev, ...updates, page: 1 }));
		}, 400);
	};


	// Search input — shared across both tabs

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchInput(value);
		if (activeTab === 'packages') {
			debouncedPkgUpdate({ search: value });
		} else {
			debouncedUpdate({ search: value || undefined });
		}
	};

	const handleSearchSubmit = () => {
		if (activeTab === 'packages') {
			setPackageFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
		} else {
			setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
		}
	};


	// Listings-specific input handlers

	const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setDestinationInput(value);
		debouncedUpdate({ destination: value || undefined });
	};

	const handlePriceChange = (field: 'min' | 'max', value: string) => {
		const next = { ...priceInputs, [field]: value };
		setPriceInputs(next);
		debouncedUpdate({ minPrice: next.min || undefined, maxPrice: next.max || undefined });
	};

	const handleDaysChange = (field: 'min' | 'max', value: string) => {
		const next = { ...daysInputs, [field]: value };
		setDaysInputs(next);
		debouncedUpdate({ minDays: next.min || undefined, maxDays: next.max || undefined });
	};


	// Packages-specific input handlers

	const handlePkgTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setPkgTagsInput(value);
		debouncedPkgUpdate({ tags: value });
	};

	const updatePackageFilter = (updates: Partial<PublicPackageFilterState>) => {
		setPackageFilters((prev) => ({ ...prev, ...updates, page: 1 }));
	};

	const clearPackageFilters = () => {
		setPackageFilters({ search: '', tags: '', priceMax: '', durationDaysMax: '', ordering: PKG_DEFAULT_ORDERING, page: 1 });
		setSearchInput('');
		setPkgTagsInput('');
	};

	const hasActivePackageFilters =
		!!packageFilters.search ||
		!!packageFilters.tags ||
		!!packageFilters.priceMax ||
		!!packageFilters.durationDaysMax ||
		packageFilters.ordering !== PKG_DEFAULT_ORDERING;
	const shouldShowTopPackageRecommendations =
		activeTab === 'packages' &&
		isTraveller &&
		!hasActivePackageFilters &&
		(pkgLoading || packages.length > 0) &&
		(suggestedPackagesLoading || suggestedPackages.length > 0);
	const shouldShowEmptyStatePackageRecommendations =
		activeTab === 'packages' &&
		isTraveller &&
		(suggestedPackagesLoading || suggestedPackages.length > 0);


	// Listings filter helpers

	const updateFilter = (key: keyof PublicListingsParams, value: unknown) => {
		setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
	};

	const clearFilters = () => {
		setFilters({ ...DEFAULTS });
		setSearchInput('');
		setDestinationInput('');
		setPriceInputs({ min: '', max: '' });
		setDaysInputs({ min: '', max: '' });
	};

	const hasActiveFilters =
		!!filters.search ||
		!!filters.category ||
		!!filters.difficultyLevel ||
		!!filters.destination ||
		!!filters.minPrice ||
		!!filters.maxPrice ||
		!!filters.minDays ||
		!!filters.maxDays ||
		!!filters.bestSeason ||
		!!filters.idealFor ||
		!!filters.instantBooking ||
		!!filters.hostVerified;

	const browseSurface: BrowsingInteractionSurface =
		hasActiveFilters ? 'search_results' : 'catalog';

	const handleBrowseCardNavigate = useCallback(
		(listing: PublicListing, position: number) => {
			if (!canTrackBrowsingInteractions) return;

			void RecommendationsService.sendInteractions([{
				listingId: listing.id,
				eventType: 'click',
				surface: browseSurface,
				position,
			}]);
		},
		[canTrackBrowsingInteractions, browseSurface],
	);


	// Render

	if (activeTab === 'listings' && !hasFetchedRef.current && loading) return <PageLoader />;
	if (activeTab === 'packages' && !pkgHasFetchedRef.current && pkgLoading) return <PageLoader />;

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* Hero */}
			<section className="relative bg-linear-to-br from-teal-700 via-teal-600 to-teal-500 text-white py-14 overflow-hidden">
				<div className="absolute inset-0 opacity-[0.07]">
					<div className="absolute top-20 left-10 w-96 h-96 bg-surface rounded-full blur-3xl" />
					<div className="absolute bottom-10 right-10 w-125 h-125 bg-teal-300 rounded-full blur-3xl" />
				</div>
				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
					<h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold mb-3">
						Discover Nepal&apos;s Heart
					</h1>
					<p className="text-base sm:text-lg text-teal-50 max-w-2xl mx-auto font-medium">
						Browse authentic local experiences, treks, and curated multi-day packages across the Himalayas
					</p>
				</div>
			</section>

			{/* Floating Search Bar */}
			<section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-7 relative z-10">
				<div className="bg-surface rounded-xl shadow-2xl shadow-teal-500/10 p-1.5 border border-line">
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
						<div className="grow relative">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
							<input
								type="text"
								value={searchInput}
								onChange={handleSearchChange}
								placeholder={activeTab === 'packages' ? 'Search packages...' : 'Search destinations, activities...'}
								className="w-full pl-12 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-teal-500 outline-none text-ink placeholder:text-ink-muted text-sm bg-surface"
							/>
						</div>
						<button
							type="button"
							onClick={handleSearchSubmit}
							className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-all duration-300 shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
						>
							Search
						</button>
					</div>
				</div>
			</section>

			{/* Tab Switcher */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-0">
				<div className="flex gap-1 border-b border-line">
					<button
						type="button"
						onClick={() => handleTabChange('listings')}
						className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
							activeTab === 'listings'
								? 'border-teal-600 text-teal-700'
								: 'border-transparent text-ink-muted hover:text-ink hover:border-line'
						}`}
					>
						Experiences
						{totalCount > 0 && (
							<span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-muted">
								{totalCount}
							</span>
						)}
					</button>
					<button
						type="button"
						onClick={() => handleTabChange('packages')}
						className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
							activeTab === 'packages'
								? 'border-teal-600 text-teal-700'
								: 'border-transparent text-ink-muted hover:text-ink hover:border-line'
						}`}
					>
						Packages
						{packageCount > 0 && (
							<span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-muted">
								{packageCount}
							</span>
						)}
					</button>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

				{/* Listings Tab */}
				{activeTab === 'listings' && (
					<div className="grid lg:grid-cols-4 gap-6">
						{/* Filters Sidebar */}
						<aside className="lg:col-span-1 hidden lg:block">
							<div className="bg-surface rounded-2xl shadow-sm border border-line p-5 sticky top-24">
								<div className="flex items-center justify-between mb-5">
									<h2 className="card-heading text-ink">Filters</h2>
									{hasActiveFilters && (
										<button
											type="button"
											onClick={clearFilters}
											className="text-sm text-teal-600 font-semibold hover:text-teal-700"
										>
											Clear
										</button>
									)}
								</div>

								{/* Category */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Category
									</label>
									<select
										title="Category"
										value={filters.category || ''}
										onChange={(e) => updateFilter('category', e.target.value)}
										className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm cursor-pointer"
									>
										<option value="">All Categories</option>
										{CATEGORY_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>

								{/* Destination */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Destination
									</label>
									<input
										type="text"
										value={destinationInput}
										onChange={handleDestinationChange}
										placeholder="e.g. Pokhara"
										className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
									/>
								</div>

								{/* Price Range */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Price Range (NPR)
									</label>
									<div className="flex gap-2">
										<input
											type="number"
											value={priceInputs.min}
											onChange={(e) => handlePriceChange('min', e.target.value)}
											placeholder="Min"
											className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
										/>
										<input
											type="number"
											value={priceInputs.max}
											onChange={(e) => handlePriceChange('max', e.target.value)}
											placeholder="Max"
											className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
										/>
									</div>
								</div>

								{/* Difficulty */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Difficulty
									</label>
									<select
										title="Difficulty"
										value={filters.difficultyLevel || ''}
										onChange={(e) => updateFilter('difficultyLevel', e.target.value)}
										className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm cursor-pointer"
									>
										<option value="">Any Difficulty</option>
										{DIFFICULTY_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>

								{/* Duration (Days) */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Duration (Days)
									</label>
									<div className="flex gap-2">
										<input
											type="number"
											value={daysInputs.min}
											onChange={(e) => handleDaysChange('min', e.target.value)}
											placeholder="Min"
											className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
										/>
										<input
											type="number"
											value={daysInputs.max}
											onChange={(e) => handleDaysChange('max', e.target.value)}
											placeholder="Max"
											className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
										/>
									</div>
								</div>

								{/* Best Season */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Best Season
									</label>
									<select
										title="Best Season"
										value={filters.bestSeason || ''}
										onChange={(e) => updateFilter('bestSeason', e.target.value)}
										className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm cursor-pointer"
									>
										<option value="">Any Season</option>
										{BEST_SEASON_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>

								{/* Ideal For */}
								<div className="mb-5">
									<label className="block text-xs font-semibold text-ink mb-2">
										Ideal For
									</label>
									<select
										title="Ideal For"
										value={filters.idealFor || ''}
										onChange={(e) => updateFilter('idealFor', e.target.value)}
										className="w-full border border-line bg-surface rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm cursor-pointer"
									>
										<option value="">Anyone</option>
										{IDEAL_FOR_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>

									{/* Toggles */}
									<div className="pt-4 border-t border-line-muted space-y-3">
										<label className="flex items-center gap-2 cursor-pointer group">
											<Checkbox
												checked={!!filters.instantBooking}
												onChange={(e) =>
													updateFilter(
														'instantBooking',
														e.target.checked || undefined,
													)
												}
												className="focus:ring-teal-500"
											/>
											<span className="text-sm text-ink-muted group-hover:text-ink">
												Instant Booking
											</span>
										</label>
										<label className="flex items-center gap-2 cursor-pointer group">
											<Checkbox
												checked={!!filters.hostVerified}
												onChange={(e) =>
													updateFilter(
														'hostVerified',
														e.target.checked || undefined,
													)
												}
												className="focus:ring-teal-500"
											/>
											<span className="text-sm text-ink-muted group-hover:text-ink">
												Verified Host
										</span>
									</label>
								</div>
							</div>
						</aside>

						{/* Results */}
							<main className="lg:col-span-3">
								{/* Results Header */}
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
								<div>
									<h3 className="section-heading text-ink mb-1">
										{destinationInput
											? `${destinationInput} Experiences`
											: 'All Experiences'}
									</h3>
									<p className="text-sm text-ink-muted">
										{loading
											? 'Loading...'
											: <>Showing <span className="font-semibold text-ink">{totalCount} experience{totalCount !== 1 ? 's' : ''}</span></>}
									</p>
								</div>
								<div className="flex items-center gap-3">
									<select
										title="Sort By"
										value={filters.ordering || '-created_at'}
										onChange={(e) => updateFilter('ordering', e.target.value)}
										className="border border-line bg-surface rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium cursor-pointer"
									>
										{ORDERING_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
							</div>

							{/* Error */}
							{error && !loading && (
								<div className="text-center py-12">
									<p className="text-red-600 mb-4">{error}</p>
									<button
										type="button"
										onClick={() => void fetchListings(filters)}
										className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
									>
										Try Again
									</button>
								</div>
							)}

							{/* Empty */}
							{!loading && !error && listings.length === 0 && (
								<div className="text-center py-12">
									<h3 className="card-heading text-ink mb-2">
										No experiences found
									</h3>
									<p className="text-ink-muted mb-4">
										Try adjusting your filters or search terms.
									</p>
									{hasActiveFilters && (
										<button
											type="button"
											onClick={clearFilters}
											className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
										>
											Clear all filters
										</button>
									)}
									{recommendationsEnabled && (
										<RecommendationGrid
											title="You Might Like These Instead"
											listings={suggestedListings}
											meta={suggestedMeta}
											surface="for_you"
											loading={suggestedLoading}
											error={suggestedError}
											columns={3}
											skeletonCount={3}
										/>
									)}
								</div>
							)}

							{/* Listings Grid */}
							{listings.length > 0 && (
								<>
									<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
										{listings.map((listing, index) => (
											<ListingCard
												key={listing.id}
												listing={listing}
												onNavigate={() =>
													handleBrowseCardNavigate(listing, index + 1)
												}
												state={buildBrowseNavigationState(
													listing,
													browseSurface,
													index + 1,
												)}
											/>
										))}
									</div>

									<div className="mt-10">
										<Pagination
											currentPage={filters.page || 1}
											totalCount={totalCount}
											onPageChange={(page) =>
												setFilters((prev) => ({ ...prev, page }))
											}
										/>
									</div>
								</>
							)}
						</main>
					</div>
				)}

				{/* Packages Tab */}
				{activeTab === 'packages' && (
					<div className="grid lg:grid-cols-4 gap-6">
						{/* Package Filters Sidebar */}
						<aside className="lg:col-span-1 hidden lg:block">
							<PackageFilters
								filters={packageFilters}
								tagsInput={pkgTagsInput}
								hasActiveFilters={hasActivePackageFilters}
								onTagsChange={handlePkgTagsChange}
								onFilterChange={updatePackageFilter}
								onClear={clearPackageFilters}
							/>
						</aside>

						{/* Package Results */}
						<main className="lg:col-span-3">
							{/* Results Header */}
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
								<div>
									<h3 className="section-heading text-ink mb-1">
										All Packages
									</h3>
									<p className="text-sm text-ink-muted">
										{pkgLoading
											? 'Loading...'
											: <>Showing <span className="font-semibold text-ink">{packageCount} package{packageCount !== 1 ? 's' : ''}</span></>}
									</p>
									</div>
								</div>

								{recommendationsEnabled && shouldShowTopPackageRecommendations && (
									<PackageRecommendationGrid
										title="Recommended Packages For You"
										packages={suggestedPackages}
										meta={suggestedPackagesMeta}
										loading={suggestedPackagesLoading}
										error={suggestedPackagesError}
										columns={3}
										skeletonCount={3}
									/>
								)}

								{/* Error */}
								{pkgError && !pkgLoading && (
								<div className="text-center py-12">
									<p className="text-red-600 mb-4">{pkgError}</p>
									<button
										type="button"
										onClick={() => void fetchPackages(packageFilters)}
										className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
									>
										Try Again
									</button>
								</div>
							)}

							{/* Loading Skeleton */}
							{pkgLoading && (
								<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
									{Array.from({ length: 6 }).map((_, i) => (
										<div
											key={i}
											className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden animate-pulse"
										>
											<div className="aspect-video bg-surface-muted" />
											<div className="p-4 space-y-3">
												<div className="h-4 bg-surface-muted rounded w-3/4" />
												<div className="h-3 bg-surface-muted rounded w-1/2" />
												<div className="h-3 bg-surface-muted rounded w-2/3" />
												<div className="h-3 bg-line-muted rounded w-1/3" />
											</div>
											<div className="px-4 pb-4 pt-2 border-t border-line-muted flex justify-between">
												<div className="h-4 bg-surface-muted rounded w-1/3" />
												<div className="h-4 bg-line-muted rounded w-1/4" />
											</div>
										</div>
									))}
								</div>
							)}

							{/* Empty */}
							{!pkgLoading && !pkgError && packages.length === 0 && (
								<div className="text-center py-16">
									<Package className="w-12 h-12 text-teal-300 mx-auto mb-4" />
									<h3 className="card-heading text-ink mb-2">
										No packages match your filters
									</h3>
									<p className="text-ink-muted mb-4">
										Try adjusting your search or filters.
									</p>
										{hasActivePackageFilters && (
											<button
												type="button"
											onClick={clearPackageFilters}
											className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
										>
												Clear Filters
											</button>
										)}
										{recommendationsEnabled && shouldShowEmptyStatePackageRecommendations && (
											<div className="mt-10 text-left">
												<PackageRecommendationGrid
													title="Recommended Packages For You"
													packages={suggestedPackages}
													meta={suggestedPackagesMeta}
													loading={suggestedPackagesLoading}
													error={suggestedPackagesError}
													columns={3}
													skeletonCount={3}
												/>
											</div>
										)}
									</div>
								)}

							{/* Package Grid */}
							{!pkgLoading && packages.length > 0 && (
								<>
									<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
										{packages.map((pkg) => (
											<PublicPackageCard key={pkg.id} pkg={pkg} />
										))}
									</div>

									<div className="mt-10">
										<Pagination
											currentPage={packageFilters.page}
											totalCount={packageCount}
											onPageChange={(page) =>
												setPackageFilters((prev) => ({ ...prev, page }))
											}
										/>
									</div>
								</>
							)}
						</main>
					</div>
				)}
			</div>
		</div>
	);
};

export default PublicListings;

function buildBrowseNavigationState(
	listing: PublicListing,
	surface: BrowsingInteractionSurface,
	position: number,
): ListingNavigationState {
	return {
		listingNavigationContext: {
			source: 'browse',
			listingId: listing.id,
			surface,
			position,
		},
	};
}
