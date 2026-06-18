import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import ConfirmModal from '@components/common/ConfirmModal';

export interface ConfirmOptions {
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'danger' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
	const [open, setOpen] = useState(false);
	const [options, setOptions] = useState<ConfirmOptions>({ title: '', message: '' });
	const resolveRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
		setOptions(opts);
		setOpen(true);
		return new Promise((resolve) => {
			resolveRef.current = resolve;
		});
	}, []);

	const handleConfirm = () => {
		setOpen(false);
		resolveRef.current?.(true);
		resolveRef.current = null;
	};

	const handleCancel = () => {
		setOpen(false);
		resolveRef.current?.(false);
		resolveRef.current = null;
	};

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<ConfirmModal
				open={open}
				title={options.title}
				message={options.message}
				confirmLabel={options.confirmLabel}
				cancelLabel={options.cancelLabel}
				variant={options.variant}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		</ConfirmContext.Provider>
	);
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = (): ConfirmFn => {
	const ctx = useContext(ConfirmContext);
	if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
	return ctx;
};
