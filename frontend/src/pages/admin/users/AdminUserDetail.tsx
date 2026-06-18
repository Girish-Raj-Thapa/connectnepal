import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
	Mail,
	Phone,
	MapPin,
	Calendar,
	ShieldCheck,
	ShieldOff,
	Clock,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { AdminUserService } from '@services/admin.service';
import { ROUTES } from '@/constants/routes';
import { formatDate, getInitials } from '@utils/format';
import notification from '@utils/notifications';
import type { AdminUserDetail } from '@/types/admin';

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
	traveller: { bg: 'bg-purple-100', text: 'text-purple-700' },
	host: { bg: 'bg-teal-100', text: 'text-teal-700' },
	admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const AdminUserDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [user, setUser] = useState<AdminUserDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [actionLoading, setActionLoading] = useState(false);
	const [blockReason, setBlockReason] = useState('');
	const [showBlockForm, setShowBlockForm] = useState(false);

	const fetchDetail = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await AdminUserService.getDetail(Number(id));
			setUser(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load user details');
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void fetchDetail();
	}, [fetchDetail]);

	const handleBlock = async () => {
		try {
			setActionLoading(true);
			await AdminUserService.block(Number(id), blockReason ? { reason: blockReason } : undefined);
			notification.success('User blocked successfully');
			setShowBlockForm(false);
			setBlockReason('');
			void fetchDetail();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to block user');
		} finally {
			setActionLoading(false);
		}
	};

	const handleUnblock = async () => {
		try {
			setActionLoading(true);
			await AdminUserService.unblock(Number(id));
			notification.success('User unblocked successfully');
			void fetchDetail();
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to unblock user');
		} finally {
			setActionLoading(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="py-16">
					<Loader size="lg" text="Loading user details..." />
				</div>
			</DashboardLayout>
		);
	}

	if (error || !user) {
		return (
			<DashboardLayout>
				<DashboardError
					message={error || 'User not found'}
					onRetry={() => void fetchDetail()}
				/>
			</DashboardLayout>
		);
	}

	const initials = getInitials(user.fullName);
	const roleBadge = ROLE_BADGE[user.role] || ROLE_BADGE.traveller;

	return (
		<DashboardLayout>
			<div className="max-w-6xl mx-auto">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
					<button
						type="button"
						onClick={() => {
							void navigate(ROUTES.ADMIN_USERS);
						}}
						className="hover:text-teal-600"
					>
						Users
					</button>
					<span>/</span>
					<span className="text-ink font-medium">{user.fullName || `User #${user.id}`}</span>
				</div>

				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<h1 className="page-heading text-ink">User Details</h1>
					<div className="flex items-center gap-2">
						<span
							className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${roleBadge.bg} ${roleBadge.text}`}
						>
							{user.role}
						</span>
						<span
							className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
								user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
							}`}
						>
							{user.isActive ? 'Active' : 'Suspended'}
						</span>
					</div>
				</div>

				<div className="grid lg:grid-cols-2 gap-4 mb-4">
					{/* ═══ LEFT COLUMN ═══ */}
					<div className="space-y-4">
						{/* Profile Card */}
						<div className="bg-surface rounded-xl border border-line p-4">
							<h3 className="card-heading text-ink mb-3">Profile</h3>
							<div className="flex items-start gap-4 mb-4">
								{user.profilePhoto ? (
									<img
										src={user.profilePhoto}
										alt={user.fullName}
										className="w-16 h-16 rounded-xl object-cover"
									/>
								) : (
									<div className="w-16 h-16 bg-linear-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
										{initials}
									</div>
								)}
								<div>
									<h2 className="section-heading text-ink">
										{user.fullName || '(No name)'}
									</h2>
									<p className="text-xs text-ink-muted capitalize">{user.role}</p>
								</div>
							</div>

							<div className="space-y-2 text-sm">
								<div className="flex items-center gap-2 text-ink-muted">
									<Mail className="w-4 h-4 shrink-0" />
									{user.email}
								</div>
								{user.phone && (
									<div className="flex items-center gap-2 text-ink-muted">
										<Phone className="w-4 h-4 shrink-0" />
										{user.phone}
									</div>
								)}
								{user.address && (
									<div className="flex items-center gap-2 text-ink-muted">
										<MapPin className="w-4 h-4 shrink-0" />
										{user.address}
									</div>
								)}
								<div className="flex items-center gap-2 text-ink-muted">
									<Calendar className="w-4 h-4 shrink-0" />
									Joined {formatDate(user.createdAt)}
								</div>
							</div>
						</div>

						{/* Host-specific details */}
						{user.hostDetail && (
							<div className="bg-surface rounded-xl border border-line p-4">
								<h3 className="card-heading text-ink mb-3">Host Details</h3>
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<label className="text-xs text-ink-muted font-semibold">Business Name</label>
										<p className="text-ink font-medium mt-0.5">
											{user.hostDetail.businessName || '\u2014'}
										</p>
									</div>
									<div>
										<label className="text-xs text-ink-muted font-semibold">Verification</label>
										<p className="text-ink font-medium mt-0.5 capitalize">
											{user.hostDetail.verificationStatus.replace('_', ' ')}
										</p>
									</div>
									<div>
										<label className="text-xs text-ink-muted font-semibold">Total Listings</label>
										<p className="text-ink font-medium mt-0.5">
											{user.hostDetail.totalListings}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Traveller-specific details */}
						{user.travellerDetail && (
							<div className="bg-surface rounded-xl border border-line p-4">
								<h3 className="card-heading text-ink mb-3">Traveller Details</h3>
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<label className="text-xs text-ink-muted font-semibold">Budget</label>
										<p className="text-ink font-medium mt-0.5 capitalize">
											{user.travellerDetail.preferredBudget || '\u2014'}
										</p>
									</div>
									<div>
										<label className="text-xs text-ink-muted font-semibold">Travel Style</label>
										<p className="text-ink font-medium mt-0.5 capitalize">
											{user.travellerDetail.travelStyle || '\u2014'}
										</p>
									</div>
									{user.travellerDetail.interests.length > 0 && (
										<div className="col-span-2">
											<label className="text-xs text-ink-muted font-semibold">Interests</label>
											<div className="flex flex-wrap gap-1.5 mt-1">
												{user.travellerDetail.interests.map((interest) => (
													<span
														key={interest}
														className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-medium"
													>
														{interest}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* ═══ RIGHT COLUMN ═══ */}
					<div className="space-y-4">
						{/* Account Actions */}
						<div className="bg-surface rounded-xl border border-line p-4">
							<h3 className="card-heading text-ink mb-3">Account Actions</h3>

							{user.isActive ? (
								<>
									{!showBlockForm ? (
										<button
											type="button"
											onClick={() => setShowBlockForm(true)}
											disabled={user.role === 'admin'}
											className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
										>
											<ShieldOff className="w-4 h-4" />
											Block User
										</button>
									) : (
										<div className="space-y-3">
											<textarea
												value={blockReason}
												onChange={(e) => setBlockReason(e.target.value)}
												placeholder="Reason for blocking (optional)..."
												rows={3}
												className="w-full px-3 py-2 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none"
											/>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => setShowBlockForm(false)}
													className="px-4 py-2 border border-line text-ink-secondary rounded-lg text-sm font-semibold hover:bg-surface-muted"
												>
													Cancel
												</button>
												<button
													type="button"
													onClick={() => void handleBlock()}
													disabled={actionLoading}
													className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
												>
													{actionLoading ? 'Blocking...' : 'Confirm Block'}
												</button>
											</div>
										</div>
									)}
								</>
							) : (
								<button
									type="button"
									onClick={() => void handleUnblock()}
									disabled={actionLoading}
									className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
								>
									<ShieldCheck className="w-4 h-4" />
									{actionLoading ? 'Unblocking...' : 'Unblock User'}
								</button>
							)}

							{user.role === 'admin' && user.isActive && (
								<p className="text-xs text-ink-muted mt-2 text-center">
									Admin accounts cannot be blocked.
								</p>
							)}
						</div>

						{/* Status History */}
						{user.statusLogs.length > 0 && (
							<div className="bg-surface rounded-xl border border-line p-4">
								<h3 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
									<Clock className="w-4 h-4" />
									Status History
								</h3>
								<div className="space-y-3">
									{user.statusLogs.map((log) => (
										<div
											key={log.id}
											className={`p-3 rounded-lg border text-xs ${
												log.action === 'block'
													? 'bg-red-50 border-red-200'
													: 'bg-green-50 border-green-200'
											}`}
										>
											<div className="flex items-center justify-between mb-1">
												<span
													className={`font-bold capitalize ${
														log.action === 'block' ? 'text-red-800' : 'text-green-800'
													}`}
												>
													{log.action === 'block' ? 'Blocked' : 'Unblocked'}
												</span>
												<span className="text-ink-muted">{formatDate(log.createdAt)}</span>
											</div>
											{log.reason && (
												<p className="text-ink-secondary mt-1">Reason: {log.reason}</p>
											)}
											<p className="text-ink-muted mt-0.5">By: {log.performedBy}</p>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Back button */}
				<button
					type="button"
					onClick={() => {
						void navigate(ROUTES.ADMIN_USERS);
					}}
					className="px-5 py-2.5 border-2 border-line text-ink-secondary rounded-lg font-semibold text-sm hover:border-line transition-colors"
				>
					Back to Users
				</button>
			</div>
		</DashboardLayout>
	);
};

export default AdminUserDetail;
