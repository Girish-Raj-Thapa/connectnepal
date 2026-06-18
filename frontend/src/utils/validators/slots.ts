import * as yup from 'yup';
import type { DurationType } from '@/types/listings';

export const createHostSlotSchema = (durationType: DurationType) => {
	const base = {
		capacity: yup
			.number()
			.typeError('Must be a number')
			.optional()
			.min(1, 'Min 1')
			.integer('Must be a whole number'),
	};

	if (durationType === 'multi_day') {
		return yup.object({
			...base,
			endDate: yup.string().required('End date required'),
		});
	}

	if (durationType === 'hourly') {
		return yup.object({
			...base,
			startTime: yup.string().required('Start time required'),
			endTime: yup.string().required('End time required'),
		});
	}

	return yup.object(base);
};

export const packageSlotSchema = yup.object({
	endDate: yup.string().required('End date required'),
	capacity: yup
		.number()
		.typeError('Must be a number')
		.optional()
		.min(1, 'Min 1')
		.integer('Must be a whole number'),
});

export const packageScheduleSchema = yup.object({
	daysOfWeek: yup.array(yup.number().required()).min(1, 'Select at least one day').required(),
	capacity: yup.number().typeError('Must be a number').required('Capacity required').min(1, 'Min 1'),
	advanceDays: yup.number().typeError('Must be a number').required().min(1, 'Must be at least 1'),
	validFrom: yup.string().optional().default(''),
	validUntil: yup.string().optional().default(''),
});

export const packageExceptionSchema = yup.object({
	date: yup.string().required('Date is required'),
	capacityOverride: yup
		.number()
		.typeError('Must be a number')
		.min(1, 'Min 1')
		.optional(),
	note: yup.string().optional().default(''),
});
