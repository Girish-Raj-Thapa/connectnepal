import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useApiSubmit from '@hooks/useApiSubmit';

const createDeferred = () => {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;

	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

describe('useApiSubmit', () => {
	it('sets submitting during a successful submit and clears previous errors', async () => {
		const deferred = createDeferred();
		const submitFn = vi.fn(() => deferred.promise);
		const { result } = renderHook(() => useApiSubmit(submitFn));

		let submitPromise!: Promise<boolean>;

		act(() => {
			submitPromise = result.current.handleSubmit({ email: 'user@example.com' });
		});

		await waitFor(() => {
			expect(result.current.submitting).toBe(true);
			expect(result.current.apiError).toBe('');
		});

		deferred.resolve();

		await expect(submitPromise).resolves.toBe(true);
		await waitFor(() => {
			expect(result.current.submitting).toBe(false);
		});
		expect(submitFn).toHaveBeenCalledWith({ email: 'user@example.com' });
	});

	it('stores the error message when submit fails with an Error', async () => {
		const submitFn = vi.fn(() => Promise.reject(new Error('Request failed')));
		const { result } = renderHook(() => useApiSubmit(submitFn));

		let submitResult = false;

		await act(async () => {
			submitResult = await result.current.handleSubmit({ email: 'user@example.com' });
		});

		expect(submitResult).toBe(false);
		expect(result.current.apiError).toBe('Request failed');
		expect(result.current.submitting).toBe(false);
	});

	it('uses a fallback message for non-Error failures and supports clearError', async () => {
		const submitFn = vi.fn(
			() =>
				({
					then: (
						_onFulfilled?: (value: void) => unknown,
						onRejected?: (reason: unknown) => unknown,
					) => {
						onRejected?.('bad failure');
					},
				}) as Promise<void>,
		);
		const { result } = renderHook(() => useApiSubmit(submitFn));

		let submitResult = false;

		await act(async () => {
			submitResult = await result.current.handleSubmit({ email: 'user@example.com' });
		});

		expect(submitResult).toBe(false);
		expect(result.current.apiError).toBe('Something went wrong. Please try again.');

		act(() => {
			result.current.clearError();
		});

		expect(result.current.apiError).toBe('');
	});
});
