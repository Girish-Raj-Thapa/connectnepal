import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield, Star, AlertCircle } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import pagesService, { type PublicPage } from '@services/pages.service';
import { ROUTES } from '@constants/routes';

// ── Markdown renderer (same pattern as AboutUs)

function MarkdownBlock({ text }: { text: string }) {
	const blocks = text.split(/\n\n+/).filter(Boolean);

	return (
		<div className="space-y-4">
			{blocks.map((block, i) => {
				if (block.startsWith('# ')) {
					return (
						<h1
							key={i}
							className="font-heading text-3xl font-semibold text-ink mt-8 first:mt-0"
						>
							{block.slice(2).trim()}
						</h1>
					);
				}
				if (block.startsWith('## ')) {
					return (
						<h2
							key={i}
							className="font-heading text-xl font-semibold text-ink mt-6 first:mt-0 border-l-4 border-tealbrand pl-3"
						>
							{block.slice(3).trim()}
						</h2>
					);
				}
				if (block.startsWith('### ')) {
					return (
						<h3
							key={i}
							className="font-heading text-lg font-semibold text-ink-secondary mt-4 first:mt-0"
						>
							{block.slice(4).trim()}
						</h3>
					);
				}
				const lines = block.split('\n');
				if (lines.every(l => l.trim().startsWith('- '))) {
					return (
						<ul key={i} className="space-y-1.5 pl-2">
							{lines.map((line, j) => (
								<li key={j} className="flex gap-2 text-ink-secondary leading-relaxed">
									<span className="mt-2 w-1.5 h-1.5 rounded-full bg-tealbrand shrink-0" />
									{line.trim().slice(2)}
								</li>
							))}
						</ul>
					);
				}
				return (
					<p key={i} className="text-ink-secondary leading-relaxed">
						{block.trim()}
					</p>
				);
			})}
		</div>
	);
}

// ── Core principles (sidebar card) ───────────────────────────────────────────

const PRINCIPLES = [
	{
		icon: Heart,
		title: 'Respect',
		description: 'Treat every member of the community — host or traveller — with courtesy and cultural sensitivity.',
	},
	{
		icon: Star,
		title: 'Authenticity',
		description: 'Be honest in your listings, reviews, and interactions. Authentic experiences start with honest people.',
	},
	{
		icon: Shield,
		title: 'Safety',
		description: 'Prioritise the safety and wellbeing of yourself and others in every booking and interaction.',
	},
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityGuidelines() {
	const [page, setPage] = useState<PublicPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		pagesService
			.getCommunityGuidelines()
			.then(setPage)
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : 'Failed to load page'),
			)
			.finally(() => setLoading(false));
	}, []);

	function retry() {
		setError(null);
		setLoading(true);
		pagesService
			.getCommunityGuidelines()
			.then(setPage)
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : 'Failed to load page'),
			)
			.finally(() => setLoading(false));
	}

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar />

			{/* ── Hero ── */}
			<section className="relative overflow-hidden py-20 text-center">
				<div className="absolute inset-0 bg-linear-to-br from-surface via-tealbrand-light/40 to-surface" />
				<div className="relative max-w-3xl mx-auto px-6">
					<span className="inline-block px-4 py-1.5 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-tealbrand shadow-sm mb-6">
						Platform Standards
					</span>
					<h1 className="font-heading text-5xl md:text-6xl font-semibold text-ink mb-5 leading-tight">
						Community{' '}
						<span className="bg-linear-to-r from-tealbrand to-accent bg-clip-text text-transparent">
							Guidelines
						</span>
					</h1>
					<p className="text-ink-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
						ConnectNepal is built on trust. These guidelines help us keep the
						platform safe, respectful, and authentic for everyone.
					</p>
				</div>
			</section>

			{/* ── Core Principles Cards ── */}
			<section className="max-w-5xl mx-auto px-6 mb-6">
				<div className="grid md:grid-cols-3 gap-6">
					{PRINCIPLES.map(({ icon: Icon, title, description }) => (
						<div key={title} className="bg-surface rounded-2xl shadow-md border border-line-muted p-6">
							<div className="w-10 h-10 bg-brand-subtle rounded-xl flex items-center justify-center mb-4">
								<Icon className="w-5 h-5 text-tealbrand" />
							</div>
							<p className="font-heading font-semibold text-ink mb-1">{title}</p>
							<p className="text-sm text-ink-muted leading-relaxed">{description}</p>
						</div>
					))}
				</div>
			</section>

			{/* ── Report a concern banner ── */}
			<section className="max-w-5xl mx-auto px-6 mb-10">
				<div className="bg-surface rounded-2xl shadow-md border border-line-muted p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
							<AlertCircle className="w-4 h-4 text-amber-500" />
						</div>
						<div>
							<p className="font-semibold text-ink text-sm">See a violation?</p>
							<p className="text-xs text-ink-muted leading-relaxed">
								Report it through your booking or contact our support team.
							</p>
						</div>
					</div>
					<Link
						to={ROUTES.FAQS}
						className="shrink-0 border border-line text-ink-secondary font-semibold px-5 py-2 rounded-xl hover:border-tealbrand hover:text-tealbrand transition text-sm"
					>
						Visit Help Center
					</Link>
				</div>
			</section>

			{/* ── Full-width Content ── */}
			<section className="max-w-5xl mx-auto px-6 pb-16">
				<div className="bg-surface rounded-2xl shadow-md border border-line-muted p-8 md:p-12">
					{loading && (
						<div className="space-y-4 animate-pulse">
							<div className="h-7 bg-surface-muted rounded-lg w-2/3" />
							<div className="h-4 bg-surface-muted rounded w-full" />
							<div className="h-4 bg-surface-muted rounded w-5/6" />
							<div className="h-4 bg-surface-muted rounded w-full" />
							<div className="h-6 bg-surface-muted rounded-lg w-1/2 mt-6" />
							<div className="h-4 bg-surface-muted rounded w-full" />
							<div className="h-4 bg-surface-muted rounded w-4/5" />
							<div className="h-6 bg-surface-muted rounded-lg w-1/2 mt-6" />
							<div className="h-4 bg-surface-muted rounded w-full" />
							<div className="h-4 bg-surface-muted rounded w-3/4" />
						</div>
					)}

					{error && !loading && (
						<div className="flex flex-col items-center justify-center py-16 text-center">
							<div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
								<span className="text-red-500 text-xl font-bold">!</span>
							</div>
							<p className="text-ink-muted mb-4">{error}</p>
							<button
								type="button"
								onClick={retry}
								className="text-sm font-semibold text-tealbrand hover:underline"
							>
								Try again
							</button>
						</div>
					)}

					{page && !loading && <MarkdownBlock text={page.content} />}
				</div>
			</section>

			{/* ── CTA Banner ── */}
			<section className="max-w-5xl mx-auto px-6 pb-20">
				<div className="bg-linear-to-r from-tealbrand to-accent text-white rounded-2xl p-12 text-center">
					<h2 className="font-heading text-3xl font-semibold mb-4">
						Travel responsibly. Host with care.
					</h2>
					<p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
						When everyone follows these guidelines, ConnectNepal becomes a better
						place for hosts and travellers alike.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Link
							to={ROUTES.PUBLIC_LISTINGS}
							className="bg-surface text-tealbrand font-semibold px-8 py-3 rounded-xl hover:shadow-lg transition-all"
						>
							Browse Experiences
						</Link>
						<Link
							to={ROUTES.FAQS}
							className="border-2 border-white text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-all"
						>
							Read our FAQs
						</Link>
					</div>
				</div>
			</section>

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
