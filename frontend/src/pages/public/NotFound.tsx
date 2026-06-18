import { Link } from 'react-router-dom';
import { ROUTES } from '@constants/routes';

const NotFound = () => (
	<div className="min-h-screen flex items-center justify-center bg-surface-muted px-6">
		<div className="text-center max-w-md">
			<div className="flex justify-center mb-6">
				<div className="p-5 rounded-full bg-red-100 text-red-600">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-12 w-12"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
			</div>
			<h1 className="page-heading text-ink mb-2">Page Not Found</h1>
			<p className="page-subtext mb-6">
				The page you’re looking for doesn’t exist or may have moved.
			</p>
			<div className="flex flex-col gap-3">
				<Link
					to={ROUTES.HOME}
					className="inline-block px-4 py-2 rounded-xl bg-tealbrand text-white font-semibold hover:bg-tealbrand-dark transition"
				>
					Go Home
				</Link>
				<Link
					to={ROUTES.LOGIN}
					className="inline-block px-4 py-2 rounded-xl border border-line text-ink-secondary font-semibold hover:border-tealbrand hover:text-tealbrand transition"
				>
					Login
				</Link>
			</div>
		</div>
	</div>
);

export default NotFound;
