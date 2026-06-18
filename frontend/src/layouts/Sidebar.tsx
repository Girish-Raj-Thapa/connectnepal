import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { sidebarConfig } from '@/config/sidebarNav';

interface SidebarProps {
	open: boolean;
	onClose: () => void;
}

const Sidebar = ({ open, onClose }: SidebarProps) => {
	const { user } = useAuth();

	// ─── Escape key closes mobile sidebar ───
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && open) {
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [open, onClose]);

	// ─── Fallback: no user or unknown role ───
	if (!user) return null;

	const sections = sidebarConfig[user.role];

	// Safety guard: if role exists but config is somehow missing, render nothing
	if (!sections || sections.length === 0) {
		if (import.meta.env.DEV) console.warn('[Sidebar] No config found for role...');
		return null;
	}

	const handleItemClick = () => {
		// Close mobile sidebar after navigation
		onClose();
	};

	return (
		<>
			{/* Mobile overlay backdrop */}
			{open && (
				<div
					className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
					aria-hidden="true"
					onClick={onClose}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={`
					fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-64 bg-surface border-r border-line
					transform transition-transform duration-300 ease-in-out
					lg:translate-x-0 lg:sticky lg:top-16 lg:self-start lg:z-30
					${open ? 'translate-x-0' : '-translate-x-full'}
				`}
			>
				<nav
					className="h-full flex flex-col p-4 overflow-y-auto"
					aria-label="Main navigation"
				>
					{sections.map((section, sectionIdx) => (
						<div
							key={sectionIdx}
							className={
								sectionIdx === sections.length - 1
									? 'mt-auto pt-4 border-t border-line'
									: 'space-y-1'
							}
						>
							{section.items.map((item) => {
								const Icon = item.icon;

								// Disabled link items
								if (item.disabled) {
									return (
										<span
											key={item.id}
											className="sidebar-item text-ink-muted opacity-50 pointer-events-none"
										>
											<Icon className="w-5 h-5" />
											<span className="font-medium">{item.label}</span>
										</span>
									);
								}

								// Link items (NavLink)
								return (
									<NavLink
										key={item.id}
										to={item.path}
										end={item.activeMatch === 'exact'}
										onClick={handleItemClick}
										className={({ isActive }) =>
											`sidebar-item ${
												isActive
													? 'bg-brand-subtle text-brand'
													: 'text-ink-muted hover:bg-surface-muted hover:text-ink'
											}`
										}
									>
										<Icon className="w-5 h-5" />
										<span className="font-medium">{item.label}</span>
										{item.badge !== undefined && (
											<span className="ml-auto badge badge-info">{item.badge}</span>
										)}
									</NavLink>
								);
							})}
						</div>
					))}
				</nav>
			</aside>
		</>
	);
};

export default Sidebar;
