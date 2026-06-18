import type { Review } from '@/types/reviews';

type ReviewTarget = Pick<
	Review,
	'listingId' | 'packageId' | 'listingTitle' | 'packageTitle'
>;

export const getReviewItemType = (review: ReviewTarget): 'Listing' | 'Package' | 'Item' => {
	if (review.packageId || review.packageTitle) {
		return 'Package';
	}
	if (review.listingId || review.listingTitle) {
		return 'Listing';
	}
	return 'Item';
};

export const getReviewItemTitle = (review: ReviewTarget): string => {
	if (review.packageTitle?.trim()) {
		return review.packageTitle.trim();
	}
	if (review.listingTitle?.trim()) {
		return review.listingTitle.trim();
	}
	if (review.packageId) {
		return `Package #${review.packageId}`;
	}
	if (review.listingId) {
		return `Listing #${review.listingId}`;
	}
	return 'Untitled item';
};
