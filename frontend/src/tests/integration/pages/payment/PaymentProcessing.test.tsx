import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentProcessing from '@pages/payment/PaymentProcessing';
import { ROUTES } from '@/constants/routes';

const paymentServiceMock = vi.hoisted(() => ({
	getAttemptStatus: vi.fn(),
}));

vi.mock('@services/payments.service', () => ({
	PaymentService: paymentServiceMock,
}));

vi.mock('@components/layout/Navbar', () => ({
	default: () => <div>navbar</div>,
}));

const renderPaymentProcessing = (entry = '/payment/processing?attempt_id=88') =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<Routes>
				<Route path={ROUTES.PAYMENT_PROCESSING} element={<PaymentProcessing />} />
				<Route path={ROUTES.PAYMENT_SUCCESS} element={<div>success page</div>} />
				<Route path={ROUTES.PAYMENT_FAILURE} element={<div>failure page</div>} />
				<Route path={ROUTES.TRAVELLER_BOOKINGS} element={<div>bookings page</div>} />
				<Route path={ROUTES.HOME} element={<div>home page</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('Payment processing page', () => {
	beforeEach(() => {
		paymentServiceMock.getAttemptStatus.mockReset();
	});

	it('redirects home when the attempt id is missing', async () => {
		renderPaymentProcessing('/payment/processing');

		await waitFor(() => {
			expect(screen.getByText('home page')).toBeInTheDocument();
		});
	});

	it('navigates to the success page when the payment becomes verified', async () => {
		paymentServiceMock.getAttemptStatus.mockResolvedValueOnce({
			id: 88,
			status: 'verified',
			bookingId: 77,
			provider: 'esewa',
			createdAt: '2026-05-01T10:00:00Z',
			verifiedAt: '2026-05-01T10:01:00Z',
		});

		renderPaymentProcessing();

		await waitFor(() => {
			expect(screen.getByText('success page')).toBeInTheDocument();
		});
	});

	it('shows the timeout state after prolonged pending verification', async () => {
		const realSetTimeout = globalThis.setTimeout;
		let timeoutHandler: (() => void) | null = null;

		const setTimeoutSpy = vi
			.spyOn(globalThis, 'setTimeout')
			.mockImplementation((handler, timeout) => {
				if (timeout === 60000) {
					timeoutHandler = typeof handler === 'function'
						? (handler as () => void)
						: null;
					return 1 as ReturnType<typeof setTimeout>;
				}

				return realSetTimeout(handler, timeout);
			});

		paymentServiceMock.getAttemptStatus.mockResolvedValue({
			id: 88,
			status: 'pending',
			bookingId: 77,
			provider: 'esewa',
			createdAt: '2026-05-01T10:00:00Z',
			verifiedAt: null,
		});

		renderPaymentProcessing();

		try {
			expect(
				await screen.findByText('Waiting for confirmation from eSewa...'),
			).toBeInTheDocument();

			act(() => {
				timeoutHandler?.();
			});

			expect(
				await screen.findByRole('heading', { name: 'Still checking your payment' }),
			).toBeInTheDocument();
			expect(screen.getByText('77')).toBeInTheDocument();

			act(() => {
				screen.getByRole('button', { name: 'View My Bookings' }).click();
			});

			await waitFor(() => {
				expect(screen.getByText('bookings page')).toBeInTheDocument();
			});
		} finally {
			setTimeoutSpy.mockRestore();
		}
	});
});
