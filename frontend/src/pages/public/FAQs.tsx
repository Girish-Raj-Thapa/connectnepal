import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Search, MessageCircle } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import pagesService, { type FaqCategoryWithItems } from '@services/pages.service';
import { ROUTES } from '@constants/routes';

// ── Accordion item ────────────────────────────────────────────────────────────

function FaqAccordionItem({ question, answer }: { question: string; answer: string }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="border border-line-muted rounded-xl overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen(o => !o)}
				className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left bg-surface hover:bg-surface-muted transition-colors"
			>
				<span className="font-medium text-ink leading-snug">{question}</span>
				<ChevronDown
					className={`w-5 h-5 text-tealbrand shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
				/>
			</button>

			{open && (
				<div className="px-6 pb-5 pt-1 bg-surface border-t border-tealbrand/20">
					<div className="pl-3 border-l-4 border-tealbrand">
						<p className="text-ink-muted leading-relaxed text-sm">{answer}</p>
					</div>
				</div>
			)}
		</div>
	);
}

// ── FAQ group (category heading + items) ─────────────────────────────────────

function FaqGroup({ group, showHeading }: { group: FaqCategoryWithItems; showHeading: boolean }) {
	return (
		<div className="space-y-3">
			{showHeading && (
				<h2 className="font-heading text-lg font-semibold text-ink pt-4 first:pt-0 border-l-4 border-tealbrand pl-3">
					{group.name}
				</h2>
			)}
			{group.items.map(item => (
				<FaqAccordionItem key={item.id} question={item.question} answer={item.answer} />
			))}
		</div>
	);
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function FaqSkeleton() {
	return (
		<div className="space-y-3 animate-pulse">
			{Array.from({ length: 6 }).map((_, i) => (
				<div key={i} className="h-14 bg-surface-muted rounded-xl" />
			))}
		</div>
	);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FAQs() {
	const [faqGroups, setFaqGroups] = useState<FaqCategoryWithItems[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSlug, setActiveSlug] = useState<string>('all');
	const [search, setSearch] = useState('');

	function load() {
		setError(null);
		setLoading(true);
		pagesService
			.getFaqs()
			.then(data => {
				setFaqGroups(data);
			})
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : 'Failed to load FAQs'),
			)
			.finally(() => setLoading(false));
	}

	useEffect(() => {
		pagesService
			.getFaqs()
			.then(data => setFaqGroups(data))
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : 'Failed to load FAQs'),
			)
			.finally(() => setLoading(false));
	}, []);

	// Derive visible groups from active tab + search — no extra state
	const visibleGroups = useMemo(() => {
		const groups =
			activeSlug === 'all'
				? faqGroups
				: faqGroups.filter(g => g.slug === activeSlug);

		if (!search.trim()) return groups;

		const q = search.toLowerCase();
		return groups
			.map(g => ({
				...g,
				items: g.items.filter(
					item =>
						item.question.toLowerCase().includes(q) ||
						item.answer.toLowerCase().includes(q),
				),
			}))
			.filter(g => g.items.length > 0);
	}, [faqGroups, activeSlug, search]);

	const totalVisible = visibleGroups.reduce((sum, g) => sum + g.items.length, 0);

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* ── Hero ── */}
			<section className="relative overflow-hidden py-20 text-center">
				<div className="absolute inset-0 bg-linear-to-br from-surface via-tealbrand-light/40 to-surface" />
				<div className="relative max-w-2xl mx-auto px-6">
					<span className="inline-block px-4 py-1.5 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-tealbrand shadow-sm mb-5">
						Help Center
					</span>
					<h1 className="font-heading text-5xl md:text-6xl font-semibold text-ink mb-4 leading-tight">
						Got Questions?{' '}
						<span className="bg-linear-to-r from-tealbrand to-accent bg-clip-text text-transparent">
							We've Got Answers.
						</span>
					</h1>
					<p className="text-ink-muted text-lg leading-relaxed mb-8">
						Everything you need to know about booking, payments, accounts, and
						getting the most out of ConnectNepal.
					</p>

					{/* Search bar */}
					<div className="relative max-w-lg mx-auto">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted pointer-events-none" />
						<input
							type="text"
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Search questions..."
							className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-line bg-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-tealbrand/30 focus:border-tealbrand text-ink placeholder:text-ink-muted text-sm"
						/>
					</div>
				</div>
			</section>

			{/* ── Category Pills ── */}
			{!loading && !error && faqGroups.length > 0 && (
				<div className="max-w-4xl mx-auto px-6 mb-8">
					<div className="flex gap-2 flex-wrap">
						<button
							type="button"
							onClick={() => setActiveSlug('all')}
							className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
								activeSlug === 'all'
									? 'bg-tealbrand text-white shadow-sm'
									: 'bg-surface border border-line text-ink-muted hover:border-tealbrand hover:text-tealbrand'
							}`}
						>
							All
						</button>
						{faqGroups.map(g => (
							<button
								key={g.slug}
								type="button"
								onClick={() => setActiveSlug(g.slug)}
								className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
									activeSlug === g.slug
										? 'bg-tealbrand text-white shadow-sm'
										: 'bg-surface border border-line text-ink-muted hover:border-tealbrand hover:text-tealbrand'
								}`}
							>
								{g.name}
							</button>
						))}
					</div>
				</div>
			)}

			{/* ── FAQ Content ── */}
			<section className="max-w-4xl mx-auto px-6 pb-16">
				{loading && <FaqSkeleton />}

				{error && !loading && (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
							<span className="text-red-500 text-xl font-bold">!</span>
						</div>
						<p className="text-ink-muted mb-4">{error}</p>
						<button
							type="button"
							onClick={load}
							className="text-sm font-semibold text-tealbrand hover:underline"
						>
							Try again
						</button>
					</div>
				)}

				{!loading && !error && visibleGroups.length === 0 && (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center mb-4">
							<Search className="w-6 h-6 text-tealbrand" />
						</div>
						<h3 className="font-heading text-lg font-semibold text-ink mb-2">
							No results found
						</h3>
						<p className="text-ink-muted text-sm max-w-xs">
							{search
								? `No questions match "${search}". Try different keywords.`
								: 'No FAQs available in this category yet.'}
						</p>
						{search && (
							<button
								type="button"
								onClick={() => setSearch('')}
								className="mt-4 text-sm font-semibold text-tealbrand hover:underline"
							>
								Clear search
							</button>
						)}
					</div>
				)}

				{!loading && !error && visibleGroups.length > 0 && (
					<div className="space-y-8">
						{/* Result count when searching */}
						{search.trim() && (
							<p className="text-sm text-ink-muted">
								{totalVisible} result{totalVisible !== 1 ? 's' : ''} for &quot;{search}&quot;
							</p>
						)}

						{visibleGroups.map(group => (
							<FaqGroup
								key={group.slug}
								group={group}
								showHeading={activeSlug === 'all'}
							/>
						))}
					</div>
				)}
			</section>

			{/* ── Still have questions CTA ── */}
			{!loading && !error && (
				<section className="max-w-4xl mx-auto px-6 pb-20">
					<div className="bg-linear-to-br from-tealbrand to-accent rounded-2xl p-10 text-center text-white">
						<div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
							<MessageCircle className="w-6 h-6 text-white" />
						</div>
						<h2 className="font-heading text-2xl font-semibold mb-2">
							Still have questions?
						</h2>
						<p className="text-white/85 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
							Can't find what you're looking for? Our support team is happy to
							help you out.
						</p>
						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							<Link
								to={ROUTES.PUBLIC_LISTINGS}
								className="bg-surface text-tealbrand font-semibold px-6 py-2.5 rounded-xl hover:shadow-lg transition-all text-sm"
							>
								Browse Experiences
							</Link>
							<Link
								to={ROUTES.ABOUT_US}
								className="border-2 border-white text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-white/10 transition-all text-sm"
							>
								About ConnectNepal
							</Link>
						</div>
					</div>
				</section>
			)}

			{/* ── Footer ── */}
			<footer className="bg-linear-to-br from-gray-900 via-gray-950 to-black text-line pt-16 pb-10">
				<div className="max-w-7xl mx-auto px-6">
					<div className="grid md:grid-cols-4 gap-10 mb-12">
						<div>
							<div className="flex items-center gap-3 mb-4">
								<div className="w-10 h-10 bg-linear-to-br from-tealbrand to-accent rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
									CN
								</div>
								<span className="text-xl font-bold text-white">ConnectNepal</span>
							</div>
							<p className="text-sm text-ink-muted leading-relaxed">
								Connecting travellers with authentic community experiences across
								Nepal.
							</p>
						</div>
						<div>
							<h4 className="font-semibold text-white mb-4">Company</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<Link to={ROUTES.ABOUT_US} className="hover:text-accent transition-colors">
										About Us
									</Link>
								</li>
								<li>
									<a href="#" className="hover:text-accent transition-colors">
										Blog
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-white mb-4">Explore</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<a href="#" className="hover:text-accent transition-colors">
										Destinations
									</a>
								</li>
								<li>
									<Link to={ROUTES.PUBLIC_LISTINGS} className="hover:text-accent transition-colors">
										Experiences
									</Link>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-white mb-4">Support</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<Link to={ROUTES.FAQS} className="hover:text-accent transition-colors">
										FAQs
									</Link>
								</li>
								<li>
									<Link to={ROUTES.COMMUNITY_GUIDELINES} className="hover:text-accent transition-colors">
										Community Guidelines
									</Link>
								</li>
								<li>
									<Link to={ROUTES.TRUST_AND_SAFETY} className="hover:text-accent transition-colors">
										Trust & Safety
									</Link>
								</li>
							</ul>
						</div>
					</div>
					<div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-ink-muted">
						<p>© 2025 ConnectNepal. All rights reserved.</p>
						<div className="flex gap-6 mt-4 md:mt-0">
							<a href="#" className="hover:text-accent transition-colors">
								Terms
							</a>
							<a href="#" className="hover:text-accent transition-colors">
								Privacy
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
