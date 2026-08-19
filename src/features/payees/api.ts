import type { InferRequestType, InferResponseType } from "hono/client";
import { unwrap, unwrapVoid } from "@/features/shared/http";
import { api } from "@/lib/api/client";

const payees = api.payees;

/**
 * Types inferred straight from the Hono routes (see `src/features/categories/api.ts`
 * for the same convention). The list row carries a computed `transactionCount`; the
 * create/rename endpoints return the bare payee row, so they're typed separately.
 * `createdAt` is typed `Date` but arrives as an ISO string over the wire.
 */
export type Payee = InferResponseType<typeof payees.$get>[number];
/**
 * The bare payee row returned by create/rename/merge (no computed `transactionCount`).
 * Derived from the list row rather than `InferResponseType<$post>` so it doesn't pick
 * up the zValidator error branch in the response union.
 */
export type PayeeRow = Omit<Payee, "transactionCount">;
export type CreatePayeeInput = InferRequestType<typeof payees.$post>["json"];
export type UpdatePayeeInput = InferRequestType<
	(typeof payees)[":id"]["$patch"]
>["json"];
export type MergePayeesInput = InferRequestType<
	typeof payees.merge.$post
>["json"];
/**
 * A logo.dev Brand Search hit: canonical name + domain (→ logo). Defined explicitly
 * rather than via InferResponseType so it doesn't fold in the zValidator 400 branch.
 */
export type BrandResult = { name: string; domain: string };

export const payeesApi = {
	/** GET /api/payees — every payee owned by the caller, with its transaction count. */
	list: (signal?: AbortSignal): Promise<Payee[]> =>
		unwrap(payees.$get(undefined, { init: { signal } })),

	/**
	 * POST /api/payees — create-or-link. Returns the existing payee when the name
	 * already exists (case-insensitively), else the newly created one.
	 */
	create: (input: CreatePayeeInput): Promise<PayeeRow> =>
		unwrap(payees.$post({ json: input })),

	/** PATCH /api/payees/:id — rename. */
	update: (id: string, input: UpdatePayeeInput): Promise<PayeeRow> =>
		unwrap(payees[":id"].$patch({ param: { id }, json: input })),

	/** DELETE /api/payees/:id — 204. References are SET NULL (ADR-0012). */
	remove: (id: string): Promise<void> =>
		unwrapVoid(payees[":id"].$delete({ param: { id } })),

	/** POST /api/payees/merge — repoint every reference onto the survivor, delete the rest. */
	merge: (input: MergePayeesInput): Promise<PayeeRow> =>
		unwrap(payees.merge.$post({ json: input })),

	/** GET /api/payees/brand-search — logo.dev brand typeahead (best-effort, may be empty). */
	brandSearch: (q: string, signal?: AbortSignal): Promise<BrandResult[]> =>
		unwrap(payees["brand-search"].$get({ query: { q } }, { init: { signal } })),
};
