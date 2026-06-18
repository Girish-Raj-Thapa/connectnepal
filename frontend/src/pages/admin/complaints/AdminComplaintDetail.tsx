import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { AlertTriangle, Shield, Scale } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import ComplaintStatusBadge from '@components/complaints/ComplaintStatusBadge';
import ComplaintSeverityBadge from '@components/complaints/ComplaintSeverityBadge';
import ComplaintCategoryBadge from '@components/complaints/ComplaintCategoryBadge';
import EvidenceGallery from '@components/complaints/EvidenceGallery';
import ComplaintTimeline from '@components/complaints/ComplaintTimeline';
import Loader from '@components/feedback/Loader';
import DashboardError from '@components/dashboard/DashboardError';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import { AdminComplaintService } from '@services/complaints.service';
import { recordOutcomeSchema, type RecordOutcomeFormData } from '@utils/validators/complaints';
import { ROUTES } from '@/constants/routes';
import { formatDate, getInitials } from '@utils/format';
import notification from '@utils/notifications';
import type { AdminComplaintDetail, ModerationAction, ComplaintSeverity } from '@/types/complaints';
import { OUTCOME_OPTIONS, SEVERITY_LABELS } from '@/types/complaints';

const AdminComplaintDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState<AdminComplaintDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Moderation form state
    const [moderateNote, setModerateNote] = useState('');
    const [summaryForRespondent, setSummaryForRespondent] = useState('');

    // Severity override state
    const [newSeverity, setNewSeverity] = useState<ComplaintSeverity | ''>('');
    const [severityReason, setSeverityReason] = useState('');

    // Outcome form
    const outcomeForm = useForm<RecordOutcomeFormData>({
        resolver: yupResolver(recordOutcomeSchema),
    });

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await AdminComplaintService.getDetail(Number(id));
            setComplaint(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load complaint');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void fetchDetail();
    }, [fetchDetail]);

    // ── Moderation action handler ──
    const handleModerate = async (action: ModerationAction) => {
        try {
            setActionLoading(true);
            const payload: Parameters<typeof AdminComplaintService.moderate>[1] = { action };
            if (moderateNote) payload.note = moderateNote;
            if (action === 'send_to_respondent' && summaryForRespondent) {
                payload.summaryForRespondent = summaryForRespondent;
            }
            const updated = await AdminComplaintService.moderate(Number(id), payload);
            setComplaint(updated);
            setModerateNote('');
            setSummaryForRespondent('');
            notification.success(`Action "${formatActionLabel(action)}" applied successfully`);
        } catch (err) {
            notification.error(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Severity override handler ──
    const handleSeverityOverride = async () => {
        if (!newSeverity || !severityReason) return;
        try {
            setActionLoading(true);
            const updated = await AdminComplaintService.overrideSeverity(Number(id), {
                severity: newSeverity,
                reason: severityReason,
            });
            setComplaint(updated);
            setNewSeverity('');
            setSeverityReason('');
            notification.success('Severity updated');
        } catch (err) {
            notification.error(err instanceof Error ? err.message : 'Failed to update severity');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Outcome handler ──
    const handleRecordOutcome = async (data: RecordOutcomeFormData) => {
        try {
            setActionLoading(true);
            const updated = await AdminComplaintService.recordOutcome(Number(id), {
                outcome: data.outcome as import('@/types/complaints').ComplaintOutcome,
                resolutionNote: data.resolutionNote,
                protectiveAction: data.protectiveAction || undefined,
            });
            setComplaint(updated);
            outcomeForm.reset();
            notification.success('Outcome recorded');
        } catch (err) {
            notification.error(err instanceof Error ? err.message : 'Failed to record outcome');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="py-16">
                    <Loader size="lg" text="Loading complaint..." />
                </div>
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

    const initials = getInitials(complaint.filerName);
    const isTerminal = ['resolved', 'rejected', 'closed'].includes(complaint.status);
    const targetLabel = complaint.listingTitle
        ? `Listing: ${complaint.listingTitle}`
        : complaint.packageTitle
          ? `Package: ${complaint.packageTitle}`
          : '—';
    const availableActions = getAvailableActions(complaint.status);

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
                    <button
                        type="button"
                        onClick={() => { void navigate(ROUTES.ADMIN_COMPLAINTS); }}
                        className="hover:text-teal-600"
                    >
                        Complaints
                    </button>
                    <span>/</span>
                    <span className="text-ink font-medium">Complaint #{complaint.id}</span>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="page-heading text-ink">
                            Complaint #{complaint.id}
                        </h1>
                        <p className="page-subtext">Review and resolve complaint</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ComplaintSeverityBadge severity={complaint.severity} />
                        <ComplaintStatusBadge status={complaint.status} />
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-4 mb-4">
                    {/* ═══ LEFT COLUMN ═══ */}
                    <div className="space-y-4">
                        {/* Complainant Info */}
                        <div className="bg-surface rounded-xl border border-line p-4">
                            <h3 className="card-heading text-ink mb-3">
                                Complainant Information
                            </h3>
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-linear-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                                    {initials}
                                </div>
                                <div>
                                    <h2 className="section-heading text-ink">
                                        {complaint.filerName}
                                    </h2>
                                    <p className="text-xs text-ink-muted capitalize">
                                        {complaint.filedByRole}
                                    </p>
                                </div>
                            </div>
                            {complaint.respondentName && (
                                <div className="mt-3 pt-3 border-t border-line text-xs">
                                    <span className="text-ink-muted font-semibold">Respondent: </span>
                                    <span className="text-ink font-bold">
                                        {complaint.respondentName}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Complaint Details */}
                        <div className="bg-surface rounded-xl border border-line p-4">
                            <h3 className="card-heading text-ink mb-3">
                                Complaint Details
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="text-ink-muted font-semibold">Subject</label>
                                    <p className="text-ink mt-0.5 font-semibold">{complaint.title}</p>
                                </div>
                                <div>
                                    <label className="text-ink-muted font-semibold">Type</label>
                                    <div className="mt-1">
                                        <ComplaintCategoryBadge category={complaint.category} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-ink-muted font-semibold">Related Booking</label>
                                    <p className="text-teal-600 mt-0.5 font-bold">
                                        #{complaint.bookingReference} — {targetLabel}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-ink-muted font-semibold">Date Submitted</label>
                                    <p className="text-ink mt-0.5">{formatDate(complaint.createdAt)}</p>
                                </div>
                                <div>
                                    <label className="text-ink-muted font-semibold">Description</label>
                                    <p className="text-ink-secondary mt-1 leading-relaxed text-sm">
                                        {complaint.description}
                                    </p>
                                </div>
                                {complaint.isSensitive && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-700">
                                        <strong>Sensitive complaint</strong> — raw description hidden from respondent.
                                        {complaint.adminSummaryForRespondent && (
                                            <p className="mt-1">
                                                Summary sent: "{complaint.adminSummaryForRespondent}"
                                            </p>
                                        )}
                                    </div>
                                )}
                                {complaint.requiresEvidence && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-700">
                                        Evidence required:{' '}
                                        {complaint.complainantEvidenceSubmitted
                                            ? 'Submitted'
                                            : 'NOT yet submitted'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Severity Override */}
                        {!isTerminal && (
                            <div className="bg-surface rounded-xl border border-line p-4">
                                <h3 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Override Severity
                                </h3>
                                <div className="space-y-3">
                                    <select
                                        title="Override severity"
                                        value={newSeverity}
                                        onChange={(e) =>
                                            setNewSeverity(e.target.value as ComplaintSeverity)
                                        }
                                        className="w-full px-3 py-2 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none"
                                    >
                                        <option value="">
                                            Current: {SEVERITY_LABELS[complaint.severity]}
                                        </option>
                                        {(['low', 'medium', 'high', 'critical'] as const)
                                            .filter((s) => s !== complaint.severity)
                                            .map((s) => (
                                                <option key={s} value={s}>
                                                    {SEVERITY_LABELS[s]}
                                                </option>
                                            ))}
                                    </select>
                                    {newSeverity && (
                                        <>
                                            <textarea
                                                value={severityReason}
                                                onChange={(e) => setSeverityReason(e.target.value)}
                                                placeholder="Reason for override..."
                                                rows={2}
                                                className="w-full px-3 py-2 text-xs border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleSeverityOverride()}
                                                disabled={actionLoading || !severityReason}
                                                className="w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors"
                                            >
                                                Update Severity
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Moderation Actions */}
                        {!isTerminal && availableActions.length > 0 && (
                            <div className="bg-surface rounded-xl border border-line p-4">
                                <h3 className="text-base font-bold text-ink mb-3">
                                    Moderation Actions
                                </h3>
                                <textarea
                                    value={moderateNote}
                                    onChange={(e) => setModerateNote(e.target.value)}
                                    placeholder="Optional note for this action..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none mb-3"
                                />
                                {complaint.isSensitive &&
                                    availableActions.includes('send_to_respondent') && (
                                        <textarea
                                            value={summaryForRespondent}
                                            onChange={(e) =>
                                                setSummaryForRespondent(e.target.value)
                                            }
                                            placeholder="Summary for respondent (required for sensitive complaints)..."
                                            rows={2}
                                            className="w-full px-3 py-2 text-xs border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none mb-3"
                                        />
                                    )}
                                <div className="flex flex-wrap gap-2">
                                    {availableActions.map((action) => (
                                        <button
                                            type="button"
                                            key={action}
                                            onClick={() => void handleModerate(action)}
                                            disabled={actionLoading}
                                            className="px-3 py-1.5 border-2 border-line hover:border-teal-400 text-ink-secondary hover:text-teal-700 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                                        >
                                            {formatActionLabel(action)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ RIGHT COLUMN ═══ */}
                    <div className="space-y-4">
                        {/* Timeline */}
                        <div className="bg-surface rounded-xl border border-line p-4">
                            <h3 className="text-base font-bold text-ink mb-3">
                                Activity Timeline
                            </h3>
                            <ComplaintTimeline events={complaint.events} />
                        </div>

                        {/* Respondent's response */}
                        {complaint.response && (
                            <div className="bg-surface rounded-xl border border-line p-4">
                                <h3 className="text-base font-bold text-ink mb-3">
                                    Respondent's Response
                                </h3>
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-purple-900">
                                            {complaint.response.respondentName}
                                        </span>
                                        <span className="text-xs text-purple-600">
                                            {formatDate(complaint.response.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-purple-900 leading-relaxed">
                                        {complaint.response.body}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Evidence */}
                        <div className="bg-surface rounded-xl border border-line p-4">
                            <h3 className="text-base font-bold text-ink mb-3">
                                Evidence ({complaint.evidences.length})
                            </h3>
                            <EvidenceGallery evidences={complaint.evidences} />
                        </div>

                        {/* Internal Notes */}
                        {complaint.internalNotes && (
                            <div className="bg-surface rounded-xl border border-line p-4">
                                <h3 className="text-base font-bold text-ink mb-3">
                                    Internal Notes
                                </h3>
                                <p className="text-sm text-ink-secondary leading-relaxed">
                                    {complaint.internalNotes}
                                </p>
                            </div>
                        )}

                        {/* Record Outcome */}
                        {!isTerminal && (
                            <div className="bg-surface rounded-xl border border-line p-4">
                                <h3 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
                                    <Scale className="w-4 h-4" />
                                    Record Outcome
                                </h3>

                                {outcomeForm.formState.errors.root && (
                                    <div className="mb-3">
                                        <FormErrorBanner>
                                            {outcomeForm.formState.errors.root.message}
                                        </FormErrorBanner>
                                    </div>
                                )}

                                <form
                                    onSubmit={(e) => void outcomeForm.handleSubmit(handleRecordOutcome)(e)}
                                    className="space-y-3"
                                >
                                    <div>
                                        <label className="text-xs font-semibold text-ink-muted mb-1 block">
                                            Outcome
                                        </label>
                                        <Controller
                                            name="outcome"
                                            control={outcomeForm.control}
                                            render={({ field }) => (
                                                <select
                                                    {...field}
                                                    className="w-full px-3 py-2 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none"
                                                >
                                                    <option value="">Select outcome...</option>
                                                    {OUTCOME_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        />
                                        {outcomeForm.formState.errors.outcome && (
                                            <p className="text-red-500 text-xs mt-1">
                                                {outcomeForm.formState.errors.outcome.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-ink-muted mb-1 block">
                                            Resolution Note
                                        </label>
                                        <textarea
                                            {...outcomeForm.register('resolutionNote')}
                                            rows={3}
                                            placeholder="Explain the resolution (min 10 characters)..."
                                            className="w-full px-3 py-2 text-xs border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none"
                                        />
                                        {outcomeForm.formState.errors.resolutionNote && (
                                            <p className="text-red-500 text-xs mt-1">
                                                {outcomeForm.formState.errors.resolutionNote.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-ink-muted mb-1 block">
                                            Protective Action (optional)
                                        </label>
                                        <textarea
                                            {...outcomeForm.register('protectiveAction')}
                                            rows={2}
                                            placeholder="Any protective action taken (e.g., account suspension)..."
                                            className="w-full px-3 py-2 text-xs border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none resize-none"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Shield className="w-4 h-4" />
                                        Record Outcome
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Close complaint (if resolved/rejected) */}
                        {(complaint.status === 'resolved' || complaint.status === 'rejected') && (
                            <button
                                type="button"
                                onClick={() => void handleModerate('close')}
                                disabled={actionLoading}
                                className="w-full px-4 py-2.5 border-2 border-line hover:border-ink-muted text-ink-secondary rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                            >
                                Close Complaint
                            </button>
                        )}
                    </div>
                </div>

                {/* Back button */}
                <button
                    type="button"
                    onClick={() => { void navigate(ROUTES.ADMIN_COMPLAINTS); }}
                    className="px-5 py-2.5 border-2 border-line text-ink-secondary rounded-lg font-semibold text-sm hover:border-line transition-colors"
                >
                    Back to List
                </button>
            </div>
        </DashboardLayout>
    );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map current status → available moderation actions. */
function getAvailableActions(status: string): ModerationAction[] {
    switch (status) {
        case 'submitted':
            return ['triage', 'request_info'];
        case 'triaged':
            return ['send_to_respondent', 'begin_review', 'escalate', 'request_info'];
        case 'needs_more_info':
            return ['retriage'];
        case 'awaiting_respondent':
            return ['begin_review'];
        case 'under_review':
            return ['escalate'];
        case 'escalated':
            return []; // outcome must be recorded via the outcome form
        default:
            return [];
    }
}

/** Human-readable action labels. */
function formatActionLabel(action: ModerationAction): string {
    const labels: Record<ModerationAction, string> = {
        triage: 'Triage',
        request_info: 'Request More Info',
        send_to_respondent: 'Send to Respondent',
        begin_review: 'Begin Review',
        escalate: 'Escalate',
        retriage: 'Re-triage',
        close: 'Close',
    };
    return labels[action];
}

export default AdminComplaintDetail;
