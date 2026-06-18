import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import PackagesTable from '@components/packages/PackagesTable';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import { useConfirm } from '@context/ConfirmContext';
import packagesService from '@services/packages.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import { ITEMS_PER_PAGE } from '@/constants/pagination';
import type { PackageSummary, PackageTabFilter } from '@/types/packages';


const ManagePackages = () => {
	const location = useLocation();
	const confirm = useConfirm();

	// ── State ────────────────────────────────────────────
	const [packages, setPackages] = useState<PackageSummary[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [activeTab, setActiveTab] = useState<PackageTabFilter>('all');

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [actionLoading, setActionLoading] = useState(false);


	// ── Fetch packages ───────────────────────────────────
	const fetchPackages = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await packagesService.listPackages({
				isBookable:
					activeTab === 'all' ? undefined : activeTab === 'active',
				page,
			});
			setPackages(data.results);
			setTotalCount(data.count);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load packages');
		} finally {
			setLoading(false);
		}
	}, [activeTab, page]);

	useEffect(() => {
		void fetchPackages();
	}, [fetchPackages]);


	// ── Tab change resets to page 1 ──────────────────────
	const handleTabChange = (tab: PackageTabFilter) => {
		setActiveTab(tab);
		setPage(1);
	};


	// ── Toggle publish ────────────────────────────────────
	const handleTogglePublish = async (pkg: PackageSummary) => {
		try {
			setActionLoading(true);
			await packagesService.updatePackage(pkg.id, { isBookable: !pkg.isBookable });
			notification.success(pkg.isBookable ? 'Package unpublished.' : 'Package published.');
			void fetchPackages();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Action failed');
		} finally {
			setActionLoading(false);
		}
	};


	// ── Delete ────────────────────────────────────────────
	const handleDelete = async (pkg: PackageSummary) => {
		const confirmed = await confirm({
			title: 'Delete Package',
			message: <>Are you sure you want to delete <span className="font-semibold">"{pkg.title}"</span>? This cannot be undone. Deletion is blocked if active bookings exist.</>,
			confirmLabel: 'Delete',
		});
		if (!confirmed) return;
		try {
			setActionLoading(true);
			await packagesService.deletePackage(pkg.id);
			notification.success('Package deleted.');
			void fetchPackages();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Delete failed');
		} finally {
			setActionLoading(false);
		}
	};


	// ── Pagination ────────────────────────────────────────
	const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
	const hasPrev = page > 1;
	const hasNext = page < totalPages;


	return (
		<DashboardLayout key={location.pathname}>

			{/* ── Header ──────────────────────────────────────────── */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="page-heading text-ink mb-2">
						Manage Packages
					</h1>
					<p className="page-subtext">
						Create and manage package deals for your listings
					</p>
				</div>
				<Link to={ROUTES.HOST_CREATE_PACKAGE}>
					<Button variant="primary">
						<span className="flex items-center gap-2">
							<Plus className="w-5 h-5" />
							Create New Package
						</span>
					</Button>
				</Link>
			</div>

			{/* ── Content ─────────────────────────────────────────── */}
			{loading ? (
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading packages..." />
				</div>
			) : error ? (
				<FormErrorBanner>{error}</FormErrorBanner>
			) : (
				<>
					<PackagesTable
						packages={packages}
						activeTab={activeTab}
						onTabChange={handleTabChange}
						totalCount={totalCount}
						onDelete={(pkg) => { void handleDelete(pkg); }}
						onTogglePublish={(pkg) => { void handleTogglePublish(pkg); }}
						actionLoading={actionLoading}
					/>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between mt-6">
							<p className="text-sm text-ink-muted">
								Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
								{Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
							</p>
							<div className="flex items-center gap-2">
								<button
									onClick={() => setPage((p) => p - 1)}
									disabled={!hasPrev}
									className="p-2 rounded-lg border border-line hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<ChevronLeft className="w-4 h-4" />
								</button>
								<span className="text-sm font-medium text-ink-secondary px-2">
									Page {page} of {totalPages}
								</span>
								<button
									onClick={() => setPage((p) => p + 1)}
									disabled={!hasNext}
									className="p-2 rounded-lg border border-line hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<ChevronRight className="w-4 h-4" />
								</button>
							</div>
						</div>
					)}
				</>
			)}


		</DashboardLayout>
	);
};

export default ManagePackages;
