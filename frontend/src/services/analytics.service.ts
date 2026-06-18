import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
    TravellerOverviewResponse,
    HostOverviewResponse,
    AdminOverviewResponse,
} from '@/types/analytics';



export const TravellerAnalyticsService = {
    /**
     * GET /api/analytics/traveller/overview/
     *
     * Returns summary counters + upcoming booking previews + trip plan previews.
     */
    getOverview: async (): Promise<TravellerOverviewResponse> => {
        try {
            const res = await api.get<TravellerOverviewResponse>(
                '/analytics/traveller/overview/',
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load dashboard data');
        }
    },
};


export const HostAnalyticsService = {
    /**
     * GET /api/analytics/host/overview/
     *
     * Returns summary KPIs, monthly trends, recent bookings, and top listings.
     */
    getOverview: async (): Promise<HostOverviewResponse> => {
        try {
            const res = await api.get<HostOverviewResponse>(
                '/analytics/host/overview/',
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load dashboard data');
        }
    },
};


export const AdminAnalyticsService = {
    /**
     * GET /api/analytics/admin/overview/
     *
     * Returns platform-wide KPIs, trends, category distribution,
     * recent activity, and top-performing listings/hosts.
     */
    getOverview: async (): Promise<AdminOverviewResponse> => {
        try {
            const res = await api.get<AdminOverviewResponse>(
                '/analytics/admin/overview/',
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to load dashboard data');
        }
    },
};
