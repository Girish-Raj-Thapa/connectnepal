import { toast } from 'react-hot-toast';

type ToastVariant = 'success' | 'error' | 'info';

export const toasterProps = {
	position: 'top-center' as const,
	toastOptions: {
		duration: 4000,
		style: {
			padding: '12px 16px',
			border: '1px solid #e5e7eb',
			background: '#fff',
			color: '#0f172a',
			borderRadius: '12px',
			boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
		},
		success: {
			iconTheme: {
				primary: '#0d9488',
				secondary: '#fff',
			},
		},
		error: {
			iconTheme: {
				primary: '#ef4444',
				secondary: '#fff',
			},
		},
	},
};

const baseOptions = {
	style: { ...toasterProps.toastOptions.style },
	iconTheme: { ...toasterProps.toastOptions.success?.iconTheme },
};

const palette: Record<ToastVariant, { border: string; color: string; primary: string }> = {
	success: { border: '#15803d', color: '#15803d', primary: '#15803d' },
	error: { border: '#b91c1c', color: '#b91c1c', primary: '#b91c1c' },
	info: { border: '#2563eb', color: '#2563eb', primary: '#2563eb' },
};

/**
 * Centralized toast helpers to keep styling consistent across the app.
 */
const notification = {
	success: (message: string) =>
		toast.success(message, {
			...baseOptions,
			style: {
				...baseOptions.style,
				border: `1px solid ${palette.success.border}`,
				color: palette.success.color,
			},
			iconTheme: { primary: palette.success.primary, secondary: '#fff' },
		}),
	error: (message: string) =>
		toast.error(message, {
			...baseOptions,
			style: {
				...baseOptions.style,
				border: `1px solid ${palette.error.border}`,
				color: palette.error.color,
			},
			iconTheme: { primary: palette.error.primary, secondary: '#fff' },
		}),
	info: (message: string) =>
		toast(message, {
			...baseOptions,
			style: {
				...baseOptions.style,
				border: `1px solid ${palette.info.border}`,
				color: palette.info.color,
			},
			iconTheme: { primary: palette.info.primary, secondary: '#fff' },
		}),
};

export default notification;
