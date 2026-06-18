import Loader from './Loader';

/**
 * Full-page loader to keep route-level fallbacks consistent.
 */
const PageLoader = ({ text = 'Loading...' }: { text?: string }) => (
	<div className="min-h-screen flex items-center justify-center">
		<Loader size="lg" text={text} />
	</div>
);

export default PageLoader;
