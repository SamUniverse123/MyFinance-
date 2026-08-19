import {
	keepPreviousData,
	queryOptions,
	useQuery,
} from "@tanstack/react-query";
import { budgetsApi } from "./api";

export const budgetKeys = {
	all: ["budgets"] as const,
	summary: (currency: string | undefined, month: string | undefined) =>
		["budgets", "summary", currency ?? "default", month ?? "current"] as const,
};

export const budgetsListOptions = () =>
	queryOptions({
		queryKey: budgetKeys.all,
		queryFn: async ({ signal }) => budgetsApi.list(signal),
	});

export function useGetBudgets() {
	return useQuery(budgetsListOptions());
}

export const budgetsSummaryOptions = (
	currency: string | undefined,
	month: string | undefined,
) =>
	queryOptions({
		queryKey: budgetKeys.summary(currency, month),
		queryFn: async ({ signal }) => budgetsApi.summary(currency, month, signal),
		// Toggling month (or currency) keeps the previous month's content mounted and
		// visible while the new one loads, instead of dropping to the loading skeleton
		// (grill Q1) — the prerequisite for any transition to have something to animate
		// from. Month-directed transitions are driven separately by useMonthDirection.
		placeholderData: keepPreviousData,
	});

export function useGetBudgetSummary(
	currency: string | undefined,
	month: string | undefined,
) {
	return useQuery(budgetsSummaryOptions(currency, month));
}
