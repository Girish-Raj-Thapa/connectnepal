import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '@components/button/Button';

interface ConfirmModalProps {
	open: boolean;
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	loading?: boolean;
	variant?: 'danger' | 'primary';
	onConfirm: () => void;
	onCancel: () => void;
}

const ConfirmModal = ({
	open,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	loading = false,
	variant = 'danger',
	onConfirm,
	onCancel,
}: ConfirmModalProps) => {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="bg-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
				<div className="flex items-start gap-3 mb-4">
					{variant === 'danger' && (
						<div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
							<AlertTriangle className="w-5 h-5 text-red-600" />
						</div>
					)}
					<div>
						<h3 className="card-heading text-ink">{title}</h3>
						<div className="text-sm text-ink-muted mt-1">{message}</div>
					</div>
				</div>
				<div className="flex gap-3 mt-6">
					<Button
						variant="secondary"
						fullWidth
						onClick={onCancel}
						disabled={loading}
					>
						{cancelLabel}
					</Button>
					<Button
						variant={variant}
						fullWidth
						loading={loading}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ConfirmModal;
