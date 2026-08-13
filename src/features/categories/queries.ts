import { queryOptions, useQuery } from "@tanstack/react-query";
import { categoriesApi } from "./api";

export const categoryKeys = {
	all: ["categories"] as const,
	list: () => [...categoryKeys.all, "list"] as const,
};

export const categoriesListOptions = () =>
	queryOptions({
		queryKey: categoryKeys.list(),
		queryFn: async ({ signal }) => categoriesApi.list(signal),
	});

export function useGetCategories() {
	return useQuery(categoriesListOptions());
}
