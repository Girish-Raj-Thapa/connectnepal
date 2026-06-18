import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { ArrowLeft, AlertTriangle, Send } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import ComplaintStatusBadge from '@components/complaints/ComplaintStatusBadge';
import ComplaintSeverityBadge from '@components/complaints/ComplaintSeverityBadge';
import ComplaintCategoryBadge from '@components/complaints/ComplaintCategoryBadge';
import EvidenceUploader from '@components/complaints/EvidenceUploader';
import EvidenceGallery from '@components/complaints/EvidenceGallery';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import { respondToComplaintSchema, type RespondFormData } from '@utils/validators/complaints';
import { formatDate } from '@utils/format';
import notification from '@utils/notifications';
import type {
    ReceivedComplaintDetail,
    ComplaintResponse,
    ComplaintEvidence,
    RespondToComplaintPayload,
} from '@/types/complaints';

interface Props {
    getReceivedDetail: (id: number) => Promise<ReceivedComplaintDetail>;
    respond: (id: number, payload: RespondToComplaintPayload) => Promise<ComplaintResponse>;
    uploadReceivedEvidence: (id: number, file: File, description?: string) => Promise<ComplaintEvidence>;
    typographyVariant?: 'default' | 'traveller';
}

const ReceivedComplaintPage = ({
    getReceivedDetail,
    respond,
    uploadReceivedEvidence,
    typographyVariant = 'default',
}: Props) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState<ReceivedComplaintDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [respondError, setRespondError] = useState('');
    const [responding, setResponding] = useState(false);
    const isTravellerTypography = typographyVariant === 'traveller';

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<RespondFormData>({
        resolver: yupResolver(respondToComplaintSchema),
    });

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getReceivedDetail(Number(id));
            setComplaint(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load complaint');
        } finally {
            setLoading(false);
        }
    }, [id, getReceivedDetail]);

    useEffect(() => {
        void fetchDetail();
    }, [fetchDetail]);

    const onSubmitResponse = async (data: RespondFormData) => {
        try {
            setRespondError('');
            setResponding(true);
            await respond(Number(id), { body: data.body });
            notification.success('Response submitted successfully');
            reset();
            await fetchDetail();
        } catch (err) {
            setRespondError(err instanceof Error ? err.message : 'Failed to submit response');
        } finally {
            setResponding(false);
        }
    };

    const handleUploadEvidence = async (file: File, description?: string) => {
        await uploadReceivedEvidence(Number(id), file, description);
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

    const isTerminal = ['resolved', 'rejected', 'closed'].includes(complaint.status);
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
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            Complaint Against You
                        </h1>
                        <p className={isTravellerTypography ? 'page-subtext mt-0.5' : 'text-sm text-ink-muted mt-0.5'}>
                            Filed by {complaint.filerName} &middot;{' '}
                            {formatDate(complaint.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ComplaintSeverityBadge severity={complaint.severity} />
                        <ComplaintStatusBadge status={complaint.status} />
                    </div>
                </div>

                {complaint.isSensitive && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
                        <strong>Sensitive Complaint:</strong> The description shown below is a
                        summary provided by the admin team. Some details may be redacted for
                        privacy reasons.
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-4">
                        <div className="bg-surface rounded-xl border border-line p-5">
                            <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Complaint Details</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Subject</label>
                                    <p className="text-ink font-semibold mt-0.5">{complaint.title}</p>
                                </div>
                                <div>
                                    <label className={isTravellerTypography ? 'meta-text' : 'text-ink-muted font-semibold text-xs'}>Category</label>
                                    <div className="mt-1">
                                        <ComplaintCategoryBadge category={complaint.category} />
                                    </div>
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
                                    <p className="text-ink-secondary mt-1 leading-relaxed">
                                        {complaint.descriptionOrSummary}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {complaint.outcome && (
                            <div className="bg-surface rounded-xl border border-line p-5">
                                <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Resolution</h3>
                                <p className="text-ink font-semibold capitalize text-sm">
                                    {complaint.outcome.replace(/_/g, ' ')}
                                </p>
                                {complaint.resolutionNote && (
                                    <p className="text-ink-secondary text-sm mt-2">{complaint.resolutionNote}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                        {complaint.canRespond && (
                            <div className="bg-surface rounded-xl border border-line p-5">
                                <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Submit Your Response</h3>
                                <p className="text-xs text-ink-muted mb-3">
                                    Provide your side of the story. You can only respond once.
                                </p>

                                {respondError && (
                                    <div className="mb-3">
                                        <FormErrorBanner>{respondError}</FormErrorBanner>
                                    </div>
                                )}

                                <form onSubmit={(e) => void handleSubmit(onSubmitResponse)(e)}>
                                    <textarea
                                        {...register('body')}
                                        rows={5}
                                        placeholder="Write your response here (min 20 characters)..."
                                        className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none resize-none ${
                                            errors.body
                                                ? 'border-red-500'
                                                : 'border-line focus:border-teal-600'
                                        }`}
                                    />
                                    {errors.body && (
                                        <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={responding}
                                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                        {responding ? 'Submitting...' : 'Submit Response'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {complaint.response && (
                            <div className="bg-surface rounded-xl border border-line p-5">
                                <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Your Response</h3>
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-900 leading-relaxed">
                                        {complaint.response.body}
                                    </p>
                                    <p className="text-xs text-green-600 mt-2">
                                        Submitted {formatDate(complaint.response.createdAt)}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="bg-surface rounded-xl border border-line p-5">
                            <h3 className={isTravellerTypography ? 'card-heading text-ink mb-3' : 'text-base font-bold text-ink mb-3'}>Evidence</h3>
                            <EvidenceGallery evidences={complaint.evidences} />
                        </div>

                        {!isTerminal && <EvidenceUploader onUpload={handleUploadEvidence} />}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ReceivedComplaintPage;
