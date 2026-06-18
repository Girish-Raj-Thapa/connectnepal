import * as yup from 'yup';
import {
	isBudgetInputValid,
	isBudgetRangeValid,
} from '@utils/travellerBudget';

/**
 * Basic Profile Validation Schema (Onboarding Step 1)
 *
 * Required: firstName, lastName, phone, country, city
 * Optional: middleName, dateOfBirth, gender, address
 * Note: profilePhoto is a File — handled outside Yup via separate useState.
 */
export const basicProfileSchema = yup.object({
    firstName: yup.string().required('First name is required').trim(),
    lastName: yup.string().required('Last name is required').trim(),
    middleName: yup.string().trim().optional().default(''),
    phone: yup
        .string()
        .required('Phone number is required')
        .trim(),
    country: yup.string().required('Country is required').trim(),
    city: yup.string().required('City is required').trim(),
    dateOfBirth: yup.string().optional().default(''),
    gender: yup.string().optional().default(''),
    address: yup.string().trim().optional().default(''),
})
.required();


/**
 * Traveller Preferences Validation Schema (Onboarding Step 2)
 *
 * All fields optional — user can skip or fill partially.
 */
export const travellerPreferencesSchema = yup
	.object({
		emergencyContact: yup.string().trim().default('').defined(),
		preferredActivities: yup
			.array()
			.of(yup.string().required())
			.default([])
			.defined(),
		preferredMinBudget: yup
			.string()
			.trim()
			.test(
				'budget-valid',
				'Budget must be a non-negative number',
				(value) => isBudgetInputValid(value),
			)
			.default('')
			.defined(),
		preferredMaxBudget: yup
			.string()
			.trim()
			.test(
				'budget-valid',
				'Budget must be a non-negative number',
				(value) => isBudgetInputValid(value),
			)
			.test(
				'max-gte-min',
				'Max budget must be ≥ min budget',
				function (value) {
					const { preferredMinBudget } = this.parent as {
						preferredMinBudget: string;
					};
					return isBudgetRangeValid(preferredMinBudget, value);
				},
			)
			.default('')
			.defined(),
		preferredTripStyle: yup.string().default('').defined(),
	})
	.required();


/**
 * Form Types (inferred from Yup schemas)
 */
export type BasicProfileFormData = yup.InferType<typeof basicProfileSchema>;
export type TravellerPreferencesFormData = yup.InferType<
	typeof travellerPreferencesSchema
>;


/**
 * Host Basic Profile Validation Schema (Host Onboarding Step 1)
 *
 * Required: firstName, lastName, phone
 * Optional: address
 * Note: profilePhoto is a File — handled outside Yup via separate useState.
 */
export const hostBasicProfileSchema = yup
	.object({
		firstName: yup.string().required('First name is required').trim(),
		lastName: yup.string().required('Last name is required').trim(),
		phone: yup
			.string()
			.required('Phone number is required')
			.trim(),
		address: yup.string().trim().optional().default(''),
	})
	.required();

export type HostBasicProfileFormData = yup.InferType<
	typeof hostBasicProfileSchema
>;


/**
 * Host Business Info Validation Schema (Host Onboarding Step 2)
 *
 * Required: businessName, businessAddress
 * Optional: businessPhone, aboutService
 */
export const hostBusinessInfoSchema = yup
	.object({
		businessName: yup
			.string()
			.required('Business name is required')
			.trim(),
		businessAddress: yup
			.string()
			.required('Business address is required')
			.trim(),
		businessPhone: yup.string().trim().optional().default(''),
		aboutService: yup.string().trim().optional().default(''),
	})
	.required();

/**
 * Form Types (inferred from Yup schemas)
 */
export type HostBusinessInfoFormData = yup.InferType<
	typeof hostBusinessInfoSchema
>;
