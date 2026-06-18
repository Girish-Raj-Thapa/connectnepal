import { useEffect, useState } from 'react';
import { FileCheck, Upload, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import DocumentUpload from '@components/form/DocumentUpload';
import Button from '@components/button/Button';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Loader from '@components/feedback/Loader';
import profileService from '@services/profile.service';
import notification from '@utils/notifications';
import { resolveMediaUrl } from '@utils/media';
import type { HostDocument } from '@/types/accounts';

// ── Existing document row ─────────────────────────────────────────────────────

const DocumentRow = ({ doc }: { doc: HostDocument }) => {
	const fileUrl = resolveMediaUrl(doc.fileUrl);

	return (
		<div className="flex items-center justify-between py-3 border-b border-line last:border-0">
			<div className="flex items-center gap-3">
				<FileCheck className="w-5 h-5 text-teal-600 shrink-0" />
				<div>
					<p className="text-sm font-semibold text-ink">{doc.documentTypeDisplay}</p>
					<p className="text-xs text-ink-muted mt-0.5">
						Uploaded {format(new Date(doc.uploadedAt), 'd MMM yyyy')}
					</p>
				</div>
			</div>
			{fileUrl && (
				<a
					href={fileUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
				>
					View
				</a>
			)}
		</div>
	);
};

// ── Main component ────────────────────────────────────────────────────────────

const HostDocumentsSettingsForm = () => {
	const [documents, setDocuments] = useState<HostDocument[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const [citizenshipFile, setCitizenshipFile] = useState<File | null>(null);
	const [panFile, setPanFile] = useState<File | null>(null);
	const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);

	const hasAnyFile = citizenshipFile || panFile || businessLicenseFile;

	const existingTypes = new Set(documents.map((d) => d.documentType));

	useEffect(() => {
		const load = async () => {
			try {
				const data = await profileService.getHostDocuments();
				setDocuments(data);
			} catch (err) {
				setLoadError(err instanceof Error ? err.message : 'Failed to load documents');
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const handleUpload = async () => {
		if (!hasAnyFile) return;
		setUploading(true);
		setUploadError(null);
		try {
			const res = await profileService.uploadHostDocuments({
				citizenshipFile: citizenshipFile ?? undefined,
				panFile: panFile ?? undefined,
				businessLicenseFile: businessLicenseFile ?? undefined,
			});
			notification.success(res.message);
			// Refresh documents list
			const updated = await profileService.getHostDocuments();
			setDocuments(updated);
			setCitizenshipFile(null);
			setPanFile(null);
			setBusinessLicenseFile(null);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to upload documents';
			setUploadError(msg);
			notification.error(msg);
		} finally {
			setUploading(false);
		}
	};

	if (loading) return <div className="py-12 flex justify-center"><Loader /></div>;

	if (loadError) return (
		<div className="bg-surface rounded-xl border border-line p-6">
			<FormErrorBanner>{loadError}</FormErrorBanner>
		</div>
	);

	return (
		<div className="space-y-5">
			{/* Existing documents */}
			<div className="bg-surface rounded-xl border border-line p-6">
				<h2 className="section-heading text-ink mb-1">Uploaded Documents</h2>
				<p className="page-subtext mb-5">
					Upload all 3 documents to submit your profile for verification
				</p>

				{documents.length === 0 ? (
					<div className="flex items-center gap-2 text-ink-muted text-sm py-4">
						<AlertCircle className="w-4 h-4 shrink-0" />
						<span>No documents uploaded yet.</span>
					</div>
				) : (
					<div>
						{documents.map((doc) => (
							<DocumentRow key={doc.id} doc={doc} />
						))}
					</div>
				)}
			</div>

			{/* Upload section */}
			<div className="bg-surface rounded-xl border border-line p-6">
				<div className="flex items-center gap-2 mb-1">
					<Upload className="w-4 h-4 text-teal-600" />
					<h2 className="section-heading text-ink">
						{documents.length > 0 ? 'Replace Documents' : 'Upload Documents'}
					</h2>
				</div>
				<p className="page-subtext mb-5">
					JPEG or PNG only, max 2MB each.{' '}
					{existingTypes.size > 0 && 'Uploading a file will replace the existing one for that document type.'}
				</p>

				{uploadError && <div className="mb-4"><FormErrorBanner>{uploadError}</FormErrorBanner></div>}

				<div className="space-y-4">
					<DocumentUpload
						label={`Citizenship Document${existingTypes.has('citizenship') ? ' (replace)' : ''}`}
						value={citizenshipFile}
						onChange={setCitizenshipFile}
						accept="image/jpeg,image/png"
					/>
					<DocumentUpload
						label={`PAN Registration${existingTypes.has('pan') ? ' (replace)' : ''}`}
						value={panFile}
						onChange={setPanFile}
						accept="image/jpeg,image/png"
					/>
					<DocumentUpload
						label={`Business License${existingTypes.has('business_license') ? ' (replace)' : ''}`}
						value={businessLicenseFile}
						onChange={setBusinessLicenseFile}
						accept="image/jpeg,image/png"
					/>
				</div>

				<div className="flex justify-end pt-5">
					<Button
						type="button"
						variant="primary"
						loading={uploading}
						disabled={uploading || !hasAnyFile}
						onClick={() => void handleUpload()}
					>
						{uploading ? 'Uploading...' : 'Upload Documents'}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default HostDocumentsSettingsForm;
