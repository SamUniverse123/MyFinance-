# Account Filtering — Design

Status: proposed · Owner: @samUniverse123 · Last updated: 2026-08-11

Companion to [`accounts.md`](./accounts.md). That doc designs the accounts subsystem;
this one designs how the list is **filtered, searched, and sorted** — end to end,
from the `<input>` to the `WHERE` clause. It also pins down `ListFilters`, which
`accounts.md` §4.3 referenced but never defined.

---

## 1. The one decision everything follows from

**An account list is small and bounded. A transaction list is not.**

A user has maybe 3–30 accounts. They will never have 30,000. That single fact
decides the whole architecture, because it means the entire list fits in one cheap
fetch and can be filtered in memory faster than a network round-trip could ever
answer. So the default here is the opposite of transactions:

> **Filter on the client over already-fetched rows. Go to the server only for a
> filter that changes *which rows exist in the response*.**

Exactly one account filter changes the row set: `includeClosed`. By default the DB
omits closed accounts (`accounts.md` §3.2 balance query: `isNull(accounts.closedAt)`),
so asking for them is a genuinely different query with a genuinely different result.
Everything else — type, text search, sort order, grouping — is a *view* over rows
the client already holds.

Getting this split wrong is the common failure. If `type` and `search` go to the
server, every keystroke and every chip toggle becomes a new query key, a new fetch,
and a new cache entry — for data the browser already had in full. You'd pay latency
and fragment the cache to compute something a `.filter()` does in microseconds.

| | Accounts (this doc) | Transactions (contrast) |
|---|---|---|
| Cardinality | 10⁰–10¹ per user | 10³–10⁵ per user |
| Full list in one fetch? | Yes | No — paginated |
| `search` / `type` filter | **Client**, in memory | **Server**, in `WHERE` + index |
| Row-set filter (`includeClosed`) | Server + query key | Server + query key |
| Filter state home | URL search params | URL search params |

---

## 2. Filter taxonomy — the layer each filter lives in

| Filter | Layer | In query key? | Why there |
|---|---|---|---|
| `includeClosed` | **Server** (`WHERE`) | **Yes** | Changes which rows the DB returns |
| `type` | Client (`.filter`) | No | View over fetched rows; small N |
| `search` (name / institution / mask) | Client (`.filter`) | No | Instant in memory; no index needed |
| `sort` (`manual` \| `name` \| `balance` \| `type`) | Client (`.sort`) | No | Pure reordering of held rows |
| `group by type` | Client / presentation | No | Layout only |

Two rules fall out of this table and are worth stating flatly:

1. **Query key = server filters only.** `includeClosed` is the *entire* variable
   part of the accounts list key. Client filters must never enter it, or you
   reintroduce the cache fragmentation this design exists to avoid.
2. **Client filter state lives in the URL, not `useState`.** It's shareable,
   bookmarkable, survives refresh and back/forward, and TanStack Router already
   validates search params with Zod in this repo
   ([`reset-password.tsx:10`](../../src/routes/(auth)/reset-password.tsx#L10)).

---

## 3. Server: the single row-set filter

### 3.1 Query schema (source of truth for `ListFilters`)

The whole client/server contract for list filtering is this one Zod schema. Define
it in the route; the client's `ListFilters` type is *inferred* from it (see §4), so
the shape can never drift between the two ends.

```ts
// src/server/routes/accounts.ts
import * as z from 'zod'

// Query strings are always strings. z.coerce.boolean() is a TRAP here —
// Boolean("false") === true — so use z.stringbool(), which reads
// "true"/"false"/"1"/"0"/"yes"/"no" correctly (Zod 4.4+).
const listQuerySchema = z.object({
  includeClosed: z.stringbool().default(false),
})

export type ListAccountsQuery = z.infer<typeof listQuerySchema>   // { includeClosed: boolean }
```

> **Deliberately NOT here:** `type`, `search`, `sort`. `accounts.md` §3.4 sketched
> `?type=` as a server param; this design keeps it client-side (§1). The schema is
> the one place to reverse that later — add `type: z.enum(accountType.enumValues).optional()`
> and thread it into the `WHERE`, and because `ListFilters` is inferred, the client
> picks up the new field for free. Cost of moving a filter server-side later: one
> line. Cost of wrongly starting it there: fetch-per-keystroke from day one.

### 3.2 Route handler

`GET /` currently ignores the query string entirely
([`accounts.ts:25`](../../src/server/routes/accounts.ts#L25)) and returns every row
via `select().from(accounts)` — no balances, no closed-account handling. Replace it
with the validated query plus the balance-CTE service from `accounts.md` §3.2:

```ts
.get('/', zValidator('query', listQuerySchema), async (c) => {
  const userId = c.get('user').id
  const { includeClosed } = c.req.valid('query')
  return c.json(await listAccounts(userId, { includeClosed }))
})
```

### 3.3 Service / DB

`listAccounts` already takes `{ includeClosed }` in `accounts.md` §3.2 — the filter
is a single ternary inside the existing `and(...)`:

```ts
.where(and(
  eq(accounts.userId, userId),
  includeClosed ? undefined : isNull(accounts.closedAt),   // drizzle drops undefined
))
```

Covered by `accounts_user_idx` / `accounts_user_sort_idx`; no new index. There is
nothing else to do at the DB layer, and that's the point — for a bounded set, the
DB's only filtering job is the one predicate the client *can't* reconstruct, because
the excluded rows never left the database.

---

## 4. The type chain: `ListFilters` is inferred, never written

`accounts.md` §4.3 used `ListFilters` without defining it, and `queries.ts` still
references nothing. Don't hand-write it — derive it from the Hono route so the
client filter shape is mechanically identical to what the server validates. This is
the same discipline `api.ts` already uses for `Account` / `CreateAccountInput`
([`api.ts:16`](../../src/features/accounts/api.ts#L16)).

```ts
// src/features/accounts/api.ts
import type { InferRequestType } from 'hono/client'

/** Query filters accepted by GET /api/accounts — inferred from the route's zValidator. */
export type ListFilters = InferRequestType<typeof accounts.$get>['query']
//   → { includeClosed?: string | boolean }   (server-side filters only)

export const accountsApi = {
  /** GET /api/accounts — caller's accounts with balances, optionally incl. closed. */
  list: (filters: ListFilters = {}, signal?: AbortSignal): Promise<Account[]> =>
    unwrap(accounts.$get({ query: filters }, { init: { signal } })),
  // ...rest unchanged
}
```

`ListFilters` is now **defined in exactly zero places by hand.** Add a field to
`listQuerySchema` and it appears here; the "what is `ListFilters`?" question answers
itself at the type level.

---

## 5. Query keys: only server filters vary the key

```ts
// src/features/accounts/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { accountsApi, type ListFilters } from './api'

export const accountKeys = {
  all:    ['accounts'] as const,
  list:   (f: ListFilters) => [...accountKeys.all, 'list', f] as const,
  detail: (id: string)     => [...accountKeys.all, 'detail', id] as const,
  summary:()               => [...accountKeys.all, 'summary'] as const,
}

export const accountsListOptions = (filters: ListFilters = {}) =>
  queryOptions({
    queryKey: accountKeys.list(filters),                    // only includeClosed lives here
    queryFn: ({ signal }) => accountsApi.list(filters, signal),
    staleTime: 30_000,
  })
```

`filters` here carries **only** the server contract (`includeClosed`). Because that's
the only thing in the key, the common case — toggling type/search/sort — is served
from a single warm cache entry with zero fetches. Flipping "show closed" is the only
interaction that legitimately fetches, and it should.

---

## 6. Client filter state: the URL is the store

The route validates its own search params. This is the client-filter schema —
distinct from the server's `listQuerySchema`, though `includeClosed` appears in
both (it's the one filter that is simultaneously URL state *and* a fetch input).

```ts
// src/routes/_app/accounts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'
import { accountType } from '@/db/schema'

const accountsSearchSchema = z.object({
  includeClosed: z.boolean().default(false),                        // → server + key
  type:   z.enum(accountType.enumValues).optional(),                // → client derive
  search: z.string().trim().optional(),                             // → client derive
  sort:   z.enum(['manual', 'name', 'balance', 'type']).default('manual'),
})
export type AccountsSearch = z.infer<typeof accountsSearchSchema>

export const Route = createFileRoute('/_app/accounts/')({
  validateSearch: accountsSearchSchema,
  // Prefetch only the server-relevant slice, so the loader key matches the component key.
  loaderDeps: ({ search }) => ({ includeClosed: search.includeClosed }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(accountsListOptions(deps)),
  component: AccountsPage,
})
```

`loaderDeps` is doing load-bearing work: it narrows the loader's dependency to
`includeClosed` alone, so changing `search`/`type`/`sort` in the URL does **not**
re-run the loader or the query — it only re-renders. Only `includeClosed` triggers a
refetch, exactly matching the query key in §5.

---

## 7. The client derive: one pure function

All non-server filtering is a single pure, testable transform from
`(rows, view) → rows`. No hooks, no query client — trivial to unit-test.

```ts
// src/features/accounts/filtering.ts
import type { Account } from './api'
import type { AccountsSearch } from '@/routes/_app/accounts'

const balanceOf = (a: Account) => a.balance ?? 0   // balance comes from the CTE (accounts.md §3.2)

export function filterAndSortAccounts(rows: Account[], view: AccountsSearch): Account[] {
  const q = view.search?.toLowerCase()

  const filtered = rows.filter((a) => {
    if (view.type && a.type !== view.type) return false
    if (q) {
      const hay = `${a.name} ${a.institution ?? ''} ${a.mask ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (view.sort) {
      case 'name':    return a.name.localeCompare(b.name)
      case 'balance': return balanceOf(b) - balanceOf(a)        // richest first
      case 'type':    return a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder
      case 'manual':
      default:        return a.sortOrder - b.sortOrder          // server already ordered; stabilise
    }
  })

  return sorted
}
```

`includeClosed` is intentionally absent from this function — closed rows are excluded
*upstream* (server) when the box is off, and when it's on they're present and should
render (grouped into a collapsed "Closed" section per `accounts.md` §4.4). The client
never re-filters on closed state; it only decides where to *place* those rows.

---

## 8. Wiring the component

```tsx
function AccountsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // One cache entry, keyed only on includeClosed.
  const { data: rows = [] } = useSuspenseQuery(
    accountsListOptions({ includeClosed: search.includeClosed }),
  )

  // Recomputes on view change; no fetch. Cheap for small N.
  const accounts = useMemo(() => filterAndSortAccounts(rows, search), [rows, search])

  // Filter controls just patch the URL — the store is the address bar.
  const setFilter = (patch: Partial<AccountsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  // <SearchInput value={search.search} onChange={(v) => setFilter({ search: v || undefined })} />
  // <TypeChips   value={search.type}   onChange={(t) => setFilter({ type: t })} />
  // <SortSelect  value={search.sort}   onChange={(s) => setFilter({ sort: s })} />
  // <Switch checked={search.includeClosed} onCheckedChange={(v) => setFilter({ includeClosed: v })} />
  // ...
}
```

`replace: true` keeps filter tweaks out of the history stack, so Back leaves the
page rather than undoing chips one at a time.

Optional: instead of `useMemo`, push the derive into the query's `select` —
`useSuspenseQuery({ ...accountsListOptions({ includeClosed }), select: (r) => filterAndSortAccounts(r, search) })`.
Both are fine at this cardinality; `useMemo` keeps the pure function visible at the
call site and is easier to reason about, so it's the recommendation.

---

## 9. Data flow

```
address bar  ?includeClosed&type&search&sort
     │  validateSearch (Zod)  ──────────────────────────────► AccountsSearch
     │
     ├── includeClosed ──► loaderDeps ──► accountsListOptions({includeClosed})
     │                                        │  queryKey: ['accounts','list',{includeClosed}]
     │                                        ▼
     │                              accountsApi.list({includeClosed})
     │                                        ▼
     │                       GET /api/accounts?includeClosed=…   zValidator(listQuerySchema)
     │                                        ▼
     │                       listAccounts(userId,{includeClosed})   ← balance CTE
     │                                        ▼
     │                       WHERE user_id=… [AND closed_at IS NULL]     ← the only DB filter
     │                                        ▼
     │                                   Account[]  (cached, one entry)
     │                                        │
     └── type / search / sort ──► filterAndSortAccounts(rows, search)  ← pure, no fetch
                                              ▼
                                       rendered list
```

The left rail (`includeClosed`) reaches all the way to the `WHERE`. The right rail
(everything else) turns around at the client and never touches the network.

---

## 10. Invariants & edge cases

1. **Query key contains only server filters.** If a client filter ever appears in
   `accountKeys.list`, that's the bug this design is built to prevent.
2. **`includeClosed` is the one filter in both schemas.** It's URL state *and* a
   fetch input — the sole overlap between `accountsSearchSchema` and `listQuerySchema`.
3. **Empty search / no type = identity filter**, not "no results". `undefined`
   means unset; only a non-empty `search` narrows.
4. **Search covers `name`, `institution`, `mask`** — matching how a user thinks
   about an account ("the Chase one", "…4291"), not just the display name.
5. **`sort: 'balance'` reads `Account.balance`** from the CTE. If the list endpoint
   ever stops returning balances (`accounts.md` open Q1), this sort degrades to
   name order rather than throwing — hence `balanceOf`'s `?? 0`.
6. **Sort is stable.** `manual`/`type` fall back to `sortOrder` so drag-reorder
   (`accounts.md` §4.4) and filtering compose without fighting each other.
7. **Filters survive refresh and are shareable** because they're in the URL —
   `/accounts?type=credit_card&sort=balance` is a valid, linkable view.

---

## 11. Build order

1. `listQuerySchema` + `zValidator('query')` on `GET /` → export `ListAccountsQuery`.
2. Infer `ListFilters` in `api.ts`; give `accountsApi.list` its `filters` arg.
3. `accountsListOptions(filters)` + `accountKeys.list(f)` (§5).
4. `filterAndSortAccounts` + its unit tests (pure function — test first).
5. Route `validateSearch` + `loaderDeps` + loader (§6).
6. Filter UI controls wired to `navigate({ search })` (§8).

Steps 1–3 are the contract; 4 is independently testable; 5–6 are the surface.
