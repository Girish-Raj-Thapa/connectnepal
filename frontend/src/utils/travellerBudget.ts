export function parseBudgetInput(
	value: string | number | null | undefined,
): number | null {
	if (value === null || value === undefined) return null;

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : Number.NaN;
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) return null;

	const parsedValue = Number(trimmedValue);
	return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

export function isBudgetInputValid(
	value: string | number | null | undefined,
): boolean {
	const parsedValue = parseBudgetInput(value);
	if (parsedValue === null) return true;
	return !Number.isNaN(parsedValue) && parsedValue >= 0;
}

export function isBudgetRangeValid(
	minValue: string | number | null | undefined,
	maxValue: string | number | null | undefined,
): boolean {
	const parsedMin = parseBudgetInput(minValue);
	const parsedMax = parseBudgetInput(maxValue);

	if (parsedMin === null || parsedMax === null) return true;
	if (Number.isNaN(parsedMin) || Number.isNaN(parsedMax)) return true;

	return parsedMax >= parsedMin;
}

export function formatBudgetForApi(
	value: string | number | null | undefined,
): string | null {
	const parsedValue = parseBudgetInput(value);

	if (parsedValue === null || Number.isNaN(parsedValue)) {
		return null;
	}

	return parsedValue.toFixed(2);
}

export function formatBudgetForInput(value: string | null | undefined): string {
	const parsedValue = parseBudgetInput(value);

	if (parsedValue === null || Number.isNaN(parsedValue)) {
		return '';
	}

	return Number.isInteger(parsedValue)
		? String(parsedValue)
		: parsedValue.toString();
}
