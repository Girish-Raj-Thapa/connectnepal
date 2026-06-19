const envFlagEnabled = (value: unknown, defaultValue = false): boolean => {
	if (typeof value !== 'string') return defaultValue;
	return value.toLowerCase() === 'true';
};

export const FEATURE_FLAGS = {
	chatbot: envFlagEnabled(import.meta.env.VITE_ENABLE_CHATBOT, true),
	recommendations: envFlagEnabled(
		import.meta.env.VITE_ENABLE_RECOMMENDATIONS,
		true,
	),
} as const;
