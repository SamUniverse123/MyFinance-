import type { InferRequestType } from "hono/client";
import { unwrap } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const settings = api.settings;

export type UserSettings = Awaited<ReturnType<typeof settingsApi.get>>;
export type UpdateSettingsInput = InferRequestType<
	typeof settings.$patch
>["json"];

export const settingsApi = {
	/** GET /api/settings — the caller's settings row, or null if they've never saved any. */
	get: (signal?: AbortSignal) =>
		unwrap(settings.$get(undefined, { init: { signal } })),

	/** PATCH /api/settings — upserts; on first write, base currency is inferred server-side. */
	update: (input: UpdateSettingsInput) =>
		unwrap(settings.$patch({ json: input })),
};
