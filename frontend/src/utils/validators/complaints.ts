import * as yup from 'yup';

/** Schema for filing a new complaint (traveller or host). */
export const fileComplaintSchema = yup.object({
    bookingItemId: yup
        .number()
        .typeError('Please select a booking item')
        .required('Booking item is required')
        .positive('Invalid booking item'),
    category: yup
        .string()
        .required('Please select a category'),
    title: yup
        .string()
        .required('Subject is required')
        .min(10, 'Subject must be at least 10 characters')
        .max(255, 'Subject cannot exceed 255 characters')
        .trim(),
    description: yup
        .string()
        .required('Description is required')
        .min(20, 'Description must be at least 20 characters')
        .trim(),
}).required();

export type FileComplaintFormData = yup.InferType<typeof fileComplaintSchema>;


/** Schema for respondent submitting a response. */
export const respondToComplaintSchema = yup.object({
    body: yup
        .string()
        .required('Response is required')
        .min(20, 'Response must be at least 20 characters')
        .trim(),
}).required();

export type RespondFormData = yup.InferType<typeof respondToComplaintSchema>;


/** Schema for admin recording an outcome. */
export const recordOutcomeSchema = yup.object({
    outcome: yup
        .string()
        .required('Please select an outcome'),
    resolutionNote: yup
        .string()
        .required('Resolution note is required')
        .min(10, 'Resolution note must be at least 10 characters')
        .trim(),
    protectiveAction: yup
        .string()
        .optional()
        .default(''),
}).required();

export type RecordOutcomeFormData = yup.InferType<typeof recordOutcomeSchema>;


/** Schema for admin overriding severity. */
export const overrideSeveritySchema = yup.object({
    severity: yup
        .string()
        .required('Please select a severity level'),
    reason: yup
        .string()
        .required('Reason is required')
        .min(5, 'Reason must be at least 5 characters')
        .trim(),
}).required();

export type OverrideSeverityFormData = yup.InferType<typeof overrideSeveritySchema>;
