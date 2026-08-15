import { queryOptions, useQuery } from "@tanstack/react-query";
import { budgetsApi } from "./api";

export const budgetKeys = {
	all: ["budgets"] as const,
	summary: (currency: string | undefined) =>
		["budgets", "summary", currency ?? "default"] as const,
};

export const budgetsListOptions = () =>
	queryOptions({
		queryKey: budgetKeys.all,
		queryFn: async ({ signal }) => budgetsApi.list(signal),
	});

export function useGetBudgets() {
	return useQuery(budgetsListOptions());
}

export const budgetsSummaryOptions = (currency: string | undefined) =>
	queryOptions({
		queryKey: budgetKeys.summary(currency),
		queryFn: async ({ signal }) => budgetsApi.summary(currency, signal),
	});

export function useGetBudgetSummary(currency: string | undefined) {
	return useQuery(budgetsSummaryOptions(currency));
}
