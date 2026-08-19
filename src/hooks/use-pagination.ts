import * as React from "react";

/**
 * Slices `items` into a page of `pageSize`. Clamps `page` back into range when the
 * list shrinks out from under it (e.g. a filter or delete drops the page count) so
 * the caller never renders an empty page while a later one has content.
 */
export function usePagination<T>(items: T[], pageSize: number) {
	const [page, setPage] = React.useState(1);
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const clampedPage = Math.min(page, totalPages);

	React.useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	const start = (clampedPage - 1) * pageSize;
	const pageItems = items.slice(start, start + pageSize);

	return { page: clampedPage, setPage, totalPages, pageItems };
}
