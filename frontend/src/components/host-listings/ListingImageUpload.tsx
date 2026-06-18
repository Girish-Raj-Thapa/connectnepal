import { useRef, useMemo, useEffect, useState } from 'react';
import { ImagePlus, X, Star } from 'lucide-react';

interface ListingImageUploadProps {
	files: File[];
	onChange: (files: File[]) => void;
	primaryIndex: number;
	onPrimaryChange: (index: number) => void;
	error?: string;
	max?: number;
}

const ListingImageUpload = ({
	files,
	onChange,
	primaryIndex,
	onPrimaryChange,
	error,
	max = 10,
}: ListingImageUploadProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [localError, setLocalError] = useState('');

	const MAX_FILE_SIZE = 2 * 1024 * 1024;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

	const previews = useMemo(
		() => files.map((f) => URL.createObjectURL(f)),
		[files],
	);

	useEffect(() => {
		return () => previews.forEach((url) => URL.revokeObjectURL(url));
	}, [previews]);

	const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files;
		if (!selected) return;
		setLocalError('');

		const availableSlots = max - files.length;
		if (availableSlots <= 0) {
			setLocalError(`You can upload a maximum of ${max} images.`);
			e.target.value = '';
			return;
		}

		const validFiles: File[] = [];
		let invalidType = false;
		let invalidSize = false;

		for (const file of Array.from(selected)) {
			if (!ACCEPTED_TYPES.includes(file.type)) {
				invalidType = true;
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				invalidSize = true;
				continue;
			}
			if (validFiles.length < availableSlots) {
				validFiles.push(file);
			}
		}

		if (validFiles.length > 0) {
			onChange([...files, ...validFiles]);
		}

		if (invalidType || invalidSize) {
			const parts = [];
			if (invalidType) parts.push('Only JPEG, PNG, or WebP images are allowed.');
			if (invalidSize) parts.push('Each image must be under 2MB.');
			setLocalError(parts.join(' '));
		} else if (validFiles.length < Array.from(selected).length) {
			setLocalError(`Only ${availableSlots} more image${availableSlots === 1 ? '' : 's'} can be added.`);
		}

		// Reset so the same file can be re-selected
		e.target.value = '';
	};

	const removeFile = (index: number) => {
		const updated = files.filter((_, i) => i !== index);
		onChange(updated);
		// Adjust primary index
		if (index === primaryIndex) {
			onPrimaryChange(0);
		} else if (index < primaryIndex) {
			onPrimaryChange(primaryIndex - 1);
		}
	};

	return (
		<div className="w-full">
			<label className="block text-xs font-semibold text-ink-secondary mb-2">
				Images <span className="text-ink-muted font-normal">(max {max}, first is primary)</span>
			</label>

			{/* Upload zone */}
			{files.length < max && (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="w-full border-2 border-dashed border-line rounded-xl p-6 text-center
						hover:border-tealbrand transition-colors cursor-pointer mb-3"
				>
					<ImagePlus className="w-8 h-8 mx-auto text-ink-muted mb-2" />
					<p className="text-sm text-ink-muted">Click to upload images</p>
					<p className="text-xs text-ink-muted mt-1">
						JPEG, PNG, WebP — max 2MB each
					</p>
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				onChange={handleFiles}
				className="hidden"
			/>

			{/* Previews */}
			{files.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{previews.map((url, i) => (
						<div
							key={i}
							className={`relative group rounded-xl overflow-hidden border-2 ${
								i === primaryIndex
									? 'border-tealbrand'
									: 'border-line'
							}`}
						>
							<img
								src={url}
								alt={`Upload ${i + 1}`}
								className="w-full h-28 object-cover"
							/>

							{/* Primary badge */}
							{i === primaryIndex && (
								<span className="absolute top-1.5 left-1.5 bg-tealbrand text-white text-[10px]
									font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
									<Star className="w-3 h-3 fill-white" /> Primary
								</span>
							)}

							{/* Hover overlay */}
							<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
								transition-opacity flex items-center justify-center gap-2">
								{i !== primaryIndex && (
									<button
										type="button"
										onClick={() => onPrimaryChange(i)}
										className="p-1.5 bg-surface rounded-lg text-tealbrand hover:bg-surface-muted
											transition-colors"
										title="Set as primary"
									>
										<Star className="w-4 h-4" />
									</button>
								)}
								<button
									type="button"
									onClick={() => removeFile(i)}
									className="p-1.5 bg-surface rounded-lg text-red-500 hover:bg-surface-muted
										transition-colors"
									title="Remove"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
			{!error && localError && (
				<p className="text-red-500 text-xs mt-1">{localError}</p>
			)}
		</div>
	);
};

export default ListingImageUpload;
