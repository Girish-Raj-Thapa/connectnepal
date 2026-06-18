import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import AppRoutes from '@routes/AppRoutes';
import { toasterProps } from '@utils/notifications';

const ChatWidget = lazy(() => import('@components/chatbot/ChatWidget'));

const App = () => {
	return (
		<>
			<Toaster
				position={toasterProps.position}
				toastOptions={toasterProps.toastOptions}
			/>
			<AppRoutes />
			<Suspense fallback={null}>
				<ChatWidget />
			</Suspense>
		</>
	);
};

export default App;
