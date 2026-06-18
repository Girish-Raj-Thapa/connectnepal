/* eslint-disable react-refresh/only-export-components */
import type { PropsWithChildren, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
	render,
	type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type WrapperComponent = ({ children }: PropsWithChildren) => ReactElement;

type RenderWithRouterOptions = Omit<RenderOptions, 'wrapper'> & {
	route?: string;
	initialEntries?: string[];
	wrapper?: WrapperComponent;
};

const RouterWrapper = ({
	children,
	initialEntries,
	wrapper: Wrapper,
}: PropsWithChildren<{ initialEntries: string[]; wrapper?: WrapperComponent }>) => {
	const content = Wrapper ? <Wrapper>{children}</Wrapper> : children;

	return <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>;
};

export const renderWithRouter = (
	ui: ReactElement,
	{
		route = '/',
		initialEntries = [route],
		wrapper,
		...options
	}: RenderWithRouterOptions = {},
) => {
	return {
		user: userEvent.setup(),
		...render(ui, {
			wrapper: ({ children }) => (
				<RouterWrapper initialEntries={initialEntries} wrapper={wrapper}>
					{children}
				</RouterWrapper>
			),
			...options,
		}),
	};
};

export const createMockFile = (
	name = 'mock-file.png',
	type = 'image/png',
	contents = 'mock-file-contents',
) => new File([contents], name, { type });

export * from '@testing-library/react';
