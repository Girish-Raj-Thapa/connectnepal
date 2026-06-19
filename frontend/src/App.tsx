import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import AppRoutes from '@routes/AppRoutes';
import { FEATURE_FLAGS } from '@config/features';
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
			{FEATURE_FLAGS.chatbot && (
				<Suspense fallback={null}>
					<ChatWidget />
				</Suspense>
			)}
		</>
	);
};

export default App;
