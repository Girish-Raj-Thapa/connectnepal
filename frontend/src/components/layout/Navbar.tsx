import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { navbarConfig } from '@/config/navbarNav';
import type { NavbarRole } from '@/config/navbarNav';
const logo = '/logo-green.png';
import { ROUTES } from '@constants/routes';
import NotificationBell from '@components/notifications/NotificationBell';

interface NavbarProps {
	/**
	 * Optional ReactNode rendered to the LEFT of the logo.
	 * Used by DashboardLayout to inject the sidebar hamburger toggle.
	 *
	 * When present:
	 *  - Navbar uses full-width container (no max-w-7xl)
	 *  - Center nav links are hidden (sidebar handles navigation)
	 *  - Navbar does not render its own mobile hamburger
	 *
	 * When absent:
	 *  - Navbar uses max-w-7xl centered container
	 *  - Center nav links are visible (role-based)
	 *  - Navbar renders its own mobile hamburger for nav link menu
	 */
	leftSlot?: ReactNode;
}

const Navbar = ({ leftSlot }: NavbarProps) => {
	const { user, logout, isAuthenticated } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Determine which nav config to use
	const navRole: NavbarRole = user ? user.role : 'guest';
	const navLinks = navbarConfig[navRole];

	// Whether this is a dashboard context (leftSlot provided)
	const isDashboard = !!leftSlot;

	// ─── Close dropdown on outside click ───
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// ─── Close dropdown + mobile menu on Escape key ───
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setDropdownOpen(false);
				setMobileMenuOpen(false);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	// ─── Avatar helpers ───
	const getInitials = (): string => {
		if (user?.firstName && user?.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
		}
		if (user?.firstName) {
			return user.firstName[0].toUpperCase();
		}
		return user?.email[0].toUpperCase() ?? '?';
	};

	// ─── Dashboard route helper ───
	const getDashboardRoute = (): string => {
		switch (user?.role) {
			case 'traveller': return ROUTES.TRAVELLER_DASHBOARD;
			case 'host':      return ROUTES.HOST_DASHBOARD;
			case 'admin':     return ROUTES.ADMIN_DASHBOARD;
			default:          return ROUTES.HOME;
		}
	};

	return (
		<header className="bg-surface/80 backdrop-blur-xl shadow-sm sticky top-0 z-50 border-b border-line-muted">
			<div className={isDashboard ? 'px-4 sm:px-6' : 'max-w-7xl mx-auto px-4 sm:px-6'}>
				<div className="h-16 flex items-center justify-between">

					{/* ── Left: optional slot + logo ── */}
					<div className="flex items-center gap-3">
						{leftSlot}

						{/* Own hamburger for mobile nav (public pages only) */}
						{!isDashboard && (
							<button
								type="button"
								onClick={() => setMobileMenuOpen((prev) => !prev)}
								className="p-2 -ml-2 rounded-lg text-ink-muted hover:bg-surface-muted md:hidden"
								aria-label="Toggle navigation menu"
							>
								{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
							</button>
						)}

						<Link to={ROUTES.HOME} className="flex items-center">
							<img src={logo} alt="ConnectNepal" className="h-10 w-auto" />
						</Link>
					</div>

					{/* ── Center: desktop nav links (public pages only) ── */}
					{!isDashboard && (
						<nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
							{navLinks.map((link) => (
								<NavLink
									key={link.id}
									to={link.path}
									end={link.path === ROUTES.HOME}
									className={({ isActive }) =>
										`navbar-link ${
											isActive
												? 'text-brand font-semibold'
												: 'text-ink-muted hover:text-brand'
										}`
									}
								>
									{link.label}
								</NavLink>
							))}
						</nav>
					)}

					{/* ── Right: auth buttons or avatar ── */}
					<div className="flex items-center gap-3">
						{/* Theme toggle */}
						<button
							type="button"
							onClick={toggleTheme}
							aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
							className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors"
						>
							{theme === 'dark' ? (
								<Sun className="w-5 h-5" />
							) : (
								<Moon className="w-5 h-5" />
							)}
						</button>

						{isAuthenticated && user ? (
							<>
								<NotificationBell />

								{/* ── Avatar dropdown ── */}
								<div className="relative" ref={dropdownRef}>
									<button
										type="button"
										onClick={() => setDropdownOpen((prev) => !prev)}
										className="flex items-center gap-2 rounded-full focus:outline-none focus-ring"
										aria-label="User menu"
										aria-expanded={dropdownOpen ? 'true' : 'false'}
										aria-haspopup="true"
									>
										{user.profilePhoto ? (
											<img
												src={user.profilePhoto}
												alt={user.firstName ?? 'Profile'}
												className="w-10 h-10 rounded-full object-cover ring-2 ring-line-muted"
											/>
										) : (
											<div className="w-10 h-10 bg-linear-to-br from-tealbrand to-accent rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-line-muted">
												{getInitials()}
											</div>
										)}
										<ChevronDown
											className={`w-4 h-4 text-ink-muted transition-transform duration-200 hidden sm:block ${
												dropdownOpen ? 'rotate-180' : ''
											}`}
										/>
									</button>

									{/* Dropdown menu */}
									{dropdownOpen && (
										<div className="absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-lg border border-line-muted py-1 z-50 animate-dropdown">
											{/* User info header */}
											<div className="px-4 py-3 border-b border-line-muted">
												<p className="text-sm font-semibold text-ink truncate">
													{user.fullName || user.firstName || user.email}
												</p>
												<p className="text-xs text-ink-muted capitalize">{user.role}</p>
											</div>

											{/* Dashboard link */}
											<Link
												to={getDashboardRoute()}
												className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-secondary hover:bg-surface-muted transition-colors"
												onClick={() => setDropdownOpen(false)}
											>
												<LayoutDashboard className="w-4 h-4" />
												Dashboard
											</Link>

											{/* Divider */}
											<div className="border-t border-line-muted my-1" />

											{/* Logout */}
											<button
												type="button"
												onClick={() => {
													setDropdownOpen(false);
													void logout();
												}}
												className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
											>
												<LogOut className="w-4 h-4" />
												Logout
											</button>
										</div>
									)}
								</div>
							</>
						) : (
							/* ── Guest: Sign In + Sign Up ── */
							<>
								<Link
									to={ROUTES.LOGIN}
									className="px-5 py-2.5 text-sm font-semibold text-ink-secondary border border-line rounded-xl hover:border-brand hover:text-brand transition hidden sm:block"
								>
									Sign In
								</Link>
								<Link
									to={ROUTES.REGISTER}
									className="px-5 py-2.5 text-sm font-semibold text-white bg-linear-to-r from-tealbrand to-accent rounded-xl hover:shadow-md transition"
								>
									Sign Up
								</Link>
							</>
						)}
					</div>
				</div>
			</div>

			{/* ── Mobile nav menu (public pages only) ── */}
			{!isDashboard && mobileMenuOpen && (
				<nav className="md:hidden border-t border-line-muted bg-surface/95 backdrop-blur-xl px-4 py-3 space-y-1">
					{navLinks.map((link) => (
						<NavLink
							key={link.id}
							to={link.path}
							end={link.path === ROUTES.HOME}
							onClick={() => setMobileMenuOpen(false)}
							className={({ isActive }) =>
								`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
									isActive
										? 'bg-brand-subtle text-brand'
										: 'text-ink-muted hover:bg-surface-muted'
								}`
							}
						>
							{link.label}
						</NavLink>
					))}

					{/* Guest: show auth buttons in mobile menu too */}
					{!isAuthenticated && (
						<div className="pt-3 border-t border-line-muted flex flex-col gap-2">
							<Link
								to={ROUTES.LOGIN}
								onClick={() => setMobileMenuOpen(false)}
								className="block text-center px-4 py-2.5 text-sm font-semibold text-ink-secondary border border-line rounded-xl hover:border-brand hover:text-brand transition"
							>
								Sign In
							</Link>
							<Link
								to={ROUTES.REGISTER}
								onClick={() => setMobileMenuOpen(false)}
								className="block text-center px-4 py-2.5 text-sm font-semibold text-white bg-linear-to-r from-tealbrand to-accent rounded-xl hover:shadow-md transition"
							>
								Sign Up
							</Link>
						</div>
					)}
				</nav>
			)}
		</header>
	);
};

export default Navbar;
