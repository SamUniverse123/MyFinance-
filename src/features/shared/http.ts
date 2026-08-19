import type { ClientResponse } from "hono/client";
import type { SuccessStatusCode } from "hono/utils/http-status";

/**
 * A non-2xx response from the API, carrying the server's `{ error: { code, message } }`
 * envelope (see `src/server/app.ts` onError). This is the single error type the whole
 * client keys off — the Query retry policy, the global toast, and the 401 route guard
 * all branch on `status` / `code`.
 */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly detail?: unknown,
	) {
		super(message);
		this.name = "HttpError";
	}
}

/** Turn a failed Response into a typed HttpError, tolerating a non-JSON body. */
async function toHttpError(res: Response): Promise<HttpError> {
	let code = "internal";
	let message = res.statusText || "Request failed";
	let detail: unknown;

	try {
		const body = (await res.json()) as {
			error?: { code?: string; message?: string; detail?: unknown };
		};
		if (body?.error) {
			code = body.error.code ?? code;
			message = body.error.message ?? message;
			detail = body.error.detail;
		}
	} catch {
		// body wasn't JSON (proxy error page, empty body) — keep the status-based defaults
	}

	return new HttpError(res.status, code, message, detail);
}

/**
 * The route's client response is a union across status codes (e.g. 201 with the
 * created record, 400 with a Zod error). Narrow it down to the JSON body types of
 * just the 2xx branches — that's what `unwrap` actually resolves with.
 */
type SuccessJson<R> =
	R extends ClientResponse<infer O, infer S, any>
		? S extends SuccessStatusCode
			? O
			: never
		: never;

/**
 * Await a Hono RPC call, returning its parsed JSON on 2xx and throwing an HttpError
 * otherwise. The generic is inferred from the route's response type, so callers get
 * the fully-typed body with no annotation.
 */
export async function unwrap<R extends ClientResponse<any, any, any>>(
	promise: Promise<R>,
): Promise<SuccessJson<R>> {
	const res = await promise;
	if (!res.ok) throw await toHttpError(res);
	return res.json() as Promise<SuccessJson<R>>;
}

/** Same as `unwrap`, for endpoints that answer 204 No Content (e.g. DELETE). */
export async function unwrapVoid(promise: Promise<Response>): Promise<void> {
	const res = await promise;
	if (!res.ok) throw await toHttpError(res);
}

/**
 * Best-effort cache warming for route loaders. Awaits every `ensureQueryData`
 * (or any) promise but NEVER rejects — a failed fetch (DB/network unreachable,
 * a 404 on a detail route) is swallowed here so it can't escape to the router's
 * generic error boundary ("Something went wrong! / Internal server error").
 *
 * The route component still mounts and its own `useQuery` `isPending`/`isError`
 * states render the graceful per-page fallback — or, once the Query cache is
 * persisted (offline-first), the last-known data straight from the cache.
 *
 * Use in place of a bare `Promise.all(...)` in loaders; nothing here reads the
 * resolved values (routes drive off `useQuery`, not `useLoaderData`).
 */
export async function prefetch(
	...promises: Array<Promise<unknown>>
): Promise<void> {
	await Promise.allSettled(promises);
}
