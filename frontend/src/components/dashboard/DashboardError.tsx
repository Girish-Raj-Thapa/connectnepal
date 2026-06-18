import { AlertCircle, RefreshCw } from 'lucide-react';

interface DashboardErrorProps {
	message: string;
	onRetry: () => void;
}

const DashboardError = ({
	message,
	onRetry,
}: DashboardErrorProps) => (
	<div className="max-w-md mx-auto py-16 text-center">
		<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />

		<h2 className="section-heading text-ink mb-2">
			Failed to Load Dashboard
		</h2>

		<p className="page-subtext mb-6">
			{message}
		</p>

		<button
			onClick={onRetry}
			className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-colors"
		>
			<RefreshCw className="w-4 h-4" />
			Try Again
		</button>
	</div>
);

export default DashboardError;
