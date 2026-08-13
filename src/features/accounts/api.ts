import type { InferRequestType, InferResponseType } from 'hono/client'
import { api } from '@/lib/api/client'
import { unwrap, unwrapVoid } from '@/features/shared/http'

const accounts = api.accounts

/**
 * Types are inferred straight from the Hono routes — this file holds no hand-written
 * copy of the server contract. Change a route's schema and these follow.
 *
 * Caveat: timestamp columns (`createdAt`, `updatedAt`, `closedAt`) are typed here as
 * `Date` because that's what Drizzle hands `c.json()`, but they arrive over the wire
 * as ISO strings. Read them as strings; format at the edge via `src/lib/money.ts` /
 * a date helper rather than calling `Date` methods on them directly.
 */
export type Account = InferResponseType<typeof accounts.$get>[number]
export type CreateAccountInput = InferRequestType<typeof accounts.$post>['json']
export type UpdateAccountInput = InferRequestType<(typeof accounts)[':id']['$patch']>['json']

export const accountsApi = {
  /** GET /api/accounts — every account owned by the caller. */
  list: (signal?: AbortSignal): Promise<Account[]> =>
    unwrap(accounts.$get(undefined, { init: { signal } })),

  /** GET /api/accounts/:id */
  get: (id: string, signal?: AbortSignal): Promise<Account> =>
    unwrap(accounts[':id'].$get({ param: { id } }, { init: { signal } })),

  /** POST /api/accounts */
  create: (input: CreateAccountInput): Promise<Account> =>
    unwrap(accounts.$post({ json: input })),

  /** PATCH /api/accounts/:id — partial; server rejects `currency` once txns exist. */
  update: (id: string, input: UpdateAccountInput): Promise<Account> =>
    unwrap(accounts[':id'].$patch({ param: { id }, json: input })),

  /** DELETE /api/accounts/:id — 204 No Content. */
  remove: (id: string): Promise<void> =>
    unwrapVoid(accounts[':id'].$delete({ param: { id } })),
}

// Not yet — these routes don't exist in `src/server/routes/accounts.ts`, and because
// the client is fully typed off `AppType`, referencing them would fail to compile.
// Uncomment each as its route lands (see docs/design/accounts.md §3.4):
//
//   summary: (signal?: AbortSignal) =>
//     unwrap(accounts.summary.$get(undefined, { init: { signal } })),
//   close: (id: string) =>
//     unwrap(accounts[':id'].close.$post({ param: { id } })),
//   reopen: (id: string) =>
//     unwrap(accounts[':id'].reopen.$post({ param: { id } })),
//   reorder: (ids: string[]) =>
//     unwrap(accounts.reorder.$post({ json: { ids } })),
