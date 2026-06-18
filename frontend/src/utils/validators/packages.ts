import * as yup from 'yup';

export const packageSchema = yup
	.object({
		title: yup
			.string()
			.required('Package name is required')
			.min(3, 'Name must be at least 3 characters')
			.max(200, 'Name must be 200 characters or less')
			.trim(),

		description: yup
			.string()
			.required('Description is required')
			.min(20, 'Description must be at least 20 characters')
			.trim(),

		durationDays: yup
			.number()
			.required('Total days is required')
			.min(1, 'Must be at least 1 day')
			.integer('Must be a whole number')
			.typeError('Total days is required'),

		durationNights: yup
			.number()
			.required('Total nights is required')
			.min(0, 'Cannot be negative')
			.integer('Must be a whole number')
			.typeError('Total nights is required')
			.default(0),

		totalPrice: yup
			.string()
			.required('Package price is required')
			.test('positive', 'Price must be greater than 0', (val) => Number(val) > 0),

		discountLabel: yup
			.string()
			.trim()
			.max(20, 'Discount label must be 20 characters or less')
			.optional()
			.default(''),

		maxGroupSize: yup
			.number()
			.required('Max group size is required')
			.min(1, 'Must be at least 1')
			.integer('Must be a whole number')
			.typeError('Max group size is required')
			.default(8),

		maxBookings: yup
			.number()
			.nullable()
			.optional()
			.min(1, 'Must be at least 1 if set')
			.integer('Must be a whole number')
			.typeError('Must be a number'),

		tags: yup
			.array()
			.of(yup.string().required())
			.max(15, 'Maximum 15 tags')
			.default([]),

		inclusions: yup
			.array()
			.of(yup.string().required())
			.max(20, 'Maximum 20 inclusions')
			.default([]),

		highlights: yup.string().trim().optional().default(''),

		termsAndConditions: yup.string().trim().optional().default(''),

		validFrom: yup.string().nullable().optional().default(null),

		validUntil: yup
			.string()
			.nullable()
			.optional()
			.default(null)
			.test(
				'valid-until-after-valid-from',
				'Valid until must be after valid from',
				function (value) {
					const { validFrom } = this.parent as { validFrom?: string | null };
					if (!validFrom || !value) return true;
					return new Date(value) > new Date(validFrom);
				},
			),

		isBookable: yup.boolean().default(false),

		listingIds: yup
			.array()
			.of(yup.number().required())
			.min(2, 'You must select at least 2 listings')
			.required('Please select listings for this package')
			.default([]),
	})
	.required();

export type PackageFormData = yup.InferType<typeof packageSchema>;
