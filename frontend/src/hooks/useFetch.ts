import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchResult<T> {
	data: T | null;
	loading: boolean;
	error: string;
	refetch: () => Promise<void>;
}

/**
 * Generic single-resource fetch hook.
 *
 * Handles loading / error state and guards against stale responses when the
 * component unmounts or the fetcher changes mid-flight.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useFetch(
 *     () => listingsService.getListing(id),
 *     [id],
 *   );
 */
export function useFetch<T>(
	fetcher: () => Promise<T>,
	deps: React.DependencyList = [],
): UseFetchResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const fetchIdRef = useRef(0);

	// Keep a stable ref so the callback below can always call the latest fetcher
	// without the function identity being a dependency.
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const refetch = useCallback(async () => {
		const id = ++fetchIdRef.current;
		setLoading(true);
		setError('');
		try {
			const result = await fetcherRef.current();
			if (id === fetchIdRef.current) setData(result);
		} catch (err) {
			if (id === fetchIdRef.current)
				setError(err instanceof Error ? err.message : 'An error occurred');
		} finally {
			if (id === fetchIdRef.current) setLoading(false);
		}
	// deps are forwarded from the caller so the effect re-runs when they change
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return { data, loading, error, refetch };
}
