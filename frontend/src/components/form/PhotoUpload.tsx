import { useRef, useEffect, useMemo } from 'react';
import { Camera } from 'lucide-react';

interface PhotoUploadProps {
	value: File | null;
	onChange: (file: File | null) => void;
	existingUrl?: string | null;
	error?: string;
}


const PhotoUpload = ({
    value,
    onChange,
    existingUrl,
    error,
}: PhotoUploadProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
	const preview = useMemo(() => {
		if (!value) return null;
		return URL.createObjectURL(value);
	}, [value]);

    useEffect(() => {
		if (!preview) return undefined;
		return () => URL.revokeObjectURL(preview);
	}, [preview]);

    const displayUrl = preview ?? existingUrl ?? null;

	const handleClick = () => inputRef.current?.click();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] ?? null;
		onChange(file);
	};

    return (
		<div className="flex flex-col items-center gap-2">
			<button
				type="button"
				onClick={handleClick}
				className={`
					w-24 h-24 rounded-full border-2 border-dashed
					flex items-center justify-center overflow-hidden
					transition-all hover:border-tealbrand cursor-pointer
					${error ? 'border-red-400' : 'border-line'}
				`}
			>
				{displayUrl ? (
					<img
						src={displayUrl}
						alt="Profile preview"
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="flex flex-col items-center text-ink-muted">
						<Camera size={24} />
						<span className="text-[10px] mt-1">Upload</span>
					</div>
				)}
			</button>

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onChange={handleChange}
				className="hidden"
			/>

			{error && <p className="text-red-500 text-xs">{error}</p>}
		</div>
	);
};

export default PhotoUpload;
