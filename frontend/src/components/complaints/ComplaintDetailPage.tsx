import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import ComplaintStatusBadge from '@components/complaints/ComplaintStatusBadge';
import ComplaintSeverityBadge from '@components/complaints/ComplaintSeverityBadge';
import ComplaintCategoryBadge from '@components/complaints/ComplaintCategoryBadge';
import EvidenceUploader from '@components/complaints/EvidenceUploader';
import EvidenceGallery from '@components/complaints/EvidenceGallery';
import ComplaintTimeline from '@components/complaints/ComplaintTimeline';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import { formatDate } from '@utils/format';
import type { ComplaintDetail, ComplaintEvidence } from '@/types/complaints';

const TERMINAL_STATUSES = ['resolved', 'rejected', 'closed'];

interface Props {
    getDetail: (id: number) => Promise<ComplaintDetail>;
    uploadEvidence: (id: number, file: File, description?: string) => Promise<ComplaintEvidence>;
    typographyVariant?: 'default' | 'traveller';
}

const ComplaintDetailPage = ({
    getDetail,
    uploadEvidence,
    typographyVariant = 'default',
}: Props) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isTravellerTypography = typographyVariant === 'traveller';

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getDetail(Number(id));
            setComplaint(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load complaint');
        } finally {
            setLoading(false);
        }
    }, [id, getDetail]);

    useEffect(() => {
        void fetchDetail();
    }, [fetchDetail]);

    const handleUploadEvidence = async (file: File, description?: string) => {
        await uploadEvidence(Number(id), file, description);
        await fetchDetail();
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="py-16"><Loader size="lg" text="Loading complaint..." /></div>
            </DashboardLayout>
        );
    }

    if (error || !complaint) {
        return (
            <DashboardLayout>
                <DashboardError message={error || 'Complaint not found'} onRetry={() => void fetchDetail()} />
            </DashboardLayout>
        );
    }

    const isTerminal = TERMINAL_STATUSES.includes(complaint.status);
    const targetLabel = complaint.listingTitle
        ? `Listing: ${complaint.listingTitle}`
        : complaint.packageTitle
          ? `Package: ${complaint.packageTitle}`
          : '—';

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => { void navigate(-1); }}
                    className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-teal-600 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Complaints
                </button>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                        <h1 className={isTravellerTypography ? 'page-heading text-ink flex items-center gap-2' : 'text-xl font-bold text-ink flex items-center gap-2'}>
                            <AlertTriangle className="w-5 h-5 text-teal-600" />
                            {complaint.title}
                        </h1>
                        <p className={isTravellerTypography ? 'page-subtext mt-0.5' : 'text-sm text-ink-muted mt-0.5'}>
                            Complaint #{complaint.id} &middot; Filed {formatDate(complaint.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ComplaintSeverityBadge severity={complaint.severity} />
                        <ComplaintStatusBadge status={complaint.status} />
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-4">
                        <div className="bg-surface rounded-xl border border-line p-5">
                            <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Complaint Details</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Category</label>
                                    <div className="mt-1"><ComplaintCategoryBadge category={complaint.category} /></div>
                                </div>
                                <div>
                                    <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Related Booking</label>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className={isTravellerTypography ? 'reference-code' : 'text-teal-600 font-bold text-sm'}>
                                            #{complaint.bookingReference}
                                        </span>
                                        <span className="text-sm text-ink-muted">{targetLabel}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Description</label>
                                    <p className="text-ink-secondary mt-1 leading-relaxed text-sm">{complaint.description}</p>
                                </div>
                                {complaint.requiresEvidence && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                        This complaint category requires evidence.{' '}
                                        {complaint.complainantEvidenceSubmitted
                                            ? 'Evidence has been submitted.'
                                            : 'Please upload supporting evidence below.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {complaint.outcome && (
                            <div className="bg-surface rounded-xl border border-line p-5">
                                <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Resolution</h3>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Outcome</label>
                                        <p className="text-ink font-semibold mt-0.5 capitalize">
                                            {complaint.outcome.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                    {complaint.resolutionNote && (
                                        <div>
                                            <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Resolution Note</label>
                                            <p className="text-ink-secondary mt-0.5">{complaint.resolutionNote}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {complaint.response?.isVisibleToComplainant && (
                            <div className="bg-surface rounded-xl border border-line p-5">
                                <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Respondent's Response</h3>
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-purple-900">
                                            {complaint.response.respondentName}
                                        </span>
                                        <span className="text-xs text-purple-600">
                                            {formatDate(complaint.response.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-purple-900 leading-relaxed">
                                        {complaint.response.body}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                        <div className="bg-surface rounded-xl border border-line p-5">
                            <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>
                                Evidence ({complaint.evidences.length})
                            </h3>
                            <EvidenceGallery evidences={complaint.evidences} />
                        </div>

                        {!isTerminal && <EvidenceUploader onUpload={handleUploadEvidence} />}

                        <div className="bg-surface rounded-xl border border-line p-5">
                            <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Timeline</h3>
                            <ComplaintTimeline events={complaint.events} />
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ComplaintDetailPage;
