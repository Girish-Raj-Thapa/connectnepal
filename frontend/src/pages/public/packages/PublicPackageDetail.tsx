import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, BadgeCheck, CalendarDays, CheckCircle, MessageCircle, Package as PackageIcon, Users } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import PageLoader from '@components/feedback/PageLoader';
import SectionDivider from '@components/common/SectionDivider';
import Navbar from '@components/layout/Navbar';
import { ROUTES } from '@/constants/routes';
import publicPackagesService from '@/services/publicPackages.service';
import notification from '@/utils/notifications';
import { useChat } from '@context/ChatContext';
import PackageBookingSidebar from '@components/packages/PackageBookingSidebar';
import PackageSlotsSection from '@components/packages/PackageSlotsSection';
import PublicReviewsSection from '@components/reviews/PublicReviewsSection';
import type { PublicPackageDetail } from '@/types/packages';

const formatDisplayDate = (value: string | null | undefined): string => {
	if (!value) return '—';
	const parsed = parseISO(value);
	return isValid(parsed) ? format(parsed, 'd MMM yyyy') : value;
};

const formatPrice = (price: string): string => Number(price).toLocaleString('en-NP');

const PublicPackageDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { openChat, setContext } = useChat();
	const packageId = Number(id);

	const [pkg, setPkg] = useState<PublicPackageDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [termsExpanded, setTermsExpanded] = useState(false);

	useEffect(() => {
		if (!pkg?.id) return;
		setContext({ packageId: pkg.id });
		return () => setContext({ packageId: null });
	}, [pkg?.id, setContext]);

	useEffect(() => {
		if (!id || Number.isNaN(packageId) || packageId <= 0) {
			setError('Package not found');
			setLoading(false);
			return;
		}

		const fetchPackage = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await publicPackagesService.getPackageDetail(packageId);
				setPkg(data);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load package';
				notification.error(message);
				void navigate(`${ROUTES.PUBLIC_LISTINGS}?tab=packages`, { replace: true });
			} finally {
				setLoading(false);
			}
		};

		void fetchPackage();
	}, [id, packageId, navigate]);

	const termsPreviewStyle = useMemo(
		() =>
			termsExpanded
				? undefined
				: {
						display: '-webkit-box',
						WebkitLineClamp: 3,
						WebkitBoxOrient: 'vertical' as const,
						overflow: 'hidden',
					},
		[termsExpanded],
	);

	if (loading) {
		return <PageLoader />;
	}

	if (error || !pkg) {
		return (
			<div className="min-h-screen bg-surface-muted">
				<Navbar />
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<h1 className="page-heading text-ink mb-2">
						Package not found
					</h1>
					<p className="page-subtext mb-6">
						The package may have been removed or is no longer available.
					</p>
					<Link
						to={`${ROUTES.PUBLIC_LISTINGS}?tab=packages`}
						className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
					>
						Back to Packages
					</Link>
				</div>
			</div>
		);
	}

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
							to={`${ROUTES.PUBLIC_LISTINGS}?tab=packages`}
							className="text-ink-muted hover:text-teal-600 transition-colors"
						>
							Packages
						</Link>
						<span className="text-line">/</span>
						<span className="text-ink font-medium truncate max-w-xs">{pkg.title}</span>
					</div>
				</div>
			</div>

			{/* Hero Section */}
			<section className="bg-surface">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					{/* Title & Quick Info */}
					<div className="mb-6">
						<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
							<div className="grow">
								{/* Badges */}
								<div className="flex items-center gap-3 mb-3 flex-wrap">
									<span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-xs font-bold uppercase tracking-wide">
										{pkg.durationDays}D / {pkg.durationNights}N
									</span>
									{pkg.discountLabel && (
										<span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wide">
											{pkg.discountLabel}
										</span>
									)}
									<span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
										<BadgeCheck className="w-3 h-3" />
										Verified Provider
									</span>
								</div>

								{/* Title */}
								<h1 className="font-heading text-3xl md:text-4xl font-semibold text-ink mb-2">
									{pkg.title}
								</h1>

								{/* Host & Quick Info */}
								<div className="flex items-center gap-4 text-sm text-ink-muted flex-wrap">
									<span className="font-medium">Hosted by {pkg.hostName}</span>
									<div className="flex items-center gap-1">
										<CalendarDays className="w-4 h-4" />
										<span className="font-medium">
											{pkg.durationDays} day{pkg.durationDays !== 1 ? 's' : ''}
										</span>
									</div>
									<div className="flex items-center gap-1">
										<Users className="w-4 h-4" />
										<span className="font-medium">Max {pkg.maxGroupSize} people</span>
									</div>
								</div>
							</div>

								{/* Share & Save — temporarily disabled until real share and wishlist flows are implemented */}
							</div>
					</div>

					{/* Cover Image */}
					<div className="rounded-2xl overflow-hidden bg-surface-muted aspect-video">
						{pkg.coverImageUrl ? (
							<img src={pkg.coverImageUrl} alt={pkg.title} className="w-full h-full object-cover" />
						) : (
							<div className="w-full h-full bg-linear-to-br from-teal-400 to-teal-700 flex items-center justify-center">
								<PackageIcon className="w-20 h-20 text-white opacity-80" />
							</div>
						)}
					</div>
				</div>
			</section>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid lg:grid-cols-3 gap-8">
					{/* Left column - Content */}
					<div className="lg:col-span-2">
						{/* About */}
						<section>
							<h2 className="section-heading text-ink mb-4">About This Package</h2>
							<p className="text-ink-muted leading-relaxed whitespace-pre-line">{pkg.description}</p>
						</section>

						<SectionDivider />

						{/* Included Experiences */}
						{pkg.packageListings.length > 0 && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">Included Experiences</h2>
									<div className="grid sm:grid-cols-2 gap-4">
										{pkg.packageListings.map((item) => (
											<div
												key={item.id}
												className="flex gap-3 p-3 bg-teal-50 rounded-xl border border-teal-100 hover:border-teal-200 transition"
											>
												{item.primaryImageThumbnail ? (
													<img
														src={item.primaryImageThumbnail}
														alt={item.title}
														className="w-20 h-20 object-cover rounded-lg shrink-0"
													/>
												) : (
													<div className="w-20 h-20 rounded-lg bg-linear-to-br from-teal-100 to-teal-200 flex items-center justify-center shrink-0">
														<PackageIcon className="w-6 h-6 text-teal-700" />
													</div>
												)}
												<div className="min-w-0">
													<p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-1">
														{item.category}
													</p>
													<p className="text-sm font-semibold text-ink line-clamp-2">{item.title}</p>
													<p className="text-xs text-ink-muted mt-1">
														{item.durationDays} day{item.durationDays !== 1 ? 's' : ''}
													</p>
													<p className="text-xs font-semibold text-ink-secondary mt-1">
														NPR {formatPrice(item.pricePerPerson)} / person
													</p>
												</div>
											</div>
										))}
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Highlights */}
						{pkg.highlights?.trim() && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-3">Package Highlights</h2>
									<blockquote className="border-l-4 border-teal-400 pl-4 text-ink-secondary italic whitespace-pre-line">
										{pkg.highlights}
									</blockquote>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Inclusions */}
						{pkg.inclusions.length > 0 && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-4">What&apos;s Included</h2>
									<div className="grid sm:grid-cols-2 gap-4">
										{pkg.inclusions.map((inclusion) => (
											<div
												key={inclusion}
												className="flex items-start gap-3 p-3 bg-teal-50 rounded-xl border border-teal-100"
											>
												<div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
													<CheckCircle className="w-5 h-5 text-white" />
												</div>
												<div>
													<span className="font-semibold text-ink">{inclusion}</span>
												</div>
											</div>
										))}
									</div>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Duration & Validity */}
						<section>
							<h2 className="section-heading text-ink mb-3">Duration &amp; Validity</h2>
							<div className="space-y-2 text-sm text-ink-secondary">
								<p className="flex items-center gap-2">
									<CalendarDays className="w-5 h-5 text-ink-muted" />
									<span>
										{pkg.durationDays} day{pkg.durationDays !== 1 ? 's' : ''} / {pkg.durationNights} night{pkg.durationNights !== 1 ? 's' : ''}
									</span>
								</p>
								{(pkg.validFrom || pkg.validUntil) && (
									<p>
										Available: {formatDisplayDate(pkg.validFrom)} – {formatDisplayDate(pkg.validUntil)}
									</p>
								)}
							</div>
						</section>

						<SectionDivider />

						{/* Terms */}
						{pkg.termsAndConditions?.trim() && (
							<>
								<section>
									<h2 className="section-heading text-ink mb-3">Terms &amp; Conditions</h2>
									<p className="text-sm text-ink-secondary whitespace-pre-line" style={termsPreviewStyle}>
										{pkg.termsAndConditions}
									</p>
									<button
										type="button"
										onClick={() => setTermsExpanded((prev) => !prev)}
										className="mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700"
									>
										{termsExpanded ? 'Show less' : 'Show more'}
									</button>
								</section>
								<SectionDivider />
							</>
						)}

						{/* Reviews */}
							<section>
								<h2 className="section-heading text-ink mb-4">
									Traveller Reviews
								</h2>
								<PublicReviewsSection
									targetType="package"
									targetId={pkg.id}
									ratingAverage={pkg.ratingAverage ? Number(pkg.ratingAverage) : undefined}
									ratingCount={pkg.ratingCount}
								/>
							</section>
						<SectionDivider />

						{/* Departure Picker */}
						<section id="departure-picker">
							<h2 className="section-heading text-ink mb-4">Choose Your Departure</h2>
							<PackageSlotsSection
								packageId={pkg.id}
								maxGroupSize={pkg.maxGroupSize}
								durationDays={pkg.durationDays}
							/>
						</section>
					</div>

					{/* Right column - Sidebar */}
					<div className="lg:col-span-1">
						<div className="sticky top-24">
							<PackageBookingSidebar pkg={pkg} />
							<button
								type="button"
								onClick={() => openChat({ packageId: pkg.id })}
								className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2.5 text-sm font-semibold text-teal-700 border-2 border-teal-200 rounded-xl hover:bg-teal-50 hover:border-teal-400 transition-all"
							>
								<MessageCircle className="w-4 h-4" />
								Ask about this package
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PublicPackageDetail;
