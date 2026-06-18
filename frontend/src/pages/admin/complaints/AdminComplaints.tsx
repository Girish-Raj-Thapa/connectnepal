import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import FilterTabs from '@components/common/FilterTabs';
import Pagination from '@components/common/Pagination';
import ComplaintStatsCards from '@components/complaints/ComplaintStatsCards';
import ComplaintStatusBadge from '@components/complaints/ComplaintStatusBadge';
import ComplaintSeverityBadge from '@components/complaints/ComplaintSeverityBadge';
import ComplaintCategoryBadge from '@components/complaints/ComplaintCategoryBadge';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { AdminComplaintService } from '@services/complaints.service';
import { useComplaints } from '@/hooks/useComplaints';
import { ROUTES } from '@/constants/routes';
import { timeAgo, getInitials } from '@utils/format';
import { getAvatarGradient } from '@utils/avatar';
import type { ComplaintStatus, ComplaintSeverity, ComplaintFilterParams } from '@/types/complaints';

type AdminFilter = 'all' | 'urgent' | 'open' | 'in_progress' | 'resolved';

const ADMIN_TABS: { value: AdminFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
];

/** Map admin UI filter to API params. */
const filterToParams = (
    filter: AdminFilter,
): { status?: ComplaintStatus; severity?: ComplaintSeverity } => {
    switch (filter) {
        case 'urgent':
            return { severity: 'critical' };
        case 'open':
            return { status: 'submitted' };
        case 'in_progress':
            return { status: 'under_review' };
        case 'resolved':
            return { status: 'resolved' };
        default:
            return {};
    }
};


const AdminComplaints = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState<AdminFilter>('all');

    const fetchFn = useCallback(
        (params: ComplaintFilterParams) =>
            AdminComplaintService.list({ ...params, ...filterToParams(filter) }),
        [filter],
    );

    const { complaints, totalCount, page, loading, error, setPage, refetch } =
        useComplaints({ fetchFn });

    // Compute stats from current page
    const stats = useMemo(() => ({
        urgent: complaints.filter((c) => c.severity === 'critical' || c.severity === 'high').length,
        open: complaints.filter((c) => c.status === 'submitted' || c.status === 'triaged').length,
        inProgress: complaints.filter(
            (c) =>
                c.status === 'under_review' ||
                c.status === 'awaiting_respondent' ||
                c.status === 'escalated',
        ).length,
        resolved: complaints.filter((c) => c.status === 'resolved').length,
    }), [complaints]);

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="mb-6">
                <h1 className="page-heading text-ink flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-teal-600" />
                    Manage Complaints
                </h1>
                <p className="page-subtext mt-1">Review and resolve user complaints</p>
            </div>

            {/* Stat cards */}
            <ComplaintStatsCards stats={stats} />

            {/* Filter tabs */}
            <FilterTabs tabs={ADMIN_TABS} active={filter} onChange={setFilter} />

            {/* Content */}
            {loading && (
                <div className="py-16">
                    <Loader size="lg" text="Loading complaints..." />
                </div>
            )}

            {!loading && error && (
                <DashboardError message={error} onRetry={refetch} />
            )}

            {!loading && !error && complaints.length === 0 && (
                <div className="text-center py-16">
                    <AlertTriangle className="w-12 h-12 text-line mx-auto mb-4" />
                    <h3 className="card-heading text-ink mb-1">No complaints found</h3>
                    <p className="text-ink-muted text-sm">No complaints match the current filter.</p>
                </div>
            )}

            {!loading && !error && complaints.length > 0 && (
                <>
                    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-surface-muted border-b border-line">
                                    <tr>
                                        <th className="th-cell">User</th>
                                        <th className="th-cell">Type</th>
                                        <th className="th-cell">Subject</th>
                                        <th className="th-cell">Date</th>
                                        <th className="th-cell">Priority</th>
                                        <th className="th-cell">Status</th>
                                        <th className="th-cell">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {complaints.map((c) => {
                                        const initials = getInitials(c.filerName);
                                        const isResolved =
                                            c.status === 'resolved' ||
                                            c.status === 'rejected' ||
                                            c.status === 'closed';

                                        return (
                                            <tr
                                                key={c.id}
                                                className={`hover:bg-surface-muted ${isResolved ? 'opacity-60' : ''}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-10 h-10 bg-linear-to-br ${getAvatarGradient(initials)} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}
                                                        >
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-ink text-sm">
                                                                {c.filerName}
                                                            </div>
                                                            <div className="text-xs text-ink-muted capitalize">
                                                                {c.filedByRole}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <ComplaintCategoryBadge category={c.category} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-xs">
                                                        <p className="text-sm text-ink font-medium truncate">
                                                            {c.title}
                                                        </p>
                                                        <p className="text-xs text-ink-muted truncate">
                                                            {c.targetLabel}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-ink-muted">
                                                    {timeAgo(c.createdAt)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <ComplaintSeverityBadge severity={c.severity} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <ComplaintStatusBadge status={c.status} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void navigate(
                                                                ROUTES.ADMIN_COMPLAINT_DETAIL.replace(
                                                                    ':id',
                                                                    String(c.id),
                                                                ),
                                                            )
                                                        }
                                                        className="text-teal-600 hover:text-teal-700 font-semibold text-sm"
                                                    >
                                                        View Details
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

export default AdminComplaints;
