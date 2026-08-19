import { queryOptions, useQuery } from "@tanstack/react-query";
import { payeesApi } from "./api";

export const payeeKeys = {
	all: ["payees"] as const,
	list: () => [...payeeKeys.all, "list"] as const,
	brandSearch: (q: string) => [...payeeKeys.all, "brand-search", q] as const,
};

export const payeesListOptions = () =>
	queryOptions({
		queryKey: payeeKeys.list(),
		queryFn: async ({ signal }) => payeesApi.list(signal),
	});

export function useGetPayees() {
	return useQuery(payeesListOptions());
}

/**
 * logo.dev brand typeahead. Caller passes an already-debounced query; disabled until
 * 2+ chars. Results are cached per query and kept briefly so backspacing feels instant.
 */
export function useBrandSearch(q: string) {
	return useQuery({
		queryKey: payeeKeys.brandSearch(q),
		queryFn: ({ signal }) => payeesApi.brandSearch(q, signal),
		enabled: q.trim().length >= 2,
		staleTime: 5 * 60 * 1000,
		placeholderData: (prev) => prev,
	});
}
