import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Ban } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Button from '@components/button/Button';
import { useConfirm } from '@context/ConfirmContext';
import InputField from '@components/form/InputField';
import Loader from '@components/feedback/Loader';
import FormErrorBanner from '@components/feedback/FormErrorBanner';
import ExceptionRowActions from '@components/slots/shared/ExceptionRowActions';
import notification from '@utils/notifications';
import useApiSubmit from '@hooks/useApiSubmit';
import { packageExceptionSchema } from '@utils/validators/slots';
import type { ExceptionLike } from '@/types/bookings';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (d: string) => format(parseISO(d), 'MMM d, yyyy');

// ── Form types ────────────────────────────────────────────────────────────────

type ExceptionFormData = {
	date:              string;
	capacityOverride?: number;
	note:              string;
};

type ExceptionPayload = {
	date:              string;
	isClosed:          boolean;
	capacityOverride?: number;
	note?:             string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExceptionsManagerProps<T extends ExceptionLike> {
	resource:          { id: number; maxGroupSize: number };
	exceptions:        T[];
	loading:           boolean;
	onExceptionsChange: (updater: (prev: T[]) => T[]) => void;
	onCreate:  (resourceId: number, payload: ExceptionPayload) => Promise<T>;
	onUpdate:  (resourceId: number, id: number, payload: ExceptionPayload) => Promise<T>;
	onDelete:  (resourceId: number, id: number) => Promise<void>;
	/** Unit label for capacity badge. Default: 'seats' */
	unitLabel?: string;
	/** Date type label for description copy. Default: 'dates' */
	dateLabel?: string;
}

// ── Exception form ────────────────────────────────────────────────────────────

interface ExceptionFormProps<T extends ExceptionLike> {
	resource:  { id: number; maxGroupSize: number };
	editing:   T | null;
	onCreate:  ExceptionsManagerProps<T>['onCreate'];
	onUpdate:  ExceptionsManagerProps<T>['onUpdate'];
	onSave:    (exc: T) => void;
	onCancel:  () => void;
}

const ExceptionForm = <T extends ExceptionLike>({
	resource,
	editing,
	onCreate,
	onUpdate,
	onSave,
	onCancel,
}: ExceptionFormProps<T>) => {
	const [excType, setExcType] = useState<'closed' | 'capacity'>(
		editing ? (editing.isClosed ? 'closed' : 'capacity') : 'closed',
	);

	const { register, handleSubmit, formState: { errors } } =
		useForm<ExceptionFormData>({
			resolver: yupResolver(packageExceptionSchema) as never,
			shouldUnregister: true,
			defaultValues: {
				date:             editing?.date ?? '',
				capacityOverride: editing?.capacityOverride ?? undefined,
				note:             editing?.note ?? '',
			},
		});

	const { apiError, submitting, handleSubmit: handleApiSubmit } =
		useApiSubmit<ExceptionFormData>(async (data) => {
			if (excType === 'capacity' && !data.capacityOverride) {
				throw new Error('Capacity override is required');
			}
			const payload: ExceptionPayload = {
				date:    data.date,
				isClosed: excType === 'closed',
				...(excType === 'capacity' ? { capacityOverride: data.capacityOverride } : {}),
				...(data.note.trim() && { note: data.note.trim() }),
			};
			let result: T;
			if (editing) {
				result = await onUpdate(resource.id, editing.id, payload);
				notification.success('Exception updated.');
			} else {
				result = await onCreate(resource.id, payload);
				notification.success('Exception created.');
			}
			onSave(result);
		});

	const onSubmit = (data: ExceptionFormData) => { void handleApiSubmit(data); };

	return (
		<div className="bg-amber-50/40 border border-amber-100 rounded-xl p-5">
			<h3 className="text-sm font-bold text-ink mb-4">
				{editing ? 'Edit Exception' : 'New Exception'}
			</h3>
			<form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<InputField
						{...register('date')}
						type="date"
						label="Date"
						required
						error={errors.date?.message}
					/>
					<div>
						<label className="block text-sm font-medium text-ink-secondary mb-1">
							Type <span className="text-red-500">*</span>
						</label>
						<div className="flex gap-2">
							<button type="button" onClick={() => setExcType('closed')}
								className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
									excType === 'closed'
										? 'bg-red-50 text-red-700 border-red-300'
										: 'bg-surface text-ink-muted border-line hover:border-ink-muted'
								}`}
							>
								Close Date
							</button>
							<button type="button" onClick={() => setExcType('capacity')}
								className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
									excType === 'capacity'
										? 'bg-teal-50 text-teal-700 border-teal-300'
										: 'bg-surface text-ink-muted border-line hover:border-ink-muted'
								}`}
							>
								Override Capacity
							</button>
						</div>
					</div>
				</div>

				{excType === 'capacity' && (
					<div className="mb-4 w-36">
						<InputField
							{...register('capacityOverride', { valueAsNumber: true })}
							type="number"
							label="Capacity Override"
							required
							min={1}
							max={resource.maxGroupSize}
							error={errors.capacityOverride?.message}
						/>
					</div>
				)}

				<div className="mb-4">
					<InputField
						{...register('note')}
						type="text"
						label="Note (optional)"
						placeholder="e.g. Public holiday, Private event"
						maxLength={255}
					/>
				</div>

				{apiError && <FormErrorBanner>{apiError}</FormErrorBanner>}

				<div className="flex gap-3 mt-4">
					<Button type="submit" variant="primary" loading={submitting}>
						{editing ? 'Save Changes' : 'Create Exception'}
					</Button>
					<Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
};

// ── Main manager ──────────────────────────────────────────────────────────────

const ExceptionsManager = <T extends ExceptionLike>({
	resource,
	exceptions,
	loading,
	onExceptionsChange,
	onCreate,
	onUpdate,
	onDelete,
	unitLabel = 'seats',
	dateLabel = 'dates',
}: ExceptionsManagerProps<T>) => {
	const confirm = useConfirm();
	const [showForm, setShowForm]                 = useState(false);
	const [editingException, setEditingException] = useState<T | null>(null);
	const [deletingId, setDeletingId]             = useState<number | null>(null);

	const openCreate = () => { setEditingException(null); setShowForm(true); };
	const openEdit   = (exc: T) => { setEditingException(exc); setShowForm(true); };

	const handleSave = (saved: T) => {
		if (editingException) {
			onExceptionsChange((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
		} else {
			onExceptionsChange((prev) => [saved, ...prev]);
		}
		setShowForm(false);
		setEditingException(null);
	};

	const handleCancel = () => { setShowForm(false); setEditingException(null); };

	const handleDelete = async (excId: number) => {
		const confirmed = await confirm({
			title: 'Remove Exception',
			message: 'Are you sure you want to remove this exception? This cannot be undone.',
			confirmLabel: 'Remove',
		});
		if (!confirmed) return;
		try {
			setDeletingId(excId);
			await onDelete(resource.id, excId);
			onExceptionsChange((prev) => prev.filter((e) => e.id !== excId));
			notification.success('Exception removed.');
		} catch (err) {
			notification.error(err instanceof Error ? err.message : 'Failed to delete exception');
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3 items-center justify-between">
				<p className="text-sm text-ink-muted">
					Close specific {dateLabel} or override capacity for one-off events.
				</p>
				{!showForm && (
					<Button type="button" variant="secondary" onClick={openCreate}>
						<span className="flex items-center gap-1.5">
							<Plus className="w-4 h-4" />
							Add Exception
						</span>
					</Button>
				)}
			</div>

			{showForm && (
				<ExceptionForm
					resource={resource}
					editing={editingException}
					onCreate={onCreate}
					onUpdate={onUpdate}
					onSave={handleSave}
					onCancel={handleCancel}
				/>
			)}

			{loading ? (
				<div className="flex justify-center py-10">
					<Loader text="Loading exceptions..." />
				</div>
			) : exceptions.length === 0 && !showForm ? (
				<div className="py-12 text-center border border-dashed border-line rounded-xl">
					<Ban className="w-8 h-8 text-line mx-auto mb-2" />
					<p className="text-ink-muted text-sm font-medium">No exceptions</p>
					<p className="text-ink-muted text-xs mt-1">
						Add exceptions to close {dateLabel} or override capacity.
					</p>
				</div>
			) : exceptions.length > 0 ? (
				<div className="bg-surface border border-line rounded-xl overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-surface-muted border-b border-line">
								<tr>
									<th className="px-5 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Date</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Type</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Note</th>
									<th className="px-5 py-3 text-right text-xs font-semibold text-ink-muted uppercase">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line-muted">
								{exceptions.map((exc) => {
									const isDeleting = deletingId === exc.id;
									return (
										<tr key={exc.id} className="hover:bg-surface-muted transition-colors">
											<td className="px-5 py-3 text-sm font-medium text-ink">
												{formatDate(exc.date)}
											</td>
											<td className="px-5 py-3">
												{exc.isClosed ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
														<Ban className="w-3 h-3" />
														Closed
													</span>
												) : (
													<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
														{exc.capacityOverride} {unitLabel}
													</span>
												)}
											</td>
											<td className="px-5 py-3 text-sm text-ink-muted">
												{exc.note || '—'}
											</td>
											<td className="px-5 py-3">
												<ExceptionRowActions
													onEdit={() => openEdit(exc)}
													onDelete={() => { void handleDelete(exc.id); }}
													deleting={isDeleting}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

	</div>
	);
};

export default ExceptionsManager;
