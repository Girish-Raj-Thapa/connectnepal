const API_ORIGIN = (() => {
	try {
		return new URL(import.meta.env.VITE_API_URL as string).origin;
	} catch {
		return '';
	}
})();

export function resolveMediaUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (url.startsWith('http://') || url.startsWith('https://')) return url;
	return `${API_ORIGIN}${url}`;
}
