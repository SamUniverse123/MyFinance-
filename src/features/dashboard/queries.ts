import { queryOptions, useQuery } from "@tanstack/react-query";
import {
	type DashboardCurrency,
	type DashboardRange,
	dashboardApi,
} from "./api";

export const dashboardKeys = {
	all: ["dashboard"] as const,
	summary: (range: DashboardRange, currency: DashboardCurrency) =>
		[...dashboardKeys.all, "summary", range, currency ?? "default"] as const,
};

export const dashboardSummaryOptions = (
	range: DashboardRange,
	currency: DashboardCurrency,
) =>
	queryOptions({
		queryKey: dashboardKeys.summary(range, currency),
		queryFn: async ({ signal }) =>
			dashboardApi.summary(range, currency, signal),
	});

export function useGetDashboardSummary(
	range: DashboardRange,
	currency: DashboardCurrency,
) {
	return useQuery(dashboardSummaryOptions(range, currency));
}
