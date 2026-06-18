import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HostDocumentUpload from '@pages/host/onboarding/HostDocumentUpload';
import { ROUTES } from '@/constants/routes';
import type { HostDocumentsRequest } from '@/types/onboarding';

const onboardingServiceMock = vi.hoisted(() => ({
	submitHostDocuments: vi.fn<(data: HostDocumentsRequest) => Promise<unknown>>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>(),
}));

vi.mock('@services/onboarding.service', () => ({
	default: onboardingServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const renderHostDocumentUploadPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.HOST_ONBOARDING_DOCUMENTS]}>
			<Routes>
				<Route
					path={ROUTES.HOST_ONBOARDING_DOCUMENTS}
					element={<HostDocumentUpload />}
				/>
				<Route
					path={ROUTES.HOST_ONBOARDING_COMPLETE}
					element={<div>host onboarding complete page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('HostDocumentUpload page', () => {
	beforeEach(() => {
		onboardingServiceMock.submitHostDocuments.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
		onboardingServiceMock.submitHostDocuments.mockResolvedValue({});
	});

	it('allows skipping directly to completion when no documents are selected', async () => {
		const user = userEvent.setup();
		renderHostDocumentUploadPage();

		await user.click(screen.getByRole('button', { name: 'Submit for Verification' }));

		expect(onboardingServiceMock.submitHostDocuments).not.toHaveBeenCalled();
		expect(await screen.findByText('host onboarding complete page')).toBeInTheDocument();
	});

	it('uploads selected documents and navigates to completion', async () => {
		const user = userEvent.setup();
		renderHostDocumentUploadPage();

		const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));

		if (fileInputs.length !== 3) {
			throw new Error('Expected three document upload inputs');
		}

		const citizenshipFile = new File(['citizenship'], 'citizenship.png', {
			type: 'image/png',
		});
		const businessLicenseFile = new File(['license'], 'license.png', {
			type: 'image/png',
		});

		await user.upload(fileInputs[0], citizenshipFile);
		await user.upload(fileInputs[2], businessLicenseFile);
		await user.click(screen.getByRole('button', { name: 'Submit for Verification' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitHostDocuments).toHaveBeenCalledWith({
				citizenshipFile,
				panFile: undefined,
				businessLicenseFile,
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Documents uploaded successfully!');
		expect(await screen.findByText('host onboarding complete page')).toBeInTheDocument();
	});

	it('shows an error banner and toast when document upload fails', async () => {
		const user = userEvent.setup();
		onboardingServiceMock.submitHostDocuments.mockRejectedValueOnce(
			new Error('Upload failed'),
		);

		renderHostDocumentUploadPage();

		const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');

		if (!fileInput) {
			throw new Error('Document upload input not found');
		}

		await user.upload(fileInput, new File(['citizenship'], 'citizenship.png', { type: 'image/png' }));
		await user.click(screen.getByRole('button', { name: 'Submit for Verification' }));

		expect(await screen.findByText('Upload failed')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Upload failed');
	});
});
