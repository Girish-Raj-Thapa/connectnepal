type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps {
	size?: LoaderSize;
	text?: string;
}

const sizeStyles: Record<LoaderSize, string> = {
	sm: 'h-6 w-6',
	md: 'h-10 w-10',
	lg: 'h-16 w-16',
};

const Loader = ({ size = 'md', text = 'Loading...' }: LoaderProps) => {
	return (
		<div className="flex flex-col items-center justify-center gap-3">
			<svg
				className={`animate-spin text-brand ${sizeStyles[size]}`}
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle
					className="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="4"
				/>
				<path
					className="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
			{text && <p className="text-ink-muted text-sm">{text}</p>}
		</div>
	);
};

export default Loader;
