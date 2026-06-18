import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import VerificationBanner from '@components/host/VerificationBanner';
import ListingForm from '@components/host-listings/ListingForm';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import listingsService from '@services/listings.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import type { CreateListingRequest, HostLimits } from '@/types/listings';
import type { CreateListingFormData } from '@utils/validators';

const CreateListing = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const [limits, setLimits] = useState<HostLimits | null>(null);
	const [limitsLoading, setLimitsLoading] = useState(true);

	const [imageFiles, setImageFiles] = useState<File[]>([]);
	const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

	const fetchLimits = useCallback(async () => {
		try {
			const data = await listingsService.getMyLimits();
			setLimits(data);
		} catch {
			// Non-critical: server will reject if over limit.
		} finally {
			setLimitsLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchLimits();
	}, [fetchLimits]);

	const isBlocked = limits !== null && !limits.canCreate;

	const handleCreateSubmit = async (formData: CreateListingFormData): Promise<boolean> => {
		try {
			const request: CreateListingRequest = {
				title: formData.title,
				description: formData.description,
				destination: formData.destination,
				location: formData.location,
				category: formData.category as CreateListingRequest['category'],
				activityType: formData.activityType as CreateListingRequest['activityType'],
				pricePerPerson: formData.pricePerPerson,
				durationDays: formData.durationDays,
				durationNights: formData.durationNights,
				...(formData.difficultyLevel
					? {
							difficultyLevel:
								formData.difficultyLevel as CreateListingRequest['difficultyLevel'],
						}
					: {}),
				...(formData.idealFor?.length
					? { idealFor: formData.idealFor as CreateListingRequest['idealFor'] }
					: {}),
				...(formData.tags?.length ? { tags: formData.tags } : {}),
				maxGroupSize: formData.maxGroupSize,
				minGroupSize: formData.minGroupSize,
				...(formData.whatToBring ? { whatToBring: formData.whatToBring } : {}),
				...(formData.requirements ? { requirements: formData.requirements } : {}),
				...(formData.inclusions?.length ? { inclusions: formData.inclusions } : {}),
				...(formData.exclusions?.length ? { exclusions: formData.exclusions } : {}),
				...(formData.cancellationPolicy
					? {
							cancellationPolicy:
								formData.cancellationPolicy as CreateListingRequest['cancellationPolicy'],
						}
					: {}),
				...(formData.languagesOffered?.length
					? { languagesOffered: formData.languagesOffered }
					: {}),
				...(formData.bestSeasons?.length
					? { bestSeasons: formData.bestSeasons as CreateListingRequest['bestSeasons'] }
					: {}),
				instantBooking: formData.instantBooking,
			};

			const listing = await listingsService.createListing(request);

			for (let i = 0; i < imageFiles.length; i++) {
				await listingsService.uploadListingImage(listing.id, imageFiles[i], {
					isPrimary: i === primaryImageIndex,
					order: i,
				});
			}

			notification.success('Listing created successfully!');
			void navigate(ROUTES.HOST_LISTINGS);
			return true;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create listing';
			notification.error(message);
			throw err instanceof Error ? err : new Error(message);
		}
	};

	if (limitsLoading) {
		return (
			<DashboardLayout key={location.pathname}>
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading..." />
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout key={location.pathname}>
			<VerificationBanner isVerified={limits?.isVerified} />
			<div className="flex items-center gap-2 text-sm text-ink-muted mb-3">
				<Link to={ROUTES.HOST_LISTINGS} className="hover:text-teal-600">
					Manage Listings
				</Link>
				<span>/</span>
				<span className="text-ink font-medium">Create New Listing</span>
			</div>

			<div className="mb-6">
				<h1 className="page-heading text-ink mb-1">
					Create New Listing
				</h1>
				<p className="page-subtext">
					Fill in the details to create a new experience listing
				</p>
			</div>

			{isBlocked && (
				<div className="mb-6">
					<FormErrorBanner>
						You've reached the limit of {limits.listingsLimit} listings. Verify your
						account to create more.
					</FormErrorBanner>
				</div>
			)}

			<ListingForm
				mode="create"
				onSubmit={handleCreateSubmit}
				submitDisabled={isBlocked}
				cancelTo={ROUTES.HOST_LISTINGS}
				createImageFiles={imageFiles}
				createPrimaryImageIndex={primaryImageIndex}
				onCreateImagesChange={setImageFiles}
				onCreatePrimaryImageChange={setPrimaryImageIndex}
			/>
		</DashboardLayout>
	);
};

export default CreateListing;
