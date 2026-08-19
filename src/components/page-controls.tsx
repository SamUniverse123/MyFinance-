import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "#/components/ui/pagination.tsx";

/** Page numbers to render: first, last, current ±1, and `null` for an ellipsis gap. */
function pageWindow(page: number, totalPages: number): (number | null)[] {
	const pages = new Set([1, totalPages, page - 1, page, page + 1]);
	const sorted = [...pages]
		.filter((p) => p >= 1 && p <= totalPages)
		.sort((a, b) => a - b);

	const result: (number | null)[] = [];
	for (let i = 0; i < sorted.length; i++) {
		if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push(null);
		result.push(sorted[i]);
	}
	return result;
}

/**
 * Client-state page controls (Previous / windowed numbers / Next) for use with
 * `usePagination`. No URL involvement — these are in-page lists (account
 * transactions, budget categories), not the URL-driven Transactions table.
 */
export function PageControls({
	page,
	totalPages,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	const goTo = (e: React.MouseEvent, target: number) => {
		e.preventDefault();
		onPageChange(target);
	};

	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href="#"
						aria-disabled={page === 1}
						className={
							page === 1 ? "pointer-events-none opacity-50" : undefined
						}
						onClick={(e) => goTo(e, Math.max(1, page - 1))}
					/>
				</PaginationItem>

				{pageWindow(page, totalPages).map((p, i) =>
					p === null ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: gaps have no stable identity
						<PaginationItem key={`ellipsis-${i}`}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={p}>
							<PaginationLink
								href="#"
								isActive={p === page}
								onClick={(e) => goTo(e, p)}
							>
								{p}
							</PaginationLink>
						</PaginationItem>
					),
				)}

				<PaginationItem>
					<PaginationNext
						href="#"
						aria-disabled={page === totalPages}
						className={
							page === totalPages ? "pointer-events-none opacity-50" : undefined
						}
						onClick={(e) => goTo(e, Math.min(totalPages, page + 1))}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
