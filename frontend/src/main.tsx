import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@context/AuthContext';
import { ThemeProvider } from '@context/ThemeContext';
import ErrorBoundary from '@components/common/ErrorBoundary';
import { NotificationsProvider } from '@context/NotificationsContext';
import { ChatProvider } from '@context/ChatContext';
import { ConfirmProvider } from '@context/ConfirmContext';
import App from './App';
import './index.css';

// Catch unhandled promise rejections globally.
// In prod: replace console.error with Sentry.captureException when Sentry is added.
window.addEventListener('unhandledrejection', (event) => {
  if (import.meta.env.DEV) {
    console.error('[Unhandled Rejection]', event.reason);
  }
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<ThemeProvider>
					<AuthProvider>
						<NotificationsProvider>
							<ChatProvider>
							<ConfirmProvider>
								<App />
							</ConfirmProvider>
							</ChatProvider>
						</NotificationsProvider>
					</AuthProvider>
				</ThemeProvider>
			</BrowserRouter>
		</ErrorBoundary>	
	</StrictMode>
);
