import { useState } from 'react';

/**
 * Shared submit handler for forms: manages submitting + top-level API error state.
 */
const useApiSubmit = <T,>(fn: (data: T) => Promise<void>) => {
	const [apiError, setApiError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (data: T) => {
		try {
			setApiError('');
			setSubmitting(true);
			await fn(data);
			return true;
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Something went wrong. Please try again.';
			setApiError(message);
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return { apiError, submitting, handleSubmit, clearError: () => setApiError('') };
};

export default useApiSubmit;
