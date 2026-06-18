import * as yup from 'yup';

export const createListingSchema = yup
	.object({
		title: yup
			.string()
			.required('Title is required')
			.min(3, 'Title must be at least 3 characters')
			.trim(),
		description: yup
			.string()
			.required('Description is required')
			.min(50, 'Description must be at least 50 characters')
			.trim(),
		destination: yup.string().required('Destination is required').trim(),
		location: yup.string().required('Location is required').trim(),
		category: yup.string().required('Category is required'),
		activityType: yup.string().required('Activity type is required'),
		pricePerPerson: yup
			.string()
			.required('Price is required')
			.test('positive', 'Price must be greater than 0', (val) => Number(val) > 0),
		durationDays: yup
			.number()
			.required('Duration days is required')
			.min(0, 'Cannot be negative')
			.integer('Must be a whole number')
			.default(0),
		durationNights: yup
			.number()
			.required('Duration nights is required')
			.min(0, 'Cannot be negative')
			.integer('Must be a whole number')
			.default(0)
			.test(
				'nights-lte-days-plus-one',
				'Nights cannot exceed days + 1',
				function (value) {
					const { durationDays } = this.parent as { durationDays: number };
					return value <= durationDays + 1;
				},
			),
		difficultyLevel: yup.string().optional().default(''),
		idealFor: yup
			.array()
			.of(yup.string().required())
			.max(6, 'Maximum 6 selections')
			.default([]),
		tags: yup
			.array()
			.of(yup.string().required())
			.max(15, 'Maximum 15 tags')
			.default([]),
		maxGroupSize: yup.number().min(1, 'Must be at least 1').integer().default(10),
		minGroupSize: yup
			.number()
			.min(1, 'Must be at least 1')
			.integer()
			.default(1)
			.test(
				'min-lte-max',
				'Min cannot exceed max group size',
				function (value) {
					const { maxGroupSize } = this.parent as { maxGroupSize: number };
					return value <= maxGroupSize;
				},
			),
		whatToBring: yup.string().trim().optional().default(''),
		requirements: yup.string().trim().optional().default(''),
		inclusions: yup
			.array()
			.of(yup.string().required())
			.max(20, 'Maximum 20 items')
			.default([]),
		exclusions: yup
			.array()
			.of(yup.string().required())
			.max(20, 'Maximum 20 items')
			.default([]),
		cancellationPolicy: yup.string().optional().default('moderate'),
		languagesOffered: yup
			.array()
			.of(yup.string().required())
			.max(10, 'Maximum 10 languages')
			.default([]),
		bestSeasons: yup.array().of(yup.string().required()).default([]),
		instantBooking: yup.boolean().default(false),
	})
	.required()
	.test(
		'duration-check',
		'At least one of days or nights must be > 0',
		function (values) {
			if (
				(values.durationDays ?? 0) === 0 &&
				(values.durationNights ?? 0) === 0
			) {
				return this.createError({
					path: 'durationDays',
					message: 'At least one of days or nights must be greater than 0',
				});
			}
			return true;
		},
	);

export type CreateListingFormData = yup.InferType<typeof createListingSchema>;