import { useRef } from "react";
import { Upload, FileCheck } from "lucide-react";

interface DocumentUploadProps {
    label: string;
    value: File | null;
    onChange: (file: File | null) => void;
    error?: string;
    required?: boolean;
    accept?: string;
}

const DocumentUpload = ({
    label,
    value,
    onChange,
    error,
    required=false,
    accept = 'image/jepg,image/png,image/webp'
}: DocumentUploadProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

	const handleClick = () => inputRef.current?.click();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] ?? null;
		onChange(file);
	};

	return (
		<div className="w-full">
			{label && (
				<label className="block text-xs font-semibold text-ink-secondary mb-1">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<button
				type="button"
				onClick={handleClick}
				className={`
					w-full border-2 border-dashed rounded-xl py-6
					flex flex-col items-center justify-center
					transition-all cursor-pointer
					${error
						? 'border-red-400 hover:border-red-500'
						: value
							? 'border-tealbrand bg-tealbrand-light/30'
							: 'border-line hover:border-tealbrand'
					}
				`}
			>
				{value ? (
					<div className="flex flex-col items-center text-tealbrand">
						<FileCheck size={24} className="mb-2" />
						<span className="text-sm font-medium">{value.name}</span>
						<span className="text-xs text-ink-muted mt-1">
							Click to replace
						</span>
					</div>
				) : (
					<div className="flex flex-col items-center text-ink-muted">
						<Upload size={24} className="mb-2" />
						<span className="text-sm text-ink-muted">
							Click to upload or drag & drop
						</span>
					</div>
				)}
			</button>

			<input
				ref={inputRef}
				type="file"
				accept={accept}
				onChange={handleChange}
				className="hidden"
			/>

			{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
		</div>
	);
};

export default DocumentUpload;