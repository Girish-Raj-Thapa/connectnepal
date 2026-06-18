import {
    FileText,
    Image,
    CheckCircle,
    AlertTriangle,
    MessageSquare,
    Eye,
    Scale,
    Shield,
    XCircle,
    Lock,
} from 'lucide-react';
import type { ComplaintEvent, ComplaintEventType } from '@/types/complaints';
import { timeAgo } from '@utils/format';

const EVENT_ICONS: Record<ComplaintEventType, typeof FileText> = {
    complaint_submitted: FileText,
    evidence_added: Image,
    complaint_triaged: CheckCircle,
    severity_updated: AlertTriangle,
    more_info_requested: MessageSquare,
    respondent_notified: Eye,
    response_received: MessageSquare,
    review_started: Scale,
    complaint_escalated: AlertTriangle,
    outcome_recorded: CheckCircle,
    complaint_closed: XCircle,
    protective_action_recorded: Shield,
};

const EVENT_COLORS: Record<ComplaintEventType, string> = {
    complaint_submitted: 'bg-surface-muted text-ink-muted',
    evidence_added: 'bg-blue-100 text-blue-600',
    complaint_triaged: 'bg-blue-100 text-blue-600',
    severity_updated: 'bg-orange-100 text-orange-600',
    more_info_requested: 'bg-yellow-100 text-yellow-600',
    respondent_notified: 'bg-purple-100 text-purple-600',
    response_received: 'bg-purple-100 text-purple-600',
    review_started: 'bg-indigo-100 text-indigo-600',
    complaint_escalated: 'bg-red-100 text-red-600',
    outcome_recorded: 'bg-green-100 text-green-600',
    complaint_closed: 'bg-surface-muted text-ink-muted',
    protective_action_recorded: 'bg-red-100 text-red-600',
};

const EVENT_LABELS: Record<ComplaintEventType, string> = {
    complaint_submitted: 'Complaint Filed',
    evidence_added: 'Evidence Uploaded',
    complaint_triaged: 'Triaged',
    severity_updated: 'Severity Updated',
    more_info_requested: 'More Info Requested',
    respondent_notified: 'Sent to Respondent',
    response_received: 'Response Received',
    review_started: 'Review Started',
    complaint_escalated: 'Escalated',
    outcome_recorded: 'Outcome Recorded',
    complaint_closed: 'Closed',
    protective_action_recorded: 'Protective Action',
};

interface Props {
    events: ComplaintEvent[];
}

const ComplaintTimeline = ({ events }: Props) => {
    if (events.length === 0) return null;

    return (
        <div className="space-y-3">
            {events.map((event, idx) => {
                const Icon = EVENT_ICONS[event.eventType] ?? Lock;
                const colorClass = EVENT_COLORS[event.eventType] ?? 'bg-surface-muted text-ink-muted';
                const label = EVENT_LABELS[event.eventType] ?? event.eventType;
                const note =
                    (event.payload?.note as string) ||
                    (event.payload?.reason as string) ||
                    '';

                return (
                    <div key={event.id} className="flex gap-3">
                        {/* Vertical line + icon */}
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
                            >
                                <Icon className="w-4 h-4" />
                            </div>
                            {idx < events.length - 1 && (
                                <div className="w-0.5 flex-1 bg-surface-raised mt-1" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="pb-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-ink">
                                    {label}
                                </span>
                                <span className="text-xs text-ink-muted">
                                    {timeAgo(event.createdAt)}
                                </span>
                            </div>
                            <p className="text-xs text-ink-muted mt-0.5">
                                by {event.actorName} ({event.actorRole})
                            </p>
                            {note && (
                                <p className="text-xs text-ink-muted mt-1 bg-surface-muted rounded-lg p-2">
                                    {note}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ComplaintTimeline;
