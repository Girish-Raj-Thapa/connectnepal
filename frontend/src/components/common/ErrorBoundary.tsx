import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// In dev: log to console for debugging
		// In prod: replace with Sentry.captureException(error, { extra: info }) when Sentry is added
		if (import.meta.env.DEV) {
			console.error('[ErrorBoundary] Uncaught error:', error, info);
		}
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-surface-muted">
					<div className="text-center p-8 max-w-md">
						<h1 className="page-heading text-ink mb-2">
							Something went wrong
						</h1>
						<p className="page-subtext mb-6">
							An unexpected error occurred. Please refresh the page.
						</p>
						<button
							onClick={() => window.location.reload()}
							className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors"
						>
							Refresh Page
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

export default ErrorBoundary;
