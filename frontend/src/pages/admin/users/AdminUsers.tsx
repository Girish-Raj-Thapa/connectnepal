import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@hooks/useDebounce';
import { Users, Search } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import FilterTabs from '@components/common/FilterTabs';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { AdminUserService } from '@services/admin.service';
import { ROUTES } from '@/constants/routes';
import { formatDate, getInitials } from '@utils/format';
import { getAvatarGradient } from '@utils/avatar';
import type { AdminUserListItem } from '@/types/admin';

type UserFilter = 'all' | 'traveller' | 'host' | 'active' | 'suspended';

const USER_TABS: { value: UserFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'traveller', label: 'Travellers' },
	{ value: 'host', label: 'Hosts' },
	{ value: 'active', label: 'Active' },
	{ value: 'suspended', label: 'Suspended' },
];

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
	traveller: { bg: 'bg-purple-100', text: 'text-purple-700' },
	host: { bg: 'bg-teal-100', text: 'text-teal-700' },
	admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
};


const AdminUsers = () => {
	const navigate = useNavigate();
	const [filter, setFilter] = useState<UserFilter>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const debouncedSearch = useDebounce(searchQuery);
	const [users, setUsers] = useState<AdminUserListItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchUsers = useCallback(async () => {
		try {
			setLoading(true);
			setError('');

			const params: { page: number; role?: string; isActive?: boolean; search?: string } = { page };

			switch (filter) {
				case 'traveller':
					params.role = 'traveller';
					break;
				case 'host':
					params.role = 'host';
					break;
				case 'active':
					params.isActive = true;
					break;
				case 'suspended':
					params.isActive = false;
					break;
			}

			if (debouncedSearch.trim()) {
				params.search = debouncedSearch.trim();
			}

			const data = await AdminUserService.list(params);
			setUsers(data.results);
			setTotalCount(data.count);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load users');
		} finally {
			setLoading(false);
		}
	}, [filter, page, debouncedSearch]);

	useEffect(() => {
		void fetchUsers();
	}, [fetchUsers]);

	const handleFilterChange = (newFilter: UserFilter) => {
		setFilter(newFilter);
		setPage(1);
	};

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setPage(1);
	};



	return (
		<DashboardLayout>
			{/* Header */}
			<div className="mb-6">
				<h1 className="page-heading text-ink flex items-center gap-2">
					<Users className="w-6 h-6 text-teal-600" />
					Manage Users
				</h1>
				<p className="page-subtext mt-1">
					Monitor and manage all registered users
				</p>
			</div>

			{/* Stats Card */}
			<div className="mb-6">
				<div className="bg-surface rounded-2xl border border-line p-5 inline-flex items-center gap-4">
					<div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
						<Users className="w-5 h-5 text-blue-600" />
					</div>
					<div>
						<p className="text-2xl font-bold text-ink">{totalCount}</p>
						<p className="text-xs text-ink-muted">Total Users</p>
					</div>
				</div>
			</div>

			{/* Search Bar */}
			<div className="mb-4">
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder="Search users by name or email..."
						className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none"
					/>
				</div>
			</div>

			{/* Filter tabs */}
			<FilterTabs tabs={USER_TABS} active={filter} onChange={handleFilterChange} />

			{/* Content */}
			{loading && (
				<div className="py-16">
					<Loader size="lg" text="Loading users..." />
				</div>
			)}

			{!loading && error && <DashboardError message={error} onRetry={() => void fetchUsers()} />}

			{!loading && !error && users.length === 0 && (
				<div className="text-center py-16">
					<Users className="w-12 h-12 text-line mx-auto mb-4" />
					<h3 className="card-heading text-ink mb-1">No users found</h3>
					<p className="text-ink-muted text-sm">No users match the current filter.</p>
				</div>
			)}

			{!loading && !error && users.length > 0 && (
				<>
					<div className="bg-surface rounded-2xl border border-line overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-surface-muted border-b border-line">
									<tr>
										<th className="th-cell">
											User
										</th>
										<th className="th-cell">
											Role
										</th>
										<th className="th-cell">
											Contact
										</th>
										<th className="th-cell">
											Joined
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
									{users.map((u) => {
										const initials = getInitials(u.fullName);
										const roleBadge = ROLE_BADGE[u.role] || ROLE_BADGE.traveller;

										return (
											<tr key={u.id} className="hover:bg-surface-muted">
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														<div
															className={`w-10 h-10 bg-linear-to-br ${getAvatarGradient(initials)} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}
														>
															{initials}
														</div>
														<div>
															<div className="font-semibold text-ink text-sm">
																{u.fullName || '(No name)'}
															</div>
															<div className="text-xs text-ink-muted">ID: {u.id}</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4">
													<span
														className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${roleBadge.bg} ${roleBadge.text}`}
													>
														{u.role}
													</span>
												</td>
												<td className="px-6 py-4 text-sm text-ink-muted">{u.email}</td>
												<td className="px-6 py-4 text-sm text-ink-muted">
													{formatDate(u.createdAt)}
												</td>
												<td className="px-6 py-4">
													<span
														className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
															u.isActive
																? 'bg-green-100 text-green-700'
																: 'bg-red-100 text-red-700'
														}`}
													>
														{u.isActive ? 'Active' : 'Suspended'}
													</span>
												</td>
												<td className="px-6 py-4">
													<button
														type="button"
														onClick={() =>
															void navigate(
																ROUTES.ADMIN_USER_DETAIL.replace(':id', String(u.id)),
															)
														}
														className="text-teal-600 hover:text-teal-700 font-semibold text-sm"
													>
														View
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

export default AdminUsers;
