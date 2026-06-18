import type { InputHTMLAttributes, Ref } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	indeterminate?: boolean;
	inputRef?: Ref<HTMLInputElement>;
}

const Checkbox = ({
	indeterminate,
	inputRef,
	className = '',
	...props
}: CheckboxProps) => (
	<input
		type="checkbox"
		ref={(el) => {
			if (el && indeterminate !== undefined) el.indeterminate = indeterminate;
			if (typeof inputRef === 'function') inputRef(el);
		}}
		className={`w-4 h-4 rounded border-line accent-teal-600 cursor-pointer ${className}`}
		{...props}
	/>
);

export default Checkbox;
