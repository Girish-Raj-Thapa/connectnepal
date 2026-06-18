import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Inbox } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import FilterTabs from '@components/common/FilterTabs';
import Pagination from '@components/common/Pagination';
import ComplaintStatusBadge from '@components/complaints/ComplaintStatusBadge';
import ComplaintSeverityBadge from '@components/complaints/ComplaintSeverityBadge';
import ComplaintCategoryBadge from '@components/complaints/ComplaintCategoryBadge';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { useComplaints } from '@/hooks/useComplaints';
import { timeAgo } from '@utils/format';
import type { ComplaintStatus, ComplaintFilterParams, PaginatedComplaints } from '@/types/complaints';

type ViewTab = 'filed' | 'received';
type StatusFilter = 'all' | ComplaintStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

interface Props {
    filedService: (params: ComplaintFilterParams) => Promise<PaginatedComplaints>;
    receivedService: (params: ComplaintFilterParams) => Promise<PaginatedComplaints>;
    filedDetailRoute: string;
    receivedDetailRoute: string;
    typographyVariant?: 'default' | 'traveller';
}

const ComplaintListPage = ({
    filedService,
    receivedService,
    filedDetailRoute,
    receivedDetailRoute,
    typographyVariant = 'default',
}: Props) => {
    const navigate = useNavigate();
    const [viewTab, setViewTab] = useState<ViewTab>('filed');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const isTravellerTypography = typographyVariant === 'traveller';

    const fetchFiled = useCallback(
        (params: ComplaintFilterParams) =>
            filedService({
                ...params,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            }),
        [filedService, statusFilter],
    );

    const fetchReceived = useCallback(
        (params: ComplaintFilterParams) =>
            receivedService({
                ...params,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            }),
        [receivedService, statusFilter],
    );

    const filed = useComplaints({ fetchFn: fetchFiled });
    const received = useComplaints({ fetchFn: fetchReceived });

    const current = viewTab === 'filed' ? filed : received;

    const handleRowClick = (id: number) => {
        const route = viewTab === 'filed' ? filedDetailRoute : receivedDetailRoute;
        void navigate(route.replace(':id', String(id)));
    };

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className={isTravellerTypography ? 'page-heading text-ink flex items-center gap-2' : 'text-2xl font-bold text-ink flex items-center gap-2'}>
                        <AlertTriangle className="w-6 h-6 text-teal-600" />
                        Complaints
                    </h1>
                    <p className={isTravellerTypography ? 'page-subtext mt-1' : 'text-ink-muted text-sm mt-1'}>
                        File complaints or view complaints filed against you
                    </p>
                </div>
            </div>

            {/* Filed vs Received toggle */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setViewTab('filed')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        viewTab === 'filed'
                            ? 'bg-teal-600 text-white shadow'
                            : 'bg-surface border border-line text-ink-muted hover:border-teal-400'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                    Filed by Me
                </button>
                <button
                    onClick={() => setViewTab('received')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        viewTab === 'received'
                            ? 'bg-teal-600 text-white shadow'
                            : 'bg-surface border border-line text-ink-muted hover:border-teal-400'
                    }`}
                >
                    <Inbox className="w-4 h-4 inline mr-1.5" />
                    Filed Against Me
                </button>
            </div>

            {/* Status filter tabs */}
            <FilterTabs tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />

            {/* Content */}
            {current.loading && (
                <div className="py-16">
                    <Loader size="lg" text="Loading complaints..." />
                </div>
            )}

            {!current.loading && current.error && (
                <DashboardError message={current.error} onRetry={current.refetch} />
            )}

            {!current.loading && !current.error && current.complaints.length === 0 && (
                <div className="text-center py-16">
                    <AlertTriangle className="w-12 h-12 text-line mx-auto mb-4" />
                    <h3 className={isTravellerTypography ? 'card-heading text-ink mb-1' : 'text-lg font-semibold text-ink mb-1'}>No complaints found</h3>
                    <p className="text-ink-muted text-sm">
                        {viewTab === 'filed'
                            ? 'You have not filed any complaints yet.'
                            : 'No complaints have been filed against you.'}
                    </p>
                </div>
            )}

            {!current.loading && !current.error && current.complaints.length > 0 && (
                <>
                    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-surface-muted border-b border-line">
                                    <tr>
                                        <th className="th-cell">Subject</th>
                                        <th className="th-cell">Category</th>
                                        <th className="th-cell">Severity</th>
                                        <th className="th-cell">Status</th>
                                        <th className="th-cell">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {current.complaints.map((c) => (
                                        <tr
                                            key={c.id}
                                            onClick={() => handleRowClick(c.id)}
                                            className="hover:bg-surface-muted cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="max-w-xs">
                                                    <p className="text-sm font-medium text-ink truncate">{c.title}</p>
                                                    <p className="text-xs text-ink-muted truncate">{c.targetLabel}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <ComplaintCategoryBadge category={c.category} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <ComplaintSeverityBadge severity={c.severity} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <ComplaintStatusBadge status={c.status} />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-ink-muted">
                                                {timeAgo(c.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="mt-6">
                        <Pagination
                            currentPage={current.page}
                            totalCount={current.totalCount}
                            onPageChange={current.setPage}
                        />
                    </div>
                </>
            )}
        </DashboardLayout>
    );
};

export default ComplaintListPage;
