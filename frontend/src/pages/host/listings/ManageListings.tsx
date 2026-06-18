import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import VerificationBanner from '@components/host/VerificationBanner';
import ListingsTable from '@components/host-listings/ListingsTable';
import ListingsFilters from '@components/host-listings/ListingsFilters';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import { useConfirm } from '@context/ConfirmContext';
import listingsService from '@services/listings.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import { ITEMS_PER_PAGE } from '@/constants/pagination';
import type {
	BookableFilter,
	ListingAction,
	HostLimits,
	MyListing,
} from '@/types/listings';

const ManageListings = () => {

    const navigate = useNavigate();
	const location = useLocation();
	const confirm = useConfirm();

	// ── State ────────────────────────────────────────────
	const [listings, setListings] = useState<MyListing[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [bookableFilter, setBookableFilter] = useState<BookableFilter>('all');
	const [limits, setLimits] = useState<HostLimits | null>(null);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [actionLoading, setActionLoading] = useState(false);


    // ── Fetch listings ───────────────────────────────────
	const fetchListings = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await listingsService.getMyListings({
				isBookable:
					bookableFilter === 'all'
						? undefined
						: bookableFilter === 'active',
				page,
			});
			setListings(data.results);
			setTotalCount(data.count);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to load listings';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [bookableFilter, page]);

    // ── Fetch limits (once on mount) ─────────────────────
	const fetchLimits = useCallback(async () => {
		try {
			const data = await listingsService.getMyLimits();
			setLimits(data);
		} catch {
			// Non-critical — don't block page
		}
	}, []);
    
    
    // ── Effects ──────────────────────────────────────────
	useEffect(() => {
		void fetchListings();
	}, [fetchListings]);

	useEffect(() => {
		void fetchLimits();
	}, [fetchLimits]);


    // ── Tab change resets to page 1 ──────────────────────
	const handleFilterChange = (filter: BookableFilter) => {
		setBookableFilter(filter);
		setPage(1);
	};


	// ── Action handler ───────────────────────────────────
	const handleAction = async (action: ListingAction, listingId: number) => {
		if (action === 'edit') {
			void navigate(ROUTES.HOST_EDIT_LISTING.replace(':id', String(listingId)));
			return;
		}
		if (action === 'manageSlots') {
			void navigate(ROUTES.HOST_MANAGE_SLOTS.replace(':id', String(listingId)));
			return;
		}

		if (action === 'delete') {
			const target = listings.find((l) => l.id === listingId);
			if (!target) return;
			const confirmed = await confirm({
				title: 'Delete Listing',
				message: <>Are you sure you want to delete <span className="font-semibold">"{target.title}"</span>? This cannot be undone. Deletion is blocked if active bookings exist.</>,
				confirmLabel: 'Delete',
			});
			if (!confirmed) return;
			setActionLoading(true);
			try {
				await listingsService.deleteListing(listingId);
				notification.success('Listing deleted.');
				await fetchListings();
			} catch (err) {
				notification.error(err instanceof Error ? err.message : 'Failed to delete listing');
			} finally {
				setActionLoading(false);
			}
			return;
		}

		setActionLoading(true);
		try {
			if (action === 'toggleBookable') {
				const current = listings.find((l) => l.id === listingId);
				if (current) {
					if (!current.isBookable && !current.primaryImageThumbnail) {
						notification.error('Add at least one image before activating this listing.');
					} else {
						await listingsService.updateListing(listingId, {
							isBookable: !current.isBookable,
						});
						notification.success(
							!current.isBookable
								? 'Listing is now active.'
								: 'Listing is now inactive.',
						);
						await fetchListings();
					}
				}
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Action failed';
			notification.error(message);
		} finally {
			setActionLoading(false);
		}
	};


    // ── Pagination ───────────────────────────────────────
	const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
	const hasNext = page < totalPages;
	const hasPrev = page > 1;


    return (
        <DashboardLayout key={location.pathname}>
			<VerificationBanner isVerified={limits?.isVerified} />
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="page-heading text-ink mb-2">
						Manage Listings
					</h1>
					<p className="page-subtext">
						Create, edit, and manage your experiences
					</p>
				</div>
				<Link to={ROUTES.HOST_CREATE_LISTING}>
					<Button
						variant="primary"
						disabled={limits !== null && !limits.canCreate}
					>
						<span className="flex items-center gap-2">
							<Plus className="w-5 h-5" />
							Create New Listing
						</span>
					</Button>
				</Link>
			</div>

			{/* Limit warning */}
			{limits && !limits.canCreate && (
				<div className="mb-6">
					<FormErrorBanner>
						You've reached the limit of {limits.listingsLimit} listings.
						Verify your account to create more.
					</FormErrorBanner>
				</div>
			)}

			{/* Filters */}
			<ListingsFilters
				activeFilter={bookableFilter}
				onFilterChange={handleFilterChange}
			/>

			{/* Content */}
			{loading ? (
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading listings..." />
				</div>
			) : error ? (
				<FormErrorBanner>{error}</FormErrorBanner>
			) : listings.length === 0 ? (
				/* Empty state */
				<div className="bg-surface rounded-2xl border border-line p-12 text-center">
					<p className="text-ink-muted text-lg mb-4">
						{bookableFilter !== 'all'
							? `No ${bookableFilter === 'active' ? 'active' : 'inactive'} listings found.`
							: 'You haven\'t created any listings yet.'}
					</p>
					{bookableFilter === 'all' && (
						<Link to={ROUTES.HOST_CREATE_LISTING}>
							<Button variant="primary">
								<span className="flex items-center gap-2">
									<Plus className="w-5 h-5" />
									Create Your First Listing
								</span>
							</Button>
						</Link>
					)}
				</div>
			) : (
				<>
					{/* Table */}
					<ListingsTable
						listings={listings}
						onAction={(action, id) => void handleAction(action, id)}
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
									aria-label="Previous page"
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
									aria-label="Next page"
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

export default ManageListings;
