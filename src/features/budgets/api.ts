import type { InferRequestType } from "hono/client";
import { unwrap } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const budgets = api.budgets;

export type Budget = Awaited<ReturnType<typeof budgetsApi.list>>[number];
export type UpdateBudgetInput = InferRequestType<
	(typeof budgets)[":currency"]["$patch"]
>["json"];

/** The budgets page's summary payload (overall figure + category rows + 6-month history). */
export type BudgetSummary = Awaited<ReturnType<typeof budgetsApi.summary>>;
export type BudgetCategory = BudgetSummary["categories"][number];
export type UpdateCategoryBudgetInput = InferRequestType<
	(typeof budgets)["categories"][":categoryId"]["$patch"]
>["json"];

export const budgetsApi = {
	/** GET /api/budgets — every currency this user has an overall budget set for. */
	list: (signal?: AbortSignal) =>
		unwrap(budgets.$get(undefined, { init: { signal } })),

	/** GET /api/budgets/summary — everything the budgets page needs, scoped to one currency. */
	summary: (currency: string | undefined, signal?: AbortSignal) =>
		unwrap(
			budgets.summary.$get(
				{ query: currency ? { currency } : {} },
				{ init: { signal } },
			),
		),

	/** PATCH /api/budgets/:currency — `{ amount }` to set (minor units), `{ amount: null }` to clear. */
	update: (currency: string, input: UpdateBudgetInput) =>
		unwrap(budgets[":currency"].$patch({ param: { currency }, json: input })),

	/** PATCH /api/budgets/categories/:categoryId — set/clear a category budget for one currency. */
	updateCategoryBudget: (
		categoryId: string,
		input: UpdateCategoryBudgetInput,
	) =>
		unwrap(
			budgets.categories[":categoryId"].$patch({
				param: { categoryId },
				json: input,
			}),
		),
};
