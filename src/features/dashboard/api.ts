import type { InferRequestType } from "hono/client";
import { unwrap } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const dashboard = api.dashboard;

export type DashboardRange = InferRequestType<
	typeof dashboard.summary.$get
>["query"]["range"];

/**
 * `unwrap`'s return type already narrows the `zValidator` query-validation error
 * branch out of the response union — see `SuccessJson` in `features/shared/http.ts`.
 * Deriving `DashboardSummary` from it (rather than a standalone `InferResponseType`)
 * keeps that narrowing instead of re-introducing the union.
 */
export const dashboardApi = {
	/** GET /api/dashboard/summary?range=7d|30d|90d — net worth, this-month cashflow, daily series. */
	summary: (range: DashboardRange, signal?: AbortSignal) =>
		unwrap(dashboard.summary.$get({ query: { range } }, { init: { signal } })),
};

export type DashboardSummary = Awaited<ReturnType<typeof dashboardApi.summary>>;
