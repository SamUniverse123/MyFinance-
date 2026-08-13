import type { InferRequestType, InferResponseType } from 'hono/client'
import { api } from '@/lib/api/client'
import { unwrap, unwrapVoid } from '@/features/shared/http'

const transactions = api.transactions

/**
 * Types inferred straight from the Hono routes — no hand-written copy of the
 * server contract. `GET /` wraps the rows in `{ data: [...] }`, so the element
 * type is read off `.data`.
 *
 * Caveat (same as accounts): timestamp columns arrive over the wire as ISO
 * strings even though Drizzle types them as `Date`; `date` is a plain
 * `YYYY-MM-DD` string. Format at the edge rather than calling `Date` methods.
 */
export type Transaction = InferResponseType<typeof transactions.$get>['data'][number]
export type CreateTransactionInput = InferRequestType<typeof transactions.$post>['json']
export type UpdateTransactionInput = InferRequestType<
  (typeof transactions)[':id']['$patch']
>['json']

export const transactionsApi = {
  /** GET /api/transactions — every transaction owned by the caller. */
  list: (signal?: AbortSignal): Promise<Transaction[]> =>
    unwrap(transactions.$get(undefined, { init: { signal } })).then((r) => r.data),

  /** GET /api/transactions/:id */
  get: (id: string, signal?: AbortSignal): Promise<Transaction> =>
    unwrap(transactions[':id'].$get({ param: { id } }, { init: { signal } })),

  /** POST /api/transactions */
  create: (input: CreateTransactionInput): Promise<Transaction> =>
    unwrap(transactions.$post({ json: input })),

  /** PATCH /api/transactions/:id — partial update. */
  update: (id: string, input: UpdateTransactionInput): Promise<Transaction> =>
    unwrap(transactions[':id'].$patch({ param: { id }, json: input })),

  /** DELETE /api/transactions/:id — 204 No Content. */
  remove: (id: string): Promise<void> =>
    unwrapVoid(transactions[':id'].$delete({ param: { id } })),
}
