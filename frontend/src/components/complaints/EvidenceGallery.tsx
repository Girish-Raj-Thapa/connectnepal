import { FileImage, Download } from 'lucide-react';
import type { ComplaintEvidence } from '@/types/complaints';
import { timeAgo } from '@utils/format';
import { resolveMediaUrl } from '@utils/media';

interface Props {
    evidences: ComplaintEvidence[];
}

const EvidenceGallery = ({ evidences }: Props) => {
    if (evidences.length === 0) {
        return (
            <p className="text-sm text-ink-muted italic">No evidence uploaded yet.</p>
        );
    }

    return (
        <div className="space-y-3">
            {evidences.map((ev) => {
                const fileUrl = resolveMediaUrl(ev.fileUrl);
                const isImage = ev.fileType.startsWith('image/');

                return (
                    <div
                        key={ev.id}
                        className="flex items-start gap-3 p-3 bg-surface-muted rounded-lg"
                    >
                        {isImage && fileUrl ? (
                            <img
                                src={fileUrl}
                                alt={ev.fileName}
                                className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-surface-raised rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileImage className="w-6 h-6 text-ink-muted" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                                {ev.fileName}
                            </p>
                            {ev.description && (
                                <p className="text-xs text-ink-muted mt-0.5">
                                    {ev.description}
                                </p>
                            )}
                            <p className="text-xs text-ink-muted mt-1">
                                {ev.uploaderName} &middot; {timeAgo(ev.createdAt)}
                            </p>
                        </div>
                        {fileUrl && (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-ink-muted hover:text-teal-600"
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default EvidenceGallery;
