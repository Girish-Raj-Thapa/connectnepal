import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Settings from '@pages/traveller/Settings';

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/form/ProfileSettingsForm', () => ({
	default: () => <div>profile settings form</div>,
}));

const renderSettings = () =>
	render(
		<MemoryRouter>
			<Settings />
		</MemoryRouter>,
	);

describe('Traveller settings page', () => {
	it('renders the settings header and profile settings form', () => {
		renderSettings();

		expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
		expect(screen.getByText('Manage your profile and password')).toBeInTheDocument();
		expect(screen.getByText('profile settings form')).toBeInTheDocument();
	});
});
