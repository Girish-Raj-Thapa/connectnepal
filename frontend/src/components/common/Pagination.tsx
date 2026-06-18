interface PaginationProps {
	currentPage: number;
	totalCount: number;
	pageSize?: number;
	onPageChange: (page: number) => void;
}

const PAGE_SIZE = 20;

const Pagination = ({
	currentPage,
	totalCount,
	pageSize = PAGE_SIZE,
	onPageChange,
}: PaginationProps) => {
	const totalPages = Math.ceil(totalCount / pageSize);

	if (totalPages <= 1) return null;

	const getPageNumbers = (): number[] => {
		const pages: number[] = [];
		const maxVisible = 5;
		let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
		const end = Math.min(totalPages, start + maxVisible - 1);

		if (end - start + 1 < maxVisible) {
			start = Math.max(1, end - maxVisible + 1);
		}

		for (let i = start; i <= end; i++) {
			pages.push(i);
		}
		return pages;
	};

	return (
		<div className="flex items-center justify-center gap-2">
			<button
				type="button"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage <= 1}
				className="px-4 py-2 border border-line rounded-lg font-medium text-sm text-ink-muted hover:bg-surface-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Previous
			</button>

			{getPageNumbers().map((page) => (
				<button
					key={page}
					type="button"
					onClick={() => onPageChange(page)}
					className={`px-4 py-2 rounded-lg text-sm ${
						page === currentPage
							? 'bg-teal-600 text-white font-semibold'
							: 'border border-line font-medium text-ink-muted hover:bg-surface-muted transition-all'
					}`}
					aria-label={`Page ${page}`}
					aria-current={page === currentPage ? 'page' : undefined}
				>
					{page}
				</button>
			))}

			<button
				type="button"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages}
				className="px-4 py-2 border border-line rounded-lg font-medium text-sm text-ink-muted hover:bg-surface-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Next
			</button>
		</div>
	);
};

export default Pagination;
