import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
	UpdateBudgetInput,
	UpdateCategoryBudgetInput,
} from "@/features/budgets/api";
import { budgetsApi } from "@/features/budgets/api";
import { dashboardKeys } from "@/features/dashboard/queries";
import type { HttpError } from "../shared/http";
import { budgetKeys } from "./queries";

export function useUpdateBudget() {
	const queryClient = useQueryClient();

	return useMutation<
		unknown,
		HttpError,
		{ currency: string; input: UpdateBudgetInput }
	>({
		mutationFn: ({ currency, input }) => budgetsApi.update(currency, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: budgetKeys.all });
			// the dashboard summary embeds the selected currency's budget.
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
		},
		onError: (err) => {
			toast.error(err.status < 500 ? err.message : "Failed to save budget");
		},
	});
}

export function useUpdateCategoryBudget() {
	const queryClient = useQueryClient();

	return useMutation<
		unknown,
		HttpError,
		{ categoryId: string; input: UpdateCategoryBudgetInput }
	>({
		mutationFn: ({ categoryId, input }) =>
			budgetsApi.updateCategoryBudget(categoryId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: budgetKeys.all });
			// the dashboard summary embeds the selected currency's overall budget.
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
		},
		onError: (err) => {
			toast.error(err.status < 500 ? err.message : "Failed to save budget");
		},
	});
}
