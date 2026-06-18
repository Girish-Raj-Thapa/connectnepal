import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import PackageForm from '@components/packages/PackageForm';
import packagesService from '@services/packages.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import type { PackageFormData } from '@utils/validators/packages';


const CreatePackage = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [stagedImageFile, setStagedImageFile] = useState<File | null>(null);

	const handleSubmit = async (data: PackageFormData) => {
		try {
			setIsSubmitting(true);
			setSubmitError('');
			const pkg = await packagesService.createPackage({
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
				listingIds: data.listingIds,
			});
			if (stagedImageFile) {
				await packagesService.uploadCoverImage(pkg.id, stagedImageFile);
			}
			notification.success('Package created successfully!');
			void navigate(ROUTES.HOST_PACKAGES);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : 'Failed to create package',
			);
		} finally {
			setIsSubmitting(false);
		}
	};


	return (
		<DashboardLayout key={location.pathname}>

			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-sm text-ink-muted mb-3">
				<Link to={ROUTES.HOST_PACKAGES} className="hover:text-teal-600">
					Manage Packages
				</Link>
				<span>/</span>
				<span className="text-ink font-medium">Create New Package</span>
			</div>

			{/* Header */}
			<div className="mb-6">
				<h1 className="page-heading text-ink mb-1">
					Create New Package
				</h1>
				<p className="page-subtext">
					Bundle multiple experiences together with a discounted price
				</p>
			</div>

			<PackageForm
				mode="create"
				onSubmit={handleSubmit}
				isSubmitting={isSubmitting}
				submitError={submitError}
				onImageFileChange={(file) => setStagedImageFile(file)}
			/>

		</DashboardLayout>
	);
};

export default CreatePackage;
