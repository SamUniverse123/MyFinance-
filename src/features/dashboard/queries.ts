import { queryOptions, useQuery } from "@tanstack/react-query";
import { type DashboardRange, dashboardApi } from "./api";

export const dashboardKeys = {
	all: ["dashboard"] as const,
	summary: (range: DashboardRange) =>
		[...dashboardKeys.all, "summary", range] as const,
};

export const dashboardSummaryOptions = (range: DashboardRange) =>
	queryOptions({
		queryKey: dashboardKeys.summary(range),
		queryFn: async ({ signal }) => dashboardApi.summary(range, signal),
	});

export function useGetDashboardSummary(range: DashboardRange) {
	return useQuery(dashboardSummaryOptions(range));
}
