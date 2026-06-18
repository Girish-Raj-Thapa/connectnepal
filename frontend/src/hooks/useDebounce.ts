import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity.  Use this to avoid firing API calls on every keystroke.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery);
 */
export function useDebounce<T>(value: T, delay = 400): T {
	const [debounced, setDebounced] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}
