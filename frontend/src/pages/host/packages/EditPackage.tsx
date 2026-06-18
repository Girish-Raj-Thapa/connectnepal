import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import PackageForm from '@components/packages/PackageForm';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import packagesService from '@services/packages.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import type { PackageFormData } from '@utils/validators/packages';
import type { PackageDetail } from '@/types/packages';


// Map API detail → form initial values
function buildInitialValues(detail: PackageDetail): Partial<PackageFormData> {
	return {
		title: detail.title,
		description: detail.description,
		durationDays: detail.durationDays,
		durationNights: detail.durationNights,
		totalPrice: detail.totalPrice,
		discountLabel: detail.discountLabel ?? '',
		maxGroupSize: detail.maxGroupSize,
		maxBookings: detail.maxBookings ?? undefined,
		tags: detail.tags,
		inclusions: detail.inclusions,
		highlights: detail.highlights ?? '',
		termsAndConditions: detail.termsAndConditions ?? '',
		validFrom: detail.validFrom ?? null,
		validUntil: detail.validUntil ?? null,
		isBookable: detail.isBookable,
		listingIds: detail.packageListings.map((pl) => pl.listingId),
	};
}


const EditPackage = () => {
	const { id } = useParams<{ id: string }>();
	const packageId = Number(id);
	const navigate = useNavigate();
	const location = useLocation();

	// ── State ────────────────────────────────────────────
	const [pkg, setPkg] = useState<PackageDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [fetchError, setFetchError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [isUploadingImage, setIsUploadingImage] = useState(false);


	// ── Fetch package on mount ────────────────────────────
	useEffect(() => {
		if (!Number.isFinite(packageId)) {
			setFetchError('Invalid package ID.');
			setLoading(false);
			return;
		}

		const load = async () => {
			try {
				const data = await packagesService.getPackageById(packageId);
				setPkg(data);
			} catch (err) {
				setFetchError(
					err instanceof Error ? err.message : 'Failed to load package',
				);
			} finally {
				setLoading(false);
			}
		};

		void load();
	}, [packageId]);


	// ── Cover image: upload/remove immediately ───────────
	const handleImageFileChange = async (file: File | null) => {
		if (!Number.isFinite(packageId)) return;
		setIsUploadingImage(true);
		try {
			if (file) {
				const updated = await packagesService.uploadCoverImage(packageId, file);
				setPkg(updated);
				notification.success('Cover image updated.');
			} else {
				await packagesService.removeCoverImage(packageId);
				setPkg((prev) => prev ? { ...prev, coverImageUrl: null } : prev);
				notification.success('Cover image removed.');
			}
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Image operation failed.');
		} finally {
			setIsUploadingImage(false);
		}
	};

	// ── Submit: PATCH scalars → PUT listings ─────────────
	const handleSubmit = async (data: PackageFormData) => {
		if (!Number.isFinite(packageId)) return;
		try {
			setIsSubmitting(true);
			setSubmitError('');

			// Step 1: update all scalar fields (including isBookable)
			await packagesService.updatePackage(packageId, {
				title: data.title,
				description: data.description,
				durationDays: data.durationDays,
				durationNights: data.durationNights,
				totalPrice: data.totalPrice,
				discountLabel: data.discountLabel || undefined,
				maxGroupSize: data.maxGroupSize,
				maxBookings: data.maxBookings ?? null,
				tags: data.tags?.length ? data.tags : undefined,
				inclusions: data.inclusions?.length ? data.inclusions : undefined,
				highlights: data.highlights || undefined,
				termsAndConditions: data.termsAndConditions || undefined,
				validFrom: data.validFrom || null,
				validUntil: data.validUntil || null,
				isBookable: data.isBookable,
			});

			// Step 2: bulk-replace the listing set (PUT is atomic)
			await packagesService.setPackageListings(packageId, data.listingIds);

			notification.success('Package updated successfully!');
			void navigate(ROUTES.HOST_PACKAGES);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : 'Failed to update package',
			);
		} finally {
			setIsSubmitting(false);
		}
	};


	// ── Loading state ─────────────────────────────────────
	if (loading) {
		return (
			<DashboardLayout key={location.pathname}>
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading package..." />
				</div>
			</DashboardLayout>
		);
	}

	// ── Fetch error state ─────────────────────────────────
	if (fetchError || !pkg) {
		return (
			<DashboardLayout key={location.pathname}>
				<div className="max-w-2xl">
					<FormErrorBanner>{fetchError || 'Package not found.'}</FormErrorBanner>
					<div className="mt-4">
						<Link to={ROUTES.HOST_PACKAGES}>
							<Button variant="secondary" type="button">
								Back to Packages
							</Button>
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}


	return (
		<DashboardLayout key={location.pathname}>

			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-sm text-ink-muted mb-3">
				<Link to={ROUTES.HOST_PACKAGES} className="hover:text-teal-600">
					Manage Packages
				</Link>
				<span>/</span>
				<span className="text-ink font-medium">Edit Package</span>
			</div>

			{/* Header */}
			<div className="mb-6">
				<h1 className="page-heading text-ink mb-1">
					Edit Package
				</h1>
				<p className="page-subtext">{pkg.title}</p>
			</div>

				{/* Unavailable listings warning */}
			{pkg.hasUnavailableListings && (
				<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
					<div className="flex items-start gap-3">
						<AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-semibold text-amber-800 mb-1">
								Some included listings are unavailable
							</p>
							<ul className="space-y-1">
								{pkg.packageListings
									.filter((pl) => !pl.isAvailableForPackage)
									.map((pl) => (
										<li key={pl.id} className="text-xs text-amber-700">
											<span className="font-medium">{pl.title}</span>
											{pl.availabilityMessage && ` — ${pl.availabilityMessage}`}
										</li>
									))}
							</ul>
						</div>
					</div>
				</div>
			)}

			<PackageForm
				mode="edit"
				initialValues={buildInitialValues(pkg)}
				initialSelectedListings={pkg.packageListings.map((listing) => ({
					id: listing.listingId,
					title: listing.title,
					categoryDisplay: listing.category,
					durationDisplay: `${listing.durationDays} day${listing.durationDays === 1 ? '' : 's'}`,
					pricePerPerson: listing.pricePerPerson,
					isAvailableForPackage: listing.isAvailableForPackage,
					availabilityMessage: listing.availabilityMessage,
				}))}
				onSubmit={handleSubmit}
				isSubmitting={isSubmitting}
				submitError={submitError}
				publishIssue={pkg.publishIssue}
				coverImageUrl={pkg.coverImageUrl}
				onImageFileChange={(file) => { void handleImageFileChange(file); }}
				isUploadingImage={isUploadingImage}
			/>

		</DashboardLayout>
	);
};

export default EditPackage;
