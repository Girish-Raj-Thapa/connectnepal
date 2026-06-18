import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface StringListInputProps {
	label?: string;
	value: string[];
	onChange: (items: string[]) => void;
	placeholder?: string;
	error?: string;
	required?: boolean;
	max?: number;
}

const StringListInput = ({
	label,
	value,
	onChange,
	placeholder = 'Add an item',
	error,
	required = false,
	max,
}: StringListInputProps) => {
	const [input, setInput] = useState('');

	const addItem = () => {
		const trimmed = input.trim();
		if (!trimmed) return;
		if (value.includes(trimmed)) return;
		if (max && value.length >= max) return;
		onChange([...value, trimmed]);
		setInput('');
	};

	const removeItem = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addItem();
		}
	};

	return (
		<div className="w-full">
			{label && (
				<label className="block text-xs font-semibold text-ink-secondary mb-1">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<div className="flex gap-2">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="flex-1 border-2 border-line rounded-xl py-2.5 px-4 text-sm
						focus:outline-none focus:ring-0 focus:border-tealbrand bg-surface-muted focus:bg-surface
						transition-all"
				/>
				<button
					type="button"
					onClick={addItem}
					disabled={!input.trim() || (max !== undefined && value.length >= max)}
					className="px-3 py-2.5 bg-tealbrand text-white rounded-xl hover:bg-tealbrand-dark
						disabled:opacity-40 disabled:cursor-not-allowed transition-all"
				>
					<Plus className="w-4 h-4" />
				</button>
			</div>

			{value.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{value.map((item, i) => (
						<span
							key={i}
							className="inline-flex items-center gap-1 px-3 py-1 bg-surface-muted text-ink-secondary
								text-sm rounded-full"
						>
							{item}
							<button
								type="button"
								onClick={() => removeItem(i)}
								className="text-ink-muted hover:text-red-500 transition-colors"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</span>
					))}
				</div>
			)}

			{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
		</div>
	);
};

export default StringListInput;
