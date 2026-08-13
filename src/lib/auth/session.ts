import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import { auth } from "./auth";

/**
 * Reads the Better Auth session from the incoming request cookies.
 * Runs on the server during SSR, so route guards can decide before anything renders.
 */
export const fetchSession = createServerFn({ method: "GET" }).handler(
	async () => {
		return await auth.api.getSession({ headers: getRequest().headers });
	},
);

export type AppSession = Awaited<ReturnType<typeof fetchSession>>;

export const sessionQueryKey = ["session"] as const;

export const sessionQueryOptions = queryOptions({
	queryKey: sessionQueryKey,
	queryFn: () => fetchSession(),
	staleTime: 60 * 1000,
});
