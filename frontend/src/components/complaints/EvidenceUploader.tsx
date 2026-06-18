import { useState, useRef } from 'react';
import { Upload, X, FileImage } from 'lucide-react';
import notification from '@utils/notifications';

interface Props {
    onUpload: (file: File, description?: string) => Promise<void>;
    disabled?: boolean;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

const EvidenceUploader = ({ onUpload, disabled }: Props) => {
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (selected: File | null) => {
        if (!selected) return;
        if (!ALLOWED_TYPES.includes(selected.type)) {
            notification.error('Only JPEG and PNG images are allowed.');
            return;
        }
        if (selected.size > MAX_SIZE) {
            notification.error('File size must be under 2 MB.');
            return;
        }
        setFile(selected);
    };

    const handleSubmit = async () => {
        if (!file) return;
        try {
            setUploading(true);
            await onUpload(file, description || undefined);
            setFile(null);
            setDescription('');
            if (inputRef.current) inputRef.current.value = '';
            notification.success('Evidence uploaded successfully');
        } catch (err) {
            notification.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-surface rounded-xl border border-line p-4">
            <h4 className="text-sm font-bold text-ink mb-3">Upload Evidence</h4>

            {!file ? (
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-line rounded-lg cursor-pointer hover:border-teal-400 transition-colors">
                    <Upload className="w-8 h-8 text-ink-muted" />
                    <span className="text-sm text-ink-muted">
                        Click to upload (JPEG/PNG, max 2 MB)
                    </span>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                        disabled={disabled}
                    />
                </label>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-surface-muted rounded-lg">
                        <FileImage className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                                {file.name}
                            </p>
                            <p className="text-xs text-ink-muted">
                                {(file.size / 1024).toFixed(0)} KB
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setFile(null);
                                if (inputRef.current) inputRef.current.value = '';
                            }}
                            className="p-1 text-ink-muted hover:text-red-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder="Optional description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 text-sm border-2 border-line rounded-lg focus:border-teal-600 focus:outline-none"
                    />

                    <button
                        onClick={() => void handleSubmit()}
                        disabled={uploading || disabled}
                        className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                        {uploading ? 'Uploading...' : 'Upload Evidence'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default EvidenceUploader;
