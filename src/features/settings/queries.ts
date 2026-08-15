import { queryOptions, useQuery } from "@tanstack/react-query";
import { settingsApi } from "./api";

export const settingsKeys = {
	all: ["settings"] as const,
};

export const settingsOptions = () =>
	queryOptions({
		queryKey: settingsKeys.all,
		queryFn: async ({ signal }) => settingsApi.get(signal),
	});

export function useGetSettings() {
	return useQuery(settingsOptions());
}
