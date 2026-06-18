import { useState, useEffect, useCallback, useRef } from 'react';

interface PaginatedResponse<T> {
	results: T[];
	count: number;
}

interface UsePaginatedListResult<T, F> {
	items: T[];
	totalCount: number;
	page: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	filter: F;
	/** Change the active filter and automatically reset page to 1. */
	setFilter: (f: F) => void;
	loading: boolean;
	error: string;
	refetch: () => Promise<void>;
}

/**
 * Paginated list hook with filter support.
 *
 * Encapsulates the page / filter / loading / error / data state pattern that
 * appears on every list page (ManageListings, ManagePackages, AdminBookings,
 * MyBookings, etc.).  Guards against stale responses with a fetch-ID ref.
 *
 * Usage:
 *   const { items, totalCount, page, setPage, filter, setFilter, loading, error } =
 *     usePaginatedList(
 *       (page, filter) => packagesService.listPackages({ page, isBookable: filter }),
 *       'all' as PackageTabFilter,
 *     );
 */
export function usePaginatedList<T, F>(
	fetcher: (page: number, filter: F) => Promise<PaginatedResponse<T>>,
	initialFilter: F,
): UsePaginatedListResult<T, F> {
	const [items, setItems] = useState<T[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [filter, setFilterState] = useState<F>(initialFilter);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const fetchIdRef = useRef(0);

	// Stable ref so the callback always uses the latest fetcher without
	// needing it in the dependency array (avoids re-subscribing on every render).
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const refetch = useCallback(async () => {
		const id = ++fetchIdRef.current;
		setLoading(true);
		setError('');
		try {
			const data = await fetcherRef.current(page, filter);
			if (id === fetchIdRef.current) {
				setItems(data.results);
				setTotalCount(data.count);
			}
		} catch (err) {
			if (id === fetchIdRef.current)
				setError(err instanceof Error ? err.message : 'Failed to load data');
		} finally {
			if (id === fetchIdRef.current) setLoading(false);
		}
	}, [page, filter]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const setFilter = useCallback((f: F) => {
		setFilterState(f);
		setPage(1);
	}, []);

	return { items, totalCount, page, setPage, filter, setFilter, loading, error, refetch };
}
