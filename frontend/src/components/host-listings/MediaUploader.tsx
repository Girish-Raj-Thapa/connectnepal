import { useState, useRef } from 'react';
import { Upload, X, Star, Loader2 } from 'lucide-react';
import { useConfirm } from '@context/ConfirmContext';
import listingsService from '@services/listings.service';
import notification from '@utils/notifications';
import type { ListingImage } from '@/types/listings';


interface MediaUploaderProps {
    listingId: number;
    images: ListingImage[];
    onImagesChange: () => void;
    disabled?: boolean;
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];


const MediaUploader = ({
    listingId,
    images,
    onImagesChange,
    disabled = false,
}: MediaUploaderProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
	const confirm = useConfirm();
	const [uploading, setUploading] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);

	const canUploadMore = images.length < MAX_IMAGES;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate type
		if (!ACCEPTED_TYPES.includes(file.type)) {
			notification.error('Only JPEG, PNG, and WebP images are allowed.');
			return;
		}

		// Validate size
		if (file.size > MAX_FILE_SIZE) {
			notification.error('Image must be under 2MB.');
			return;
		}

		setUploading(true);
		try {
			const isPrimary = images.length === 0; // First image becomes primary
			await listingsService.uploadListingImage(listingId, file, { isPrimary });
			notification.success('Image uploaded!');
			onImagesChange();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Upload failed';
			notification.error(message);
		} finally {
			setUploading(false);
			// Reset input so same file can be re-selected
			if (inputRef.current) inputRef.current.value = '';
		}
	};

	const handleDelete = async (imageId: number) => {
		const confirmed = await confirm({
			title: 'Delete Image',
			message: 'Are you sure you want to delete this image? This cannot be undone.',
			confirmLabel: 'Delete',
		});
		if (!confirmed) return;
		setDeletingId(imageId);
		try {
			await listingsService.deleteListingImage(listingId, imageId);
			notification.success('Image deleted.');
			onImagesChange();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Delete failed';
			notification.error(message);
		} finally {
			setDeletingId(null);
		}
	};

	const handleSetPrimary = async (imageId: number) => {
		setSettingPrimaryId(imageId);
		try {
			await listingsService.setPrimaryImage(listingId, imageId);
			notification.success('Primary image updated.');
			onImagesChange();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to set primary';
			notification.error(message);
		} finally {
			setSettingPrimaryId(null);
		}
	};

	return (
		<div>
			<p className="text-sm text-ink-muted mb-3">
				{images.length} / {MAX_IMAGES} images
			</p>

			{/* Image grid */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
				{images.map((img) => (
					<div
						key={img.id}
						className={`relative rounded-lg overflow-hidden border-2 aspect-video ${
							img.isPrimary ? 'border-teal-500' : 'border-line'
						}`}
					>
						<img
							src={img.thumbnailUrl}
							alt={img.altText || img.caption || 'Listing image'}
							className="w-full h-full object-cover"
						/>

						{/* Primary badge */}
						{img.isPrimary && (
							<span className="absolute top-1 left-1 bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
								Primary
							</span>
						)}

						{/* Action buttons */}
						<div className="absolute top-1 right-1 flex gap-1">
							{!img.isPrimary && (
								<button
									type="button"
									onClick={() => void handleSetPrimary(img.id)}
									disabled={disabled || settingPrimaryId === img.id}
									className="p-1 bg-white/90 rounded hover:bg-surface text-ink-muted hover:text-teal-600"
									title="Set as primary"
								>
									{settingPrimaryId === img.id ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Star className="w-3.5 h-3.5" />
									)}
								</button>
							)}
							<button
								type="button"
								onClick={() => { void handleDelete(img.id); }}
								disabled={disabled || deletingId === img.id}
								className="p-1 bg-white/90 rounded hover:bg-surface text-ink-muted hover:text-red-600"
								title="Delete image"
							>
								{deletingId === img.id ? (
									<Loader2 className="w-3.5 h-3.5 animate-spin" />
								) : (
									<X className="w-3.5 h-3.5" />
								)}
							</button>
						</div>
					</div>
				))}
			</div>

			{/* Upload zone */}
			{canUploadMore && (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={disabled || uploading}
					className="w-full border-2 border-dashed border-line rounded-lg p-6 text-center hover:border-teal-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{uploading ? (
						<>
							<Loader2 className="w-8 h-8 mx-auto text-teal-600 mb-2 animate-spin" />
							<p className="text-sm text-ink-muted">Uploading...</p>
						</>
					) : (
						<>
							<Upload className="w-8 h-8 mx-auto text-ink-muted mb-2" />
							<p className="text-sm text-ink-muted mb-1">
								Click to upload
							</p>
							<p className="text-xs text-ink-muted">
								JPEG, PNG, or WebP up to 2MB
							</p>
						</>
					)}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onChange={(e) => void handleFileSelect(e)}
				className="hidden"
			/>

		</div>
	);
};

export default MediaUploader;