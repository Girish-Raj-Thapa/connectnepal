import { useState, useCallback, useEffect, useRef } from 'react';
import type {
    ComplaintListItem,
    ComplaintFilterParams,
    PaginatedComplaints,
} from '@/types/complaints';


interface UseComplaintsOptions {
    fetchFn: (params: ComplaintFilterParams) => Promise<PaginatedComplaints>;
    initialFilters?: ComplaintFilterParams;
}

interface UseComplaintsResult {
    complaints: ComplaintListItem[];
    totalCount: number;
    page: number;
    pageSize: number;
    loading: boolean;
    error: string;
    setPage: (p: number) => void;
    setFilters: (f: Partial<ComplaintFilterParams>) => void;
    refetch: () => void;
}


/**
 * Generic hook for loading paginated complaint lists.
 * Works for all roles (traveller filed, traveller received, host filed, host received, admin).
 *
 * Follows the same pattern as MyBookings.tsx — manual fetch with race-condition
 * protection via useRef.
 */
export const useComplaints = ({
    fetchFn,
    initialFilters = {},
}: UseComplaintsOptions): UseComplaintsResult => {
    const [complaints, setComplaints] = useState<ComplaintListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize, setPageSize] = useState(8);
    const [page, setPage] = useState(1);
    const [filters, setFiltersState] = useState<ComplaintFilterParams>(initialFilters);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const fetchIdRef = useRef(0);

    const fetch = useCallback(async () => {
        const currentFetchId = ++fetchIdRef.current;
        try {
            setLoading(true);
            setError('');
            const data = await fetchFn({ ...filters, page });
            if (currentFetchId !== fetchIdRef.current) return;
            setComplaints(data.results);
            setTotalCount(data.count);
            if (data.results.length > 0 && data.count > 0) {
                setPageSize(Math.ceil(data.count / Math.ceil(data.count / data.results.length)));
            }
        } catch (err) {
            if (currentFetchId !== fetchIdRef.current) return;
            setError(err instanceof Error ? err.message : 'Failed to load complaints');
        } finally {
            if (currentFetchId === fetchIdRef.current) setLoading(false);
        }
    }, [fetchFn, filters, page]);

    useEffect(() => { void fetch(); }, [fetch]);

    const setFilters = useCallback((partial: Partial<ComplaintFilterParams>) => {
        setFiltersState((prev) => ({ ...prev, ...partial }));
        setPage(1); // reset to page 1 on filter change
    }, []);

    return {
        complaints,
        totalCount,
        page,
        pageSize,
        loading,
        error,
        setPage,
        setFilters,
        refetch: () => { void fetch(); },
    };
};
