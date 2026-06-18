import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import Navbar from '@components/layout/Navbar';
import pagesService, { type PublicPage } from '@services/pages.service';
import { ROUTES } from '@constants/routes';

// ── Markdown renderer ─────────────────────────────────────────────────────────

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

// ── Platform protections checklist ────────────────────────────────────────────

const PROTECTIONS = [
	'Verified host profiles',
	'Secure payments via eSewa',
	'Structured complaint system',
	'Review moderation',
	'Booking confirmation records',
	'Support for dispute reporting',
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TrustAndSafety() {
	const [page, setPage] = useState<PublicPage | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		pagesService
			.getTrustAndSafety()
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
			.getTrustAndSafety()
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
						Your Safety Matters
					</span>
					<h1 className="font-heading text-5xl md:text-6xl font-semibold text-ink mb-5 leading-tight">
						Trust &{' '}
						<span className="bg-linear-to-r from-tealbrand to-accent bg-clip-text text-transparent">
							Safety
						</span>
					</h1>
					<p className="text-ink-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
						Trust and safety are shared responsibilities. Here's how ConnectNepal
						helps protect everyone on the platform — and what you can do too.
					</p>
				</div>
			</section>

			{/* ── Summary Cards ── */}
			<section className="max-w-5xl mx-auto px-6 mb-10">
				<div className="grid md:grid-cols-2 gap-6">

					{/* Platform Protections card */}
					<div className="bg-surface rounded-2xl shadow-md border border-line-muted p-6">
						<div className="flex items-center gap-2 mb-5">
							<div className="w-9 h-9 bg-brand-subtle rounded-lg flex items-center justify-center shrink-0">
								<CheckCircle className="w-4 h-4 text-tealbrand" />
							</div>
							<h3 className="font-heading text-base font-semibold text-ink">
								Platform Protections
							</h3>
						</div>
						<ul className="space-y-3">
							{PROTECTIONS.map(item => (
								<li key={item} className="flex items-center gap-2.5">
									<CheckCircle className="w-4 h-4 text-tealbrand shrink-0" />
									<span className="text-sm text-ink-secondary">{item}</span>
								</li>
							))}
						</ul>
					</div>

					{/* Report card */}
					<div className="bg-surface rounded-2xl shadow-md border border-line-muted p-6 flex flex-col justify-between">
						<div>
							<div className="flex items-center gap-2 mb-4">
								<div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
									<AlertTriangle className="w-4 h-4 text-amber-500" />
								</div>
								<h3 className="font-heading text-base font-semibold text-ink">
									Need to report something?
								</h3>
							</div>
							<p className="text-sm text-ink-muted leading-relaxed mb-6">
								If something feels wrong — unsafe, deceptive, or seriously
								inappropriate — use the platform's complaint or support channels.
								Report clearly, include your booking reference, and provide any
								supporting evidence you have.
							</p>
						</div>
						<Link
							to={ROUTES.FAQS}
							className="block text-center border border-line text-ink-secondary font-semibold px-5 py-2.5 rounded-xl hover:border-tealbrand hover:text-tealbrand transition text-sm"
						>
							Visit Help Center
						</Link>
					</div>
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
						Have a concern? We're here to help.
					</h2>
					<p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
						Safety is a shared effort. If something doesn't feel right, don't
						hesitate to reach out or consult our help resources.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Link
							to={ROUTES.PUBLIC_LISTINGS}
							className="bg-surface text-tealbrand font-semibold px-8 py-3 rounded-xl hover:shadow-lg transition-all"
						>
							Browse Safely
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
