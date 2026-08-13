import type { InferRequestType, InferResponseType } from "hono/client";
import { unwrap, unwrapVoid } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const categories = api.categories;

/**
 * Types are inferred straight from the Hono routes — see `src/features/accounts/api.ts`
 * for the same convention. `createdAt` is typed `Date` here but arrives as an ISO string
 * over the wire; read it as a string.
 */
export type Category = InferResponseType<typeof categories.$get>[number];
export type CreateCategoryInput = InferRequestType<
	typeof categories.$post
>["json"];
export type UpdateCategoryInput = InferRequestType<
	(typeof categories)[":id"]["$patch"]
>["json"];
export type DeleteCategoryInput = InferRequestType<
	(typeof categories)[":id"]["$delete"]
>["json"];

export const categoriesApi = {
	/** GET /api/categories — every category owned by the caller, flat (build the tree client-side). */
	list: (signal?: AbortSignal): Promise<Category[]> =>
		unwrap(categories.$get(undefined, { init: { signal } })),

	/** POST /api/categories */
	create: (input: CreateCategoryInput): Promise<Category> =>
		unwrap(categories.$post({ json: input })),

	/** PATCH /api/categories/:id — partial; server enforces ADR-0001's hierarchy rules. */
	update: (id: string, input: UpdateCategoryInput): Promise<Category> =>
		unwrap(categories[":id"].$patch({ param: { id }, json: input })),

	/**
	 * DELETE /api/categories/:id — 204 No Content.
	 * Omit `reassignTo` on the first attempt: if the category is still referenced (per
	 * ADR-0003), the server answers 409 with `{ childCount, transactionCount, ... }`
	 * instead of deleting. Resubmit with `reassignTo` (a category id, or `null` to
	 * uncategorize/promote-to-top-level) to complete the delete.
	 */
	remove: (id: string, input?: DeleteCategoryInput): Promise<void> =>
		unwrapVoid(categories[":id"].$delete({ param: { id }, json: input })),
};
