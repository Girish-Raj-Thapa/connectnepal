import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, XCircle, Clock } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import FilterTabs from '@components/common/FilterTabs';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { AdminHostService } from '@services/admin.service';
import { ROUTES } from '@/constants/routes';
import { getInitials } from '@utils/format';
import { getAvatarGradient } from '@utils/avatar';
import type { AdminHostListItem, HostVerificationStatus } from '@/types/admin';

type HostFilter = 'all' | 'pending' | 'approved' | 'rejected';

const HOST_TABS: { value: HostFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'pending', label: 'Pending' },
	{ value: 'approved', label: 'Verified' },
	{ value: 'rejected', label: 'Rejected' },
];

const filterToStatus = (
	filter: HostFilter,
): HostVerificationStatus | undefined => {
	if (filter === 'all') return undefined;
	return filter;
};

const STATUS_BADGE: Record<HostVerificationStatus, { bg: string; text: string; label: string }> = {
	not_submitted: { bg: 'bg-surface-muted', text: 'text-ink-secondary', label: 'Not Submitted' },
	pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
	approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' },
	rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};


const AdminVerifyHosts = () => {
	const navigate = useNavigate();
	const [filter, setFilter] = useState<HostFilter>('pending');
	const [hosts, setHosts] = useState<AdminHostListItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchHosts = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const status = filterToStatus(filter);
			const data = await AdminHostService.list({
				page,
				verificationStatus: status,
			});
			setHosts(data.results);
			setTotalCount(data.count);
			} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load hosts');
		} finally {
			setLoading(false);
		}
	}, [filter, page]);

	useEffect(() => {
		void fetchHosts();
	}, [fetchHosts]);

	const handleFilterChange = (newFilter: HostFilter) => {
		setFilter(newFilter);
		setPage(1);
	};

	// Compute stats from current page data
	const stats = useMemo(() => ({
		pending: hosts.filter((h) => h.verificationStatus === 'pending').length,
		verified: hosts.filter((h) => h.verificationStatus === 'approved').length,
		rejected: hosts.filter((h) => h.verificationStatus === 'rejected').length,
	}), [hosts]);


	return (
		<DashboardLayout>
			{/* Header */}
			<div className="mb-6">
				<h1 className="page-heading text-ink flex items-center gap-2">
					<ShieldCheck className="w-6 h-6 text-teal-600" />
					Verify Hosts
				</h1>
				<p className="page-subtext mt-1">
					Review and approve host verification applications
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				<div className="bg-surface rounded-2xl border border-line p-5 flex items-center gap-4">
					<div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
						<Clock className="w-5 h-5 text-yellow-600" />
					</div>
					<div>
						<p className="text-2xl font-bold text-ink">{stats.pending}</p>
						<p className="text-xs text-ink-muted">Pending Review</p>
					</div>
				</div>
				<div className="bg-surface rounded-2xl border border-line p-5 flex items-center gap-4">
					<div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
						<ShieldCheck className="w-5 h-5 text-green-600" />
					</div>
					<div>
						<p className="text-2xl font-bold text-ink">{stats.verified}</p>
						<p className="text-xs text-ink-muted">Verified</p>
					</div>
				</div>
				<div className="bg-surface rounded-2xl border border-line p-5 flex items-center gap-4">
					<div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
						<XCircle className="w-5 h-5 text-red-600" />
					</div>
					<div>
						<p className="text-2xl font-bold text-ink">{stats.rejected}</p>
						<p className="text-xs text-ink-muted">Rejected</p>
					</div>
				</div>
			</div>

			{/* Filter tabs */}
			<FilterTabs tabs={HOST_TABS} active={filter} onChange={handleFilterChange} />

			{/* Content */}
			{loading && (
				<div className="py-16">
					<Loader size="lg" text="Loading hosts..." />
				</div>
			)}

			{!loading && error && <DashboardError message={error} onRetry={() => void fetchHosts()} />}

			{!loading && !error && hosts.length === 0 && (
				<div className="text-center py-16">
					<Users className="w-12 h-12 text-line mx-auto mb-4" />
					<h3 className="card-heading text-ink mb-1">No hosts found</h3>
					<p className="text-ink-muted text-sm">No hosts match the current filter.</p>
				</div>
			)}

			{!loading && !error && hosts.length > 0 && (
				<>
					<div className="bg-surface rounded-2xl border border-line overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-surface-muted border-b border-line">
									<tr>
										<th className="th-cell">
											Host Details
										</th>
										<th className="th-cell">
											Contact
										</th>
										<th className="th-cell">
											Documents
										</th>
										<th className="th-cell">
											Status
										</th>
										<th className="th-cell">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line">
									{hosts.map((host) => {
										const initials = getInitials(host.fullName);
										const badge = STATUS_BADGE[host.verificationStatus];

										return (
											<tr key={host.userId} className="hover:bg-surface-muted">
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														<div
															className={`w-10 h-10 bg-linear-to-br ${getAvatarGradient(initials)} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}
														>
															{initials}
														</div>
														<div>
															<div className="font-semibold text-ink text-sm">
																{host.fullName}
															</div>
															<div className="text-xs text-ink-muted">
																{host.businessName || '\u2014'}
															</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4 text-sm text-ink-muted">{host.email}</td>
												<td className="px-6 py-4">
													<span className="text-sm text-ink font-medium">
														{host.documentCount} uploaded
													</span>
												</td>
												<td className="px-6 py-4">
													<span
														className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
													>
														{badge.label}
													</span>
												</td>
												<td className="px-6 py-4">
													<button
														type="button"
														onClick={() =>
															void navigate(
																ROUTES.ADMIN_VERIFY_HOST_DETAIL.replace(
																	':id',
																	String(host.userId),
																),
															)
														}
														className="text-teal-600 hover:text-teal-700 font-semibold text-sm"
													>
														Review
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>

					{/* Pagination */}
					<div className="mt-6">
						<Pagination
							currentPage={page}
							totalCount={totalCount}
							onPageChange={setPage}
						/>
					</div>
				</>
			)}
		</DashboardLayout>
	);
};

export default AdminVerifyHosts;
