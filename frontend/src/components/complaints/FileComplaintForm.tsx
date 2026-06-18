import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import InputField from '@components/form/InputField';
import TextAreaField from '@components/form/TextAreaField';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import Button from '@components/button/Button';
import { fileComplaintSchema, type FileComplaintFormData } from '@utils/validators/complaints';
import { CATEGORY_OPTIONS } from '@/types/complaints';
import notification from '@utils/notifications';
import type { ComplaintDetail, FileComplaintPayload } from '@/types/complaints';

interface Props {
    fileComplaint: (payload: FileComplaintPayload) => Promise<ComplaintDetail>;
    detailRoute: string; // e.g. ROUTES.TRAVELLER_COMPLAINT_DETAIL with :id placeholder
    typographyVariant?: 'default' | 'traveller';
}

const FileComplaintForm = ({
    fileComplaint,
    detailRoute,
    typographyVariant = 'default',
}: Props) => {
    const { bookingItemId } = useParams<{ bookingItemId: string }>();
    const navigate = useNavigate();
    const [apiError, setApiError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const isTravellerTypography = typographyVariant === 'traveller';

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<FileComplaintFormData>({
        resolver: yupResolver(fileComplaintSchema),
        defaultValues: {
            bookingItemId: Number(bookingItemId) || 0,
            category: '' as FileComplaintFormData['category'],
            title: '',
            description: '',
        },
    });

    const onSubmit = async (data: FileComplaintFormData) => {
        try {
            setApiError('');
            setSubmitting(true);
            const complaint = await fileComplaint({
                bookingItemId: data.bookingItemId,
                category: data.category as import('@/types/complaints').ComplaintCategory,
                title: data.title,
                description: data.description,
            });
            notification.success('Complaint filed successfully');
            void navigate(detailRoute.replace(':id', String(complaint.id)));
        } catch (err) {
            setApiError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    // Group categories by their reporting window
    const groupedCategories = CATEGORY_OPTIONS.reduce<Record<string, typeof CATEGORY_OPTIONS>>(
        (acc, opt) => {
            if (!acc[opt.group]) acc[opt.group] = [];
            acc[opt.group].push(opt);
            return acc;
        },
        {},
    );

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto">
                <button
                    type="button"
                    onClick={() => { void navigate(-1); }}
                    className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-teal-600 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="mb-6">
                    <h1 className={isTravellerTypography ? 'page-heading text-ink flex items-center gap-2' : 'text-2xl font-bold text-ink flex items-center gap-2'}>
                        <AlertTriangle className="w-6 h-6 text-teal-600" />
                        File a Complaint
                    </h1>
                    <p className={isTravellerTypography ? 'page-subtext mt-1' : 'text-ink-muted text-sm mt-1'}>
                        Describe your issue in detail. We will review it and take appropriate action.
                    </p>
                </div>

                {apiError && (
                    <div className="mb-4">
                        <FormErrorBanner>{apiError}</FormErrorBanner>
                    </div>
                )}

                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="bg-surface rounded-2xl border border-line p-6 space-y-5"
                >
                    {/* Category select — grouped optgroup */}
                    <div>
                        <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <Controller
                            name="category"
                            control={control}
                            render={({ field }) => (
                                <select
                                    {...field}
                                    className={`w-full px-4 py-2.5 text-sm border-2 rounded-xl focus:outline-none transition-colors ${
                                        errors.category
                                            ? 'border-red-500 focus:border-red-500'
                                            : 'border-line focus:border-teal-600'
                                    }`}
                                >
                                    <option value="">Select a category...</option>
                                    {Object.entries(groupedCategories).map(([group, options]) => (
                                        <optgroup key={group} label={group}>
                                            {options.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            )}
                        />
                        {errors.category && (
                            <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>
                        )}
                    </div>

                    {/* Title */}
                    <Controller
                        name="title"
                        control={control}
                        render={({ field }) => (
                            <InputField
                                {...field}
                                label="Subject"
                                placeholder="Brief summary of the issue (min 10 characters)"
                                error={errors.title?.message}
                                required
                            />
                        )}
                    />

                    {/* Description */}
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <TextAreaField
                                {...field}
                                label="Description"
                                placeholder="Describe the issue in detail (min 20 characters)"
                                rows={6}
                                error={errors.description?.message}
                                required
                            />
                        )}
                    />

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
                        <strong>Note:</strong> After filing, you can upload supporting evidence (photos)
                        from the complaint detail page. Only JPEG/PNG files up to 2 MB each are accepted.
                    </div>

                    <Button type="submit" loading={submitting} fullWidth>
                        Submit Complaint
                    </Button>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default FileComplaintForm;
