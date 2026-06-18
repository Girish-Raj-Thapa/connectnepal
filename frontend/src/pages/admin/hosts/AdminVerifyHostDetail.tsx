import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
	FileText,
	Mail,
	Building2,
	ExternalLink,
	CheckCircle,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { useConfirm } from '@context/ConfirmContext';
import { AdminHostService } from '@services/admin.service';
import { ROUTES } from '@/constants/routes';
import { formatDate, getInitials } from '@utils/format';
import notification from '@utils/notifications';
import type { AdminHostDetail } from '@/types/admin';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
	citizenship: 'Citizenship Document',
	pan: 'PAN Card',
	business_license: 'Business License',
};

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
	citizenship: 'bg-blue-100 text-blue-600',
	pan: 'bg-purple-100 text-purple-600',
	business_license: 'bg-green-100 text-green-600',
};

const AdminVerifyHostDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [host, setHost] = useState<AdminHostDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [actionLoading, setActionLoading] = useState(false);
	const [rejectRemarks, setRejectRemarks] = useState('');
	const [showRejectForm, setShowRejectForm] = useState(false);
	const confirm = useConfirm();

	const fetchDetail = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await AdminHostService.getDetail(Number(id));
			setHost(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load host details');
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void fetchDetail();
	}, [fetchDetail]);

	const handleApprove = async () => {
		const confirmed = await confirm({
			title: 'Approve Host',
			message: <>Are you sure you want to approve and verify <span className="font-semibold">{host?.fullName}</span>? They will be able to publish listings immediately.</>,
			confirmLabel: 'Approve & Verify',
			variant: 'primary',
		});
		if (!confirmed) return;
		try {
			setActionLoading(true);
			await AdminHostService.approve(Number(id));
			notification.success('Host approved successfully');
			void navigate(ROUTES.ADMIN_VERIFY_HOSTS);
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to approve host');
		} finally {
			setActionLoading(false);
		}
	};

	const handleReject = async () => {
		if (rejectRemarks.length < 10) {
			notification.error('Rejection remarks must be at least 10 characters');
			return;
		}
		try {
			setActionLoading(true);
			await AdminHostService.reject(Number(id), { remarks: rejectRemarks });
			notification.success('Host rejected');
			void navigate(ROUTES.ADMIN_VERIFY_HOSTS);
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to reject host');
		} finally {
			setActionLoading(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="py-16">
					<Loader size="lg" text="Loading host details..." />
				</div>
			</DashboardLayout>
		);
	}

	if (error || !host) {
		return (
			<DashboardLayout>
				<DashboardError
					message={error || 'Host not found'}
					onRetry={() => void fetchDetail()}
				/>
			</DashboardLayout>
		);
	}

	const initials = getInitials(host.fullName);
	const isPending = host.verificationStatus === 'pending';

	return (
		<DashboardLayout>
			<div className="max-w-6xl mx-auto">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
					<button
						type="button"
						onClick={() => {
							void navigate(ROUTES.ADMIN_VERIFY_HOSTS);
						}}
						className="hover:text-teal-600"
					>
						Verify Hosts
					</button>
					<span>/</span>
					<span className="text-ink font-medium">Verification Review</span>
				</div>

				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="page-heading text-ink">Host Application Review</h1>
						<p className="page-subtext">Review host documents and verify</p>
					</div>
					<span
						className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${
							host.verificationStatus === 'approved'
								? 'bg-green-100 text-green-700'
								: host.verificationStatus === 'rejected'
									? 'bg-red-100 text-red-700'
									: 'bg-yellow-100 text-yellow-700'
						}`}
					>
						{host.verificationStatus === 'approved'
							? 'Verified'
							: host.verificationStatus === 'rejected'
								? 'Rejected'
								: 'Pending'}
					</span>
				</div>

				<div className="grid lg:grid-cols-2 gap-4 mb-4">
					{/* ═══ LEFT COLUMN ═══ */}
					<div className="space-y-4">
						{/* Host Profile */}
						<div className="bg-surface rounded-xl border border-line p-4">
							<h3 className="card-heading text-ink mb-3">Host Profile</h3>
							<div className="flex items-start gap-4">
								<div className="w-16 h-16 bg-linear-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
									{initials}
								</div>
								<div className="space-y-2">
									<h2 className="section-heading text-ink">{host.fullName}</h2>
									<div className="flex items-center gap-2 text-sm text-ink-muted">
										<Mail className="w-4 h-4" />
										{host.email}
									</div>
								</div>
							</div>
						</div>

						{/* Business Information */}
						<div className="bg-surface rounded-xl border border-line p-4">
							<h3 className="card-heading text-ink mb-3 flex items-center gap-2">
								<Building2 className="w-4 h-4" />
								Business Information
							</h3>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<label className="text-xs text-ink-muted font-semibold">Business Name</label>
									<p className="text-ink font-medium mt-0.5">
										{host.businessName || '\u2014'}
									</p>
								</div>
								<div>
									<label className="text-xs text-ink-muted font-semibold">Documents</label>
									<p className="text-ink font-medium mt-0.5">
										{host.documentCount} uploaded
									</p>
								</div>
								{host.verifiedAt && (
									<div>
										<label className="text-xs text-ink-muted font-semibold">Verified On</label>
										<p className="text-ink font-medium mt-0.5">
											{formatDate(host.verifiedAt)}
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Rejection remarks (if rejected) */}
						{host.verificationStatus === 'rejected' && host.verificationRemarks && (
							<div className="bg-red-50 border border-red-200 rounded-xl p-4">
								<h3 className="card-heading text-red-800 mb-2">Rejection Remarks</h3>
								<p className="text-sm text-red-700">{host.verificationRemarks}</p>
							</div>
						)}
					</div>

					{/* ═══ RIGHT COLUMN ═══ */}
					<div className="space-y-4">
						{/* Uploaded Documents */}
						<div className="bg-surface rounded-xl border border-line p-4">
							<h3 className="card-heading text-ink mb-3 flex items-center gap-2">
								<FileText className="w-4 h-4" />
								Uploaded Documents ({host.documents.length})
							</h3>

							{host.documents.length === 0 ? (
								<p className="text-sm text-ink-muted">No documents uploaded yet.</p>
							) : (
								<div className="space-y-3">
									{host.documents.map((doc) => {
										const typeLabel =
											DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
										const typeColor =
											DOCUMENT_TYPE_COLORS[doc.documentType] || 'bg-surface-muted text-ink-muted';

										return (
											<div
												key={doc.id}
												className="flex items-center justify-between p-3 bg-surface-muted rounded-lg border border-line"
											>
												<div className="flex items-center gap-3">
													<div
														className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColor}`}
													>
														<FileText className="w-5 h-5" />
													</div>
													<div>
														<p className="text-sm font-semibold text-ink">{typeLabel}</p>
														<p className="text-xs text-ink-muted">
															Uploaded {formatDate(doc.uploadedAt)}
														</p>
													</div>
												</div>
												<a
													href={doc.filePath}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold text-sm"
												>
													View <ExternalLink className="w-3.5 h-3.5" />
												</a>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Reject Form (toggle) */}
						{isPending && showRejectForm && (
							<div className="bg-surface rounded-xl border border-line p-4">
								<h3 className="text-base font-bold text-ink mb-3">Rejection Remarks</h3>
								<textarea
									value={rejectRemarks}
									onChange={(e) => setRejectRemarks(e.target.value)}
									placeholder="Provide reason for rejection (min 10 characters)..."
									rows={4}
									className="w-full px-3 py-2 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none mb-3"
								/>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setShowRejectForm(false)}
										className="px-4 py-2 border border-line text-ink-secondary rounded-lg text-sm font-semibold hover:bg-surface-muted"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={() => void handleReject()}
										disabled={actionLoading || rejectRemarks.length < 10}
										className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
									>
										{actionLoading ? 'Rejecting...' : 'Confirm Reject'}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => {
							void navigate(ROUTES.ADMIN_VERIFY_HOSTS);
						}}
						className="px-5 py-2.5 border-2 border-line text-ink-secondary rounded-lg font-semibold text-sm hover:border-line transition-colors"
					>
						Back
					</button>

					{isPending && (
						<>
							<button
								type="button"
								onClick={() => setShowRejectForm(true)}
								disabled={actionLoading}
								className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors"
							>
								Reject
							</button>
							<button
								type="button"
								onClick={() => { void handleApprove(); }}
								disabled={actionLoading}
								className="flex-1 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
							>
								<CheckCircle className="w-4 h-4" />
								{actionLoading ? 'Approving...' : 'Approve & Verify Host'}
							</button>
						</>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
};

export default AdminVerifyHostDetail;
