import { useState, useEffect, useCallback } from 'react';

interface UseAnalyticsResult<T> {
    data: T | null;
    loading: boolean;
    error: string;
    refetch: () => void;
}

/**
 * Generic hook for fetching analytics data.
 *
 * Usage:
 * const { data, loading, error } = useAnalytics(TravellerAnalyticsService.getOverview);
 */
export const useAnalytics = <T,>(
	fetchFn: () => Promise<T>,
): UseAnalyticsResult<T> => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

	const fetch = useCallback(async () => {
			try {
				setLoading(true);
				setError('');
			const result = await fetchFn();
			setData(result);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to load dashboard data';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [fetchFn]);

	useEffect(() => {
		void fetch();
	}, [fetch]);

	const refetch = useCallback(() => {
		void fetch();
	}, [fetch]);

	return { data, loading, error, refetch };
};

export default useAnalytics;
