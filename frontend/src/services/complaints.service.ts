/**
 * Complaints Service
 * Handles all complaint-related API calls for traveller, host, and admin roles.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
    ComplaintDetail,
    ReceivedComplaintDetail,
    AdminComplaintDetail,
    ComplaintEvidence,
    ComplaintResponse,
    ComplaintEvent,
    PaginatedComplaints,
    FileComplaintPayload,
    RespondToComplaintPayload,
    ModerateComplaintPayload,
    OverrideSeverityPayload,
    RecordOutcomePayload,
    ComplaintFilterParams,
} from '@/types/complaints';



/** Build query params object, only including defined values. */
const buildParams = (filters: ComplaintFilterParams): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    if (filters.page) params.page = filters.page;
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.filedByRole) params.filed_by_role = filters.filedByRole;
    return params;
};


// Traveller - Complainant 
export const TravellerComplaintService = {

    /** 
     * POST /api/traveller/complaints/ 
     */
    fileComplaint: async (payload: FileComplaintPayload): Promise<ComplaintDetail> => {
        try {
            const res = await api.post<ComplaintDetail>('/traveller/complaints/', payload);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to file complaint');
        }
    },

    /** 
     * GET /api/traveller/complaints/ 
     */
    listFiled: async (filters: ComplaintFilterParams = {}): Promise<PaginatedComplaints> => {
        try {
            const res = await api.get<PaginatedComplaints>('/traveller/complaints/', {
                params: buildParams(filters),
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaints');
        }
    },

    /** 
     * GET /api/traveller/complaints/{id}/ 
     */
    getDetail: async (id: number): Promise<ComplaintDetail> => {
        try {
            const res = await api.get<ComplaintDetail>(`/traveller/complaints/${id}/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint details');
        }
    },

    /** 
     * GET /api/traveller/complaints/{id}/evidence/ 
     */
    listEvidence: async (id: number): Promise<ComplaintEvidence[]> => {
        try {
            const res = await api.get<ComplaintEvidence[]>(`/traveller/complaints/${id}/evidence/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load evidence');
        }
    },

    /** 
     * POST /api/traveller/complaints/{id}/evidence/ — multipart/form-data 
     */
    uploadEvidence: async (
        id: number,
        file: File,
        description?: string,
    ): Promise<ComplaintEvidence> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (description) formData.append('description', description);
            const res = await api.post<ComplaintEvidence>(
                `/traveller/complaints/${id}/evidence/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to upload evidence');
        }
    },

    /** 
     * GET /api/traveller/complaints/received/ 
     */
    listReceived: async (filters: ComplaintFilterParams = {}): Promise<PaginatedComplaints> => {
        try {
            const res = await api.get<PaginatedComplaints>('/traveller/complaints/received/', {
                params: buildParams(filters),
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load received complaints');
        }
    },

    /** 
     * GET /api/traveller/complaints/received/{id}/ 
     */
    getReceivedDetail: async (id: number): Promise<ReceivedComplaintDetail> => {
        try {
            const res = await api.get<ReceivedComplaintDetail>(
                `/traveller/complaints/received/${id}/`,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint details');
        }
    },

    /** 
     * POST /api/traveller/complaints/received/{id}/respond/ 
     */
    respond: async (id: number, payload: RespondToComplaintPayload): Promise<ComplaintResponse> => {
        try {
            const res = await api.post<ComplaintResponse>(
                `/traveller/complaints/received/${id}/respond/`,
                payload,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to submit response');
        }
    },

    /** 
     * GET /api/traveller/complaints/received/{id}/evidence/ 
     */
    listReceivedEvidence: async (id: number): Promise<ComplaintEvidence[]> => {
        try {
            const res = await api.get<ComplaintEvidence[]>(
                `/traveller/complaints/received/${id}/evidence/`,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load evidence');
        }
    },

    /** 
     * POST /api/traveller/complaints/received/{id}/evidence/ 
     */
    uploadReceivedEvidence: async (
        id: number,
        file: File,
        description?: string,
    ): Promise<ComplaintEvidence> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (description) formData.append('description', description);
            const res = await api.post<ComplaintEvidence>(
                `/traveller/complaints/received/${id}/evidence/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to upload evidence');
        }
    },
};

//  Host — Complainant + Respondent

export const HostComplaintService = {
    /** 
     * POST /api/host/complaints/ 
     */
    fileComplaint: async (payload: FileComplaintPayload): Promise<ComplaintDetail> => {
        try {
            const res = await api.post<ComplaintDetail>('/host/complaints/', payload);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to file complaint');
        }
    },

    /** 
     * GET /api/host/complaints/ 
     */
    listFiled: async (filters: ComplaintFilterParams = {}): Promise<PaginatedComplaints> => {
        try {
            const res = await api.get<PaginatedComplaints>('/host/complaints/', {
                params: buildParams(filters),
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaints');
        }
    },

    /** 
     * GET /api/host/complaints/{id}/ 
     */
    getDetail: async (id: number): Promise<ComplaintDetail> => {
        try {
            const res = await api.get<ComplaintDetail>(`/host/complaints/${id}/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint details');
        }
    },

    /** 
     * GET /api/host/complaints/{id}/evidence/ 
     */
    listEvidence: async (id: number): Promise<ComplaintEvidence[]> => {
        try {
            const res = await api.get<ComplaintEvidence[]>(`/host/complaints/${id}/evidence/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load evidence');
        }
    },

    /** 
     * POST /api/host/complaints/{id}/evidence/ 
     */
    uploadEvidence: async (
        id: number,
        file: File,
        description?: string,
    ): Promise<ComplaintEvidence> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (description) formData.append('description', description);
            const res = await api.post<ComplaintEvidence>(
                `/host/complaints/${id}/evidence/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to upload evidence');
        }
    },

    // Host as Respondent

    /** 
     * GET /api/host/complaints/received/ 
     */
    listReceived: async (filters: ComplaintFilterParams = {}): Promise<PaginatedComplaints> => {
        try {
            const res = await api.get<PaginatedComplaints>('/host/complaints/received/', {
                params: buildParams(filters),
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load received complaints');
        }
    },

    /** 
     * GET /api/host/complaints/received/{id}/ 
     */
    getReceivedDetail: async (id: number): Promise<ReceivedComplaintDetail> => {
        try {
            const res = await api.get<ReceivedComplaintDetail>(
                `/host/complaints/received/${id}/`,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint details');
        }
    },

    /** 
     * POST /api/host/complaints/received/{id}/respond/ 
     */
    respond: async (id: number, payload: RespondToComplaintPayload): Promise<ComplaintResponse> => {
        try {
            const res = await api.post<ComplaintResponse>(
                `/host/complaints/received/${id}/respond/`,
                payload,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to submit response');
        }
    },

    /** 
     * GET /api/host/complaints/received/{id}/evidence/ 
     */
    listReceivedEvidence: async (id: number): Promise<ComplaintEvidence[]> => {
        try {
            const res = await api.get<ComplaintEvidence[]>(
                `/host/complaints/received/${id}/evidence/`,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load evidence');
        }
    },

    /** 
     * POST /api/host/complaints/received/{id}/evidence/ 
     */
    uploadReceivedEvidence: async (
        id: number,
        file: File,
        description?: string,
    ): Promise<ComplaintEvidence> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (description) formData.append('description', description);
            const res = await api.post<ComplaintEvidence>(
                `/host/complaints/received/${id}/evidence/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to upload evidence');
        }
    },
};


// Admin 

export const AdminComplaintService = {
    /** 
     * GET /api/admin/complaints/ 
     */
    list: async (filters: ComplaintFilterParams = {}): Promise<PaginatedComplaints> => {
        try {
            const res = await api.get<PaginatedComplaints>('/admin/complaints/', {
                params: buildParams(filters),
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaints');
        }
    },

    /** 
     * GET /api/admin/complaints/{id}/ 
     */
    getDetail: async (id: number): Promise<AdminComplaintDetail> => {
        try {
            const res = await api.get<AdminComplaintDetail>(`/admin/complaints/${id}/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint details');
        }
    },

    /** 
     * POST /api/admin/complaints/{id}/moderate/ 
     */
    moderate: async (
        id: number,
        payload: ModerateComplaintPayload,
    ): Promise<AdminComplaintDetail> => {
        try {
            const res = await api.post<AdminComplaintDetail>(
                `/admin/complaints/${id}/moderate/`,
                payload,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to update complaint status');
        }
    },

    /** 
     * PATCH /api/admin/complaints/{id}/severity/ 
     */
    overrideSeverity: async (
        id: number,
        payload: OverrideSeverityPayload,
    ): Promise<AdminComplaintDetail> => {
        try {
            const res = await api.patch<AdminComplaintDetail>(
                `/admin/complaints/${id}/severity/`,
                payload,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to update severity');
        }
    },

    /** 
     * POST /api/admin/complaints/{id}/record-outcome/ 
     */
    recordOutcome: async (
        id: number,
        payload: RecordOutcomePayload,
    ): Promise<AdminComplaintDetail> => {
        try {
            const res = await api.post<AdminComplaintDetail>(
                `/admin/complaints/${id}/record-outcome/`,
                payload,
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to record outcome');
        }
    },

    /** 
     * GET /api/admin/complaints/{id}/events/ 
     */
    listEvents: async (id: number): Promise<ComplaintEvent[]> => {
        try {
            const res = await api.get<ComplaintEvent[]>(`/admin/complaints/${id}/events/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load complaint events');
        }
    },
};