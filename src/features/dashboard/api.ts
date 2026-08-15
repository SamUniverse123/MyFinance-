import type { InferRequestType } from "hono/client";
import { unwrap } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const dashboard = api.dashboard;

export type DashboardRange = InferRequestType<
	typeof dashboard.summary.$get
>["query"]["range"];
export type DashboardCurrency = InferRequestType<
	typeof dashboard.summary.$get
>["query"]["currency"];

/**
 * `unwrap`'s return type already narrows the `zValidator` query-validation error
 * branch out of the response union — see `SuccessJson` in `features/shared/http.ts`.
 * Deriving `DashboardSummary` from it (rather than a standalone `InferResponseType`)
 * keeps that narrowing instead of re-introducing the union.
 */
export const dashboardApi = {
	/**
	 * GET /api/dashboard/summary?range=7d|30d|90d&currency=XXX — net worth, this-month
	 * cashflow, budget, and daily series, all scoped to one currency (ADR-0009: currencies
	 * are a view toggle, never converted/blended). Omitting `currency` falls back to the
	 * user's default; the response's `availableCurrencies` lists what can be toggled to.
	 */
	summary: (
		range: DashboardRange,
		currency: DashboardCurrency,
		signal?: AbortSignal,
	) =>
		unwrap(
			dashboard.summary.$get(
				{ query: { range, currency } },
				{ init: { signal } },
			),
		),
};

export type DashboardSummary = Awaited<ReturnType<typeof dashboardApi.summary>>;
