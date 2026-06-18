import { useState, useEffect, useCallback, useRef } from 'react';
import RecommendationsService from '@services/recommendations.service';
import type { RecommendationMeta } from '@services/recommendations.service';
import type { RecommendationListing } from '@/types/listings';
import type { RecommendedPackage } from '@/types/packages';

/**
 * Fetch similar listings for a given listing ID.
 * Returns empty array on 404 (listing not found) — caller can hide the section.
 */
export function useSimilarListings(listingId: number | null, limit = 6) {
	const [listings, setListings] = useState<RecommendationListing[]>([]);
	const [meta, setMeta] = useState<RecommendationMeta | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fetchIdRef = useRef(0);
	const lastRequestKeyRef = useRef<string | null>(null);

	const fetchSimilar = useCallback(async () => {
		if (!listingId) return;

		const fetchId = ++fetchIdRef.current;
		setLoading(true);
		setError(null);

		try {
			const data = await RecommendationsService.getSimilarListings(listingId, limit);
			if (fetchId === fetchIdRef.current) {
				setListings(data.results);
				setMeta(data.meta);
			}
		} catch (err: unknown) {
			if (fetchId !== fetchIdRef.current) return;
			const status = (err as { response?: { status?: number } }).response?.status;
			if (status === 404) {
				setListings([]);
			} else {
				setError('Failed to load recommendations');
			}
		} finally {
			if (fetchId === fetchIdRef.current) setLoading(false);
		}
	}, [listingId, limit]);

	useEffect(() => {
		const requestKey = listingId ? `${listingId}:${limit}` : null;
		if (!requestKey) {
			lastRequestKeyRef.current = null;
			return;
		}
		if (lastRequestKeyRef.current === requestKey) return;
		lastRequestKeyRef.current = requestKey;

		void fetchSimilar();
	}, [fetchSimilar, listingId, limit]);

	return { listings, meta, loading, error };
}

/**
 * Fetch personalized "for you" recommendations.
 * Requires authenticated traveller. Returns empty on 401/403 — caller hides section.
 */
export function useForYouListings(limit = 12, enabled = true) {
	const [listings, setListings] = useState<RecommendationListing[]>([]);
	const [meta, setMeta] = useState<RecommendationMeta | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fetchIdRef = useRef(0);
	const lastRequestKeyRef = useRef<string | null>(null);

	const fetchForYou = useCallback(async () => {
		if (!enabled) return;

		const fetchId = ++fetchIdRef.current;
		setLoading(true);
		setError(null);

		try {
			const data = await RecommendationsService.getForYou(limit);
			if (fetchId === fetchIdRef.current) {
				setListings(data.results);
				setMeta(data.meta);
			}
		} catch (err: unknown) {
			if (fetchId !== fetchIdRef.current) return;
			const status = (err as { response?: { status?: number } }).response?.status;
			if ([401, 403].includes(status ?? 0)) {
				setListings([]);
			} else {
				setError('Failed to load recommendations');
			}
		} finally {
			if (fetchId === fetchIdRef.current) setLoading(false);
		}
	}, [limit, enabled]);

	useEffect(() => {
		const requestKey = enabled ? `for-you:${limit}` : null;
		if (!requestKey) {
			lastRequestKeyRef.current = null;
			return;
		}
		if (lastRequestKeyRef.current === requestKey) return;
		lastRequestKeyRef.current = requestKey;

		void fetchForYou();
	}, [fetchForYou, enabled, limit]);

	return { listings, meta, loading, error };
}

/**
 * Fetch personalized package recommendations for authenticated travellers.
 * Returns empty on 401/403 — caller hides the section.
 */
export function useForYouPackages(limit = 3, enabled = true) {
	const [packages, setPackages] = useState<RecommendedPackage[]>([]);
	const [meta, setMeta] = useState<RecommendationMeta | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fetchIdRef = useRef(0);
	const lastRequestKeyRef = useRef<string | null>(null);

	const fetchForYouPackages = useCallback(async () => {
		if (!enabled) return;

		const fetchId = ++fetchIdRef.current;
		setLoading(true);
		setError(null);

		try {
			const data = await RecommendationsService.getForYouPackages(limit);
			if (fetchId === fetchIdRef.current) {
				setPackages(data.results);
				setMeta(data.meta);
			}
		} catch (err: unknown) {
			if (fetchId !== fetchIdRef.current) return;
			const status = (err as { response?: { status?: number } }).response?.status;
			if ([401, 403].includes(status ?? 0)) {
				setPackages([]);
			} else {
				setError('Failed to load package recommendations');
			}
		} finally {
			if (fetchId === fetchIdRef.current) setLoading(false);
		}
	}, [enabled, limit]);

	useEffect(() => {
		const requestKey = enabled ? `package-for-you:${limit}` : null;
		if (!requestKey) {
			lastRequestKeyRef.current = null;
			return;
		}
		if (lastRequestKeyRef.current === requestKey) return;
		lastRequestKeyRef.current = requestKey;

		void fetchForYouPackages();
	}, [enabled, fetchForYouPackages, limit]);

	return { packages, meta, loading, error };
}
