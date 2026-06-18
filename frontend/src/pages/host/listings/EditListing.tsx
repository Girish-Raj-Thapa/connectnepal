import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import ListingForm from '@components/host-listings/ListingForm';
import Button from '@components/button/Button';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import listingsService from '@services/listings.service';
import notification from '@utils/notifications';
import { ROUTES } from '@/constants/routes';
import type {
	ListingDetail,
	ListingImage,
	UpdateListingRequest,
} from '@/types/listings';
import type { CreateListingFormData } from '@utils/validators';

const EditListing = () => {
	const { id } = useParams<{ id: string }>();
	const listingId = Number(id);
	const navigate = useNavigate();
	const location = useLocation();

	const [listing, setListing] = useState<ListingDetail | null>(null);
	const [images, setImages] = useState<ListingImage[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchError, setFetchError] = useState('');

	const mapListingToForm = useCallback((data: ListingDetail): CreateListingFormData => ({
		title: data.title ?? '',
		description: data.description ?? '',
		destination: data.destination ?? '',
		location: data.location ?? '',
		category: data.category ?? '',
		activityType: data.activityType ?? '',
		pricePerPerson: data.pricePerPerson ?? '',
		durationDays: data.durationDays ?? 0,
		durationNights: data.durationNights ?? 0,
		difficultyLevel: data.difficultyLevel ?? '',
		idealFor: data.idealFor ?? [],
		tags: data.tags ?? [],
		maxGroupSize: data.maxGroupSize ?? 10,
		minGroupSize: data.minGroupSize ?? 1,
		whatToBring: data.whatToBring ?? '',
		requirements: data.requirements ?? '',
		inclusions: data.inclusions ?? [],
		exclusions: data.exclusions ?? [],
		cancellationPolicy: data.cancellationPolicy ?? 'moderate',
		languagesOffered: data.languagesOffered ?? [],
		bestSeasons: data.bestSeasons ?? [],
		instantBooking: data.instantBooking ?? false,
	}), []);

	const fetchListing = useCallback(
		async (quiet = false) => {
			if (!Number.isFinite(listingId)) {
				setFetchError('Invalid listing id.');
				setLoading(false);
				return;
			}

			if (!quiet) {
				setLoading(true);
				setFetchError('');
			}

			try {
				const data = await listingsService.getMyListing(listingId);
				setListing(data);
				setImages(data.images ?? []);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load listing';
				if (quiet) {
					notification.error(message);
				} else {
					setFetchError(message);
				}
			} finally {
				if (!quiet) {
					setLoading(false);
				}
			}
		},
		[listingId],
	);

	useEffect(() => {
		void fetchListing();
	}, [fetchListing]);

	const handleImagesChange = () => {
		void fetchListing(true);
	};

	const handleUpdateSubmit = async (formData: CreateListingFormData): Promise<boolean> => {
		if (!Number.isFinite(listingId)) {
			throw new Error('Invalid listing id.');
		}

		try {
			const request: UpdateListingRequest = {
				title: formData.title,
				description: formData.description,
				destination: formData.destination,
				location: formData.location,
				category: formData.category as UpdateListingRequest['category'],
				activityType: formData.activityType as UpdateListingRequest['activityType'],
				pricePerPerson: formData.pricePerPerson,
				durationDays: formData.durationDays,
				durationNights: formData.durationNights,
				idealFor: (formData.idealFor ?? []) as UpdateListingRequest['idealFor'],
				tags: formData.tags ?? [],
				maxGroupSize: formData.maxGroupSize,
				minGroupSize: formData.minGroupSize,
				whatToBring: formData.whatToBring ?? '',
				requirements: formData.requirements ?? '',
				inclusions: formData.inclusions ?? [],
				exclusions: formData.exclusions ?? [],
				cancellationPolicy:
					formData.cancellationPolicy as UpdateListingRequest['cancellationPolicy'],
				languagesOffered: formData.languagesOffered ?? [],
				bestSeasons: (formData.bestSeasons ?? []) as UpdateListingRequest['bestSeasons'],
				instantBooking: formData.instantBooking,
			};

			if (formData.difficultyLevel) {
				request.difficultyLevel =
					formData.difficultyLevel as UpdateListingRequest['difficultyLevel'];
			}

			await listingsService.updateListing(listingId, request);
			notification.success('Listing updated successfully!');
			void navigate(ROUTES.HOST_LISTINGS);
			return true;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update listing';
			notification.error(message);
			throw err instanceof Error ? err : new Error(message);
		}
	};

	if (loading) {
		return (
			<DashboardLayout key={location.pathname}>
				<div className="flex justify-center py-20">
					<Loader size="lg" text="Loading..." />
				</div>
			</DashboardLayout>
		);
	}

	if (fetchError || !listing) {
		return (
			<DashboardLayout key={location.pathname}>
				<div className="max-w-2xl">
					<FormErrorBanner>{fetchError || 'Listing not found.'}</FormErrorBanner>
					<div className="mt-4">
						<Link to={ROUTES.HOST_LISTINGS}>
							<Button variant="secondary" type="button">
								Back to Listings
							</Button>
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout key={location.pathname}>
			<div className="flex items-center gap-2 text-sm text-ink-muted mb-3">
				<Link to={ROUTES.HOST_LISTINGS} className="hover:text-teal-600">
					Manage Listings
				</Link>
				<span>/</span>
				<span className="text-ink font-medium">Edit Listing</span>
			</div>

			<div className="mb-6">
				<h1 className="page-heading text-ink mb-1">
					Edit Listing
				</h1>
				<p className="page-subtext">
					Update your listing details and manage images
				</p>
			</div>

			<ListingForm
				mode="edit"
				initialValues={mapListingToForm(listing)}
				onSubmit={handleUpdateSubmit}
				cancelTo={ROUTES.HOST_LISTINGS}
				images={images}
				listingId={listingId}
				onImagesChange={handleImagesChange}
			/>
		</DashboardLayout>
	);
};

export default EditListing;
