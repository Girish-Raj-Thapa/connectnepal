import * as yup from 'yup';

export const createTripPlanSchema = yup
	.object({
		title: yup
			.string()
			.required('Title is required')
			.min(3, 'Title must be at least 3 characters')
			.trim(),
		totalDays: yup
			.number()
			.required('Number of days is required')
			.min(1, 'Must be at least 1 day')
			.max(30, 'Cannot exceed 30 days')
			.integer('Must be a whole number'),
		travellersCount: yup
			.number()
			.required('Number of travellers is required')
			.min(1, 'Must be at least 1 traveller')
			.max(50, 'Cannot exceed 50 travellers')
			.integer('Must be a whole number'),
		startDate: yup.string().optional().nullable().default(null),
		endDate: yup
			.string()
			.optional()
			.nullable()
			.default(null)
			.test(
				'end-after-start',
				'End date must be after start date',
				function (value) {
					const { startDate } = this.parent as { startDate?: string | null };
					if (!value || !startDate) return true;
					return new Date(value) >= new Date(startDate);
				},
			),
	})
	.required();

export type CreateTripPlanFormData = yup.InferType<typeof createTripPlanSchema>;

export const addExperienceSchema = yup
	.object({
		listingId: yup
			.number()
			.required('Please select an experience')
			.positive('Please select an experience'),
		dayNumber: yup
			.number()
			.required('Day is required')
			.min(1, 'Day must be at least 1')
			.integer('Must be a whole number'),
	})
	.required();

export type AddExperienceFormData = yup.InferType<typeof addExperienceSchema>;
