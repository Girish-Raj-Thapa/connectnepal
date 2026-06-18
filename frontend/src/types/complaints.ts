// Complaint domain types — mirrors API contract

// ENUMS (union types)

export type ComplaintStatus = | 'submitted' | 'triaged' | 'needs_more_info' | 'awaiting_respondent' | 'under_review' | 'escalated' | 'resolved' | 'rejected' | 'closed';

export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintCategory = | 'misleading_listing' | 'misleading_package' | 'itinerary_mismatch' | 'amenity_not_as_described' | 'no_show' | 'delay_or_non_delivery' | 'poor_communication' | 'extra_charge_demanded' | 'off_platform_payment_pressure' | 'refund_dispute' | 'property_damage' | 'host_misconduct' | 'traveller_misconduct' | 'other' | 'harassment' | 'discrimination' | 'fraud_or_scam' | 'safety_concern' | 'threatening_behavior';

export type ComplaintOutcome = | 'no_violation' | 'insufficient_evidence' | 'minor_violation' | 'major_violation' | 'partially_substantiated' | 'malicious_report';

export type ComplaintEventType = | 'complaint_submitted' | 'evidence_added' | 'complaint_triaged' | 'severity_updated' | 'more_info_requested' | 'respondent_notified' | 'response_received' | 'review_started' | 'complaint_escalated' | 'outcome_recorded' | 'complaint_closed' | 'protective_action_recorded';

export type ModerationAction = | 'triage' | 'request_info' | 'send_to_respondent' | 'begin_review' | 'escalate' | 'retriage' | 'close';


// Label & Color Maps 

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
    submitted: 'Submitted',
    triaged: 'Triaged',
    needs_more_info: 'Needs More Info',
    awaiting_respondent: 'Awaiting Response',
    under_review: 'Under Review',
    escalated: 'Escalated',
    resolved: 'Resolved',
    rejected: 'Rejected',
    closed: 'Closed',
};

export const COMPLAINT_STATUS_COLORS: Record<
    ComplaintStatus, 
    { bg: string; text: string; dot: string }
> = {
    submitted: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
    triaged: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
    needs_more_info: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
    awaiting_respondent: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
    under_review: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400' },
    escalated: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
    resolved: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' },
    rejected: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-300' },
};

export const SEVERITY_LABELS: Record<ComplaintSeverity, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
};

export const SEVERITY_COLORS: Record<
    ComplaintSeverity,
    { bg: string; text: string }
> = {
    low: { bg: 'bg-green-100', text: 'text-green-700' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700' },
    critical: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
    misleading_listing: 'Misleading Listing',
    misleading_package: 'Misleading Package',
    itinerary_mismatch: 'Itinerary Mismatch',
    amenity_not_as_described: 'Amenity Not As Described',
    no_show: 'No Show',
    delay_or_non_delivery: 'Delay / Non-Delivery',
    poor_communication: 'Poor Communication',
    extra_charge_demanded: 'Extra Charge Demanded',
    off_platform_payment_pressure: 'Off-Platform Payment',
    refund_dispute: 'Refund Dispute',
    property_damage: 'Property Damage',
    host_misconduct: 'Host Misconduct',
    traveller_misconduct: 'Traveller Misconduct',
    other: 'Other',
    harassment: 'Harassment',
    discrimination: 'Discrimination',
    fraud_or_scam: 'Fraud / Scam',
    safety_concern: 'Safety Concern',
    threatening_behavior: 'Threatening Behavior',
};

export const CATEGORY_COLORS: Record<ComplaintCategory, { bg: string; text: string }> = {
    misleading_listing: { bg: 'bg-amber-100', text: 'text-amber-700' },
    misleading_package: { bg: 'bg-amber-100', text: 'text-amber-700' },
    itinerary_mismatch: { bg: 'bg-amber-100', text: 'text-amber-700' },
    amenity_not_as_described: { bg: 'bg-blue-100', text: 'text-blue-700' },
    no_show: { bg: 'bg-gray-100', text: 'text-gray-700' },
    delay_or_non_delivery: { bg: 'bg-blue-100', text: 'text-blue-700' },
    poor_communication: { bg: 'bg-gray-100', text: 'text-gray-600' },
    extra_charge_demanded: { bg: 'bg-orange-100', text: 'text-orange-700' },
    off_platform_payment_pressure: { bg: 'bg-orange-100', text: 'text-orange-700' },
    refund_dispute: { bg: 'bg-purple-100', text: 'text-purple-700' },
    property_damage: { bg: 'bg-red-100', text: 'text-red-700' },
    host_misconduct: { bg: 'bg-red-100', text: 'text-red-700' },
    traveller_misconduct: { bg: 'bg-red-100', text: 'text-red-700' },
    other: { bg: 'bg-gray-100', text: 'text-gray-600' },
    harassment: { bg: 'bg-red-100', text: 'text-red-700' },
    discrimination: { bg: 'bg-red-100', text: 'text-red-700' },
    fraud_or_scam: { bg: 'bg-red-100', text: 'text-red-700' },
    safety_concern: { bg: 'bg-red-100', text: 'text-red-700' },
    threatening_behavior: { bg: 'bg-red-100', text: 'text-red-700' },
};

/** Dropdown options for filing a complaint. Grouped by reporting window. */
export const CATEGORY_OPTIONS: { value: ComplaintCategory; label: string; group: string }[] = [
    // 3-day window
    { value: 'misleading_listing', label: 'Misleading Listing', group: 'Service Issues (3-day window)' },
    { value: 'misleading_package', label: 'Misleading Package', group: 'Service Issues (3-day window)' },
    { value: 'itinerary_mismatch', label: 'Itinerary Mismatch', group: 'Service Issues (3-day window)' },
    { value: 'amenity_not_as_described', label: 'Amenity Not As Described', group: 'Service Issues (3-day window)' },
    { value: 'no_show', label: 'No Show', group: 'Service Issues (3-day window)' },
    { value: 'delay_or_non_delivery', label: 'Delay / Non-Delivery', group: 'Service Issues (3-day window)' },
    // 7-day window
    { value: 'poor_communication', label: 'Poor Communication', group: 'Operational Issues (7-day window)' },
    { value: 'extra_charge_demanded', label: 'Extra Charge Demanded', group: 'Operational Issues (7-day window)' },
    { value: 'off_platform_payment_pressure', label: 'Off-Platform Payment Pressure', group: 'Operational Issues (7-day window)' },
    { value: 'refund_dispute', label: 'Refund Dispute', group: 'Operational Issues (7-day window)' },
    { value: 'property_damage', label: 'Property Damage', group: 'Operational Issues (7-day window)' },
    // 30-day window
    { value: 'host_misconduct', label: 'Host Misconduct', group: 'Conduct Issues (30-day window)' },
    { value: 'traveller_misconduct', label: 'Traveller Misconduct', group: 'Conduct Issues (30-day window)' },
    { value: 'other', label: 'Other', group: 'Conduct Issues (30-day window)' },
    // 90-day window
    { value: 'harassment', label: 'Harassment', group: 'Serious Issues (90-day window)' },
    { value: 'discrimination', label: 'Discrimination', group: 'Serious Issues (90-day window)' },
    { value: 'fraud_or_scam', label: 'Fraud / Scam', group: 'Serious Issues (90-day window)' },
    { value: 'safety_concern', label: 'Safety Concern', group: 'Serious Issues (90-day window)' },
    { value: 'threatening_behavior', label: 'Threatening Behavior', group: 'Serious Issues (90-day window)' },
];

export const OUTCOME_LABELS: Record<ComplaintOutcome, string> = {
    no_violation: 'No Violation',
    insufficient_evidence: 'Insufficient Evidence',
    minor_violation: 'Minor Violation',
    major_violation: 'Major Violation',
    partially_substantiated: 'Partially Substantiated',
    malicious_report: 'Malicious Report',
};

export const OUTCOME_OPTIONS: { value: ComplaintOutcome; label: string }[] = [
    { value: 'no_violation', label: 'No Violation (→ Rejected)' },
    { value: 'insufficient_evidence', label: 'Insufficient Evidence (→ Rejected)' },
    { value: 'minor_violation', label: 'Minor Violation (→ Resolved)' },
    { value: 'major_violation', label: 'Major Violation (→ Resolved)' },
    { value: 'partially_substantiated', label: 'Partially Substantiated (→ Resolved)' },
    { value: 'malicious_report', label: 'Malicious Report (→ Resolved)' },
];


// Domain Models 

export interface ComplaintEvidence {
    id: number;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    description: string;
    uploaderName: string;
    uploadedBy: number;
    createdAt: string;
}

export interface ComplaintResponse {
    id: number;
    respondentName: string;
    body: string;
    isVisibleToComplainant: boolean;
    createdAt: string;
}

export interface ComplaintEvent {
    id: number;
    eventType: ComplaintEventType;
    actorName: string;
    actorRole: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

/** List-view shape (returned by GET /complaints/ and /complaints/received/) */
export interface ComplaintListItem {
    id: number;
    category: ComplaintCategory;
    title: string;
    severity: ComplaintSeverity;
    status: ComplaintStatus;
    filerName: string;
    filedByRole: 'traveller' | 'host';
    targetLabel: string;
    eventCount: number;
    evidenceCount: number;
    createdAt: string;
}

/** Full complaint detail — complainant view */
export interface ComplaintDetail {
    id: number;
    bookingItem: number;
    booking: number;
    bookingReference: string;
    filedBy: number;
    filerName: string;
    filedByRole: 'traveller' | 'host';
    complaintAgainstUser: number | null;
    respondentName: string | null;
    listing: number | null;
    listingTitle: string | null;
    package: number | null;
    packageTitle: string | null;
    category: ComplaintCategory;
    title: string;
    description: string;
    severity: ComplaintSeverity;
    status: ComplaintStatus;
    isSensitive: boolean;
    requiresEvidence: boolean;
    complainantEvidenceSubmitted: boolean;
    outcome: ComplaintOutcome | '';
    resolutionNote: string;
    protectiveAction: string;
    createdAt: string;
    updatedAt: string;
    triagedAt: string | null;
    resolvedAt: string | null;
    evidences: ComplaintEvidence[];
    events: ComplaintEvent[];
    response: ComplaintResponse | null;
}

/** Respondent view — description may be sanitised summary */
export interface ReceivedComplaintDetail {
    id: number;
    bookingItem: number;
    booking: number;
    bookingReference: string;
    filedByRole: 'traveller' | 'host';
    filerName: string;
    listing: number | null;
    listingTitle: string | null;
    package: number | null;
    packageTitle: string | null;
    category: ComplaintCategory;
    title: string;
    descriptionOrSummary: string;
    severity: ComplaintSeverity;
    status: ComplaintStatus;
    isSensitive: boolean;
    outcome: ComplaintOutcome | '';
    resolutionNote: string;
    createdAt: string;
    resolvedAt: string | null;
    evidences: ComplaintEvidence[];
    response: ComplaintResponse | null;
    canRespond: boolean;
}

/** Admin view — includes all admin-only fields */
export interface AdminComplaintDetail extends ComplaintDetail {
    severityOverriddenBy: number | null;
    severityOverrideReason: string;
    outcomeRecordedBy: number | null;
    outcomeRecordedAt: string | null;
    internalNotes: string;
    adminSummaryForRespondent: string;
    protectiveActionRecordedAt: string | null;
}

/** Paginated list wrapper (same shape the backend uses everywhere) */
export interface PaginatedComplaints {
    count: number;
    next: string | null;
    previous: string | null;
    results: ComplaintListItem[];
}

// Request Payloads 

export interface FileComplaintPayload {
    bookingItemId: number;
    category: ComplaintCategory;
    title: string;
    description: string;
}

export interface RespondToComplaintPayload {
    body: string;
}

export interface ModerateComplaintPayload {
    action: ModerationAction;
    note?: string;
    summaryForRespondent?: string;
}

export interface OverrideSeverityPayload {
    severity: ComplaintSeverity;
    reason: string;
}

export interface RecordOutcomePayload {
    outcome: ComplaintOutcome;
    resolutionNote: string;
    protectiveAction?: string;
}


// Filter Params 

export interface ComplaintFilterParams {
    page?: number;
    category?: ComplaintCategory;
    status?: ComplaintStatus;
    severity?: ComplaintSeverity;
    filedByRole?: 'traveller' | 'host';
}
