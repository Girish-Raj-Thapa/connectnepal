import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '@layouts/Sidebar';
import Navbar from '@components/layout/Navbar';

interface DashboardLayoutProps {
	children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

	// Sidebar toggle button — passed to Navbar's leftSlot
	const sidebarToggle = (
		<button
			type="button"
			onClick={() => setSidebarOpen((prev) => !prev)}
			className="p-2 -ml-2 rounded-lg text-ink-muted hover:bg-surface-muted lg:hidden"
			aria-label="Toggle sidebar"
		>
			{sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
		</button>
	);

	return (
		<div className="min-h-screen bg-surface-muted">
			<Navbar leftSlot={sidebarToggle} />

			<div className="flex items-start">
				<Sidebar open={sidebarOpen} onClose={closeSidebar} />
				<main className="flex-1 min-h-[calc(100vh-4rem)] p-6 lg:p-8 overflow-x-hidden">
					{children}
				</main>
			</div>
		</div>
	);
};

export default DashboardLayout;
