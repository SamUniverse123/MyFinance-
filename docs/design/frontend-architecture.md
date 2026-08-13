# Frontend Architecture — Design

Status: proposed · Owner: @samUniverse123 · Last updated: 2026-08-06
Companions: [accounts.md](./accounts.md), [transactions.md](./transactions.md)

The stack is already chosen — TanStack Start (Router + Query + Form), Hono on the
server, better-auth, shadcn/Tailwind v4. This document is about the *seams between
them*: where each kind of state lives, how data crosses the network, and which of the
two available RPC mechanisms wins.

---

## 1. Core decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Hono RPC is the only data path.** Server functions are reserved for request-context work. | Two RPC mechanisms means two auth stories, two error shapes, two caching stories. The Hono API already exists and gives end-to-end types via `AppType`. |
| 2 | **Four state homes, no global store.** | Server → Query, shareable → URL, form → TanStack Form, everything else → local `useState`. Nothing is left over for Redux/Zustand to hold. |
| 3 | **Server data is never copied into `useState`.** | The moment it is, there are two copies and one of them is wrong. |
| 4 | **Auth is resolved once in the root route's `beforeLoad`, not per component.** | `authClient.useSession()` in a component is a client-side fetch waterfall and a guaranteed auth flash. |
| 5 | **Route guards run in `beforeLoad`, not in render.** | Redirecting during render is a side effect in render; it also fires before the session has loaded. |
| 6 | **The SSR fetch calls `app.fetch()` in-process and forwards cookies.** | An HTTP round trip to itself is wasteful, and without cookie forwarding every server-rendered query is a 401. |
| 7 | **Validation schemas live in a shared contract layer** that imports table definitions but never `@/db`. | One schema for the client form and the server route; importing `@/db` into a form pulls a `pg.Pool` into the browser bundle. |

---

## 2. State taxonomy

The single most useful thing this document can do is make "where does this go?"
a lookup instead of a judgement call.

| Kind of state | Home | Examples |
|---|---|---|
| **Server state** | TanStack Query | accounts, transactions, balances, categories, session |
| **Shareable UI state** | URL search params (`validateSearch`) | transaction filters, date range, sort, active tab, selected account |
| **Form state** | TanStack Form | every create/edit form |
| **Ephemeral UI state** | local `useState` / `useReducer` | dropdown open, hover, inline-edit-in-progress |
| **Cross-cutting client state** | React context, one provider each | theme, sidebar collapsed, command palette |

**Why no Zustand/Redux.** Walk the app's actual state and every piece lands in a row
above. A global store would hold either (a) server data — a cache in front of a cache,
which is how stale balances happen — or (b) UI state that should have been in the URL,
which is how the back button breaks. Add one only when a concrete piece of state
belongs in none of these five rows; "the app is getting big" is not that.

**The URL rule.** If a teammate could usefully paste the link, it belongs in search
params. Transaction filters, yes. Whether a dropdown is open, no. This is not
stylistic: `loaderDeps: ({ search }) => search` makes the URL *literally* the query
key, so there is no second copy of filter state to keep in sync.

---

## 3. Data access layer

### 3.1 The client

`src/lib/auth/api-client.ts` is misplaced (it isn't auth) and has a bug: on the server
it points at `SERVER_URL` and forwards no cookies, so **every server-side prefetch
resolves as 401** and the SSR pass renders empty. Replace with:

```ts
// src/lib/api/client.ts
import { hc } from 'hono/client'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { AppType } from '@/server/app'          // TYPE-ONLY — see the warning below

const fetchImpl = createIsomorphicFn()
  .client((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  .server(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { app } = await import('@/server/app')
    const req = new Request(input, init)
    // forward the browser's cookies so requireAuth can resolve the session
    const cookie = getRequestHeaders().get('cookie')
    if (cookie) req.headers.set('cookie', cookie)
    return app.fetch(req)                            // in-process, no network hop
  })

export const api = hc<AppType>('http://internal', { fetch: fetchImpl }).api
```

> **The import of `AppType` must stay `import type`.** A value import of
> `@/server/app` drags Hono, Drizzle, and `pg` into the browser bundle. This is
> currently correct — keep it that way, and consider an ESLint/Biome rule pinning it.

### 3.2 Query client configuration

`getContext()` currently returns `new QueryClient()` with no options. Two consequences
worth naming: `staleTime: 0` means every SSR-dehydrated query **refetches immediately
on hydration**, so the server render buys nothing; and there's no global handler, so a
401 surfaces as a silent empty list.

```ts
// src/integrations/tanstack-query/root-provider.tsx
export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,          // SSR payload is trusted for a minute
        gcTime: 5 * 60_000,
        retry: (count, err) => !isHttpError(err, [401, 403, 404, 422]) && count < 2,
        refetchOnWindowFocus: import.meta.env.PROD,
      },
      dehydrate: {
        // stream in-flight queries to the client instead of blocking the response
        shouldDehydrateQuery: (q) =>
          defaultShouldDehydrateQuery(q) || q.state.status === 'pending',
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (isHttpError(error, 401)) return   // handled by the route guard
        toast.error(getErrorMessage(error))
      },
    }),
  })
  return { queryClient }
}
```

`router.tsx`'s `defaultPreloadStaleTime: 0` is **already correct** and should stay —
it hands staleness decisions entirely to Query rather than letting the router keep a
second, competing notion of freshness. (While in there: `QueryClient`, `ReactNode`,
and the empty `TanstackQueryProvider` are imported and unused, which `noUnusedLocals`
will reject.)

### 3.3 Query keys and `queryOptions`

Every query is declared once as a `queryOptions` object and consumed by both the route
loader and the component. That's what keeps a loader and its component from ever
disagreeing about the key.

```ts
// src/features/accounts/queries.ts
export const accountKeys = {
  all:    ['accounts'] as const,
  list:   (f: ListFilters) => [...accountKeys.all, 'list', f] as const,
  detail: (id: string)     => [...accountKeys.all, 'detail', id] as const,
}

export const accountsQuery = (filters: ListFilters = {}) =>
  queryOptions({
    queryKey: accountKeys.list(filters),
    queryFn: async ({ signal }) => {
      const res = await api.accounts.$get({ query: filters }, { init: { signal } })
      if (!res.ok) throw await toHttpError(res)
      return res.json()                          // fully typed from the Hono route
    },
  })
```

Rules: keys are built by factories only (never inline arrays), the key mirrors the
filter object exactly, and `queryFn` always forwards `signal` so navigation cancels
in-flight requests.

### 3.4 Error normalisation

The server returns `{ error: { code, message } }` ([accounts.md §3.1](./accounts.md)).
One `toHttpError(res)` helper turns a non-2xx into a typed `HttpError` carrying
`status` + `code`, and it is the *only* place `res.ok` is checked. Everything
downstream — retry policy, the global toast, the 401 guard — keys off that one type.

---

## 4. Routing and auth

### 4.1 Session in router context

```ts
// src/lib/auth/session.ts
const fetchSession = createServerFn({ method: 'GET' }).handler(async () =>
  auth.api.getSession({ headers: getRequestHeaders() }),
)

export const sessionQuery = () =>
  queryOptions({ queryKey: ['session'], queryFn: () => fetchSession(), staleTime: 5 * 60_000 })
```

```ts
// src/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context }) => ({
    session: await context.queryClient.ensureQueryData(sessionQuery()),
  }),
  // …
})
```

This is decision #4 in practice: the session resolves *once*, during SSR, before the
first paint. Every route and component reads it from context via
`Route.useRouteContext()`. `authClient.useSession()` stays for the auth pages
themselves, where there is nothing to flash.

It also matches `auth.ts`'s `session.cookieCache` (5 min) — the `staleTime` above is
deliberately the same number.

### 4.2 Route tree

```
src/routes/
  __root.tsx                        shell, providers, devtools, session in context
  index.tsx                         public landing
  (auth)/login.tsx                  redirects to /dashboard when already signed in
  (auth)/signup.tsx
  (auth)/reset-password.tsx
  _app.tsx                          ← pathless: auth guard + dashboard shell
  _app/dashboard/index.tsx          → /dashboard
  _app/dashboard/accounts/index.tsx → /dashboard/accounts
  _app/dashboard/accounts/$accountId.tsx
  _app/dashboard/transactions/index.tsx
  _app/dashboard/settings/index.tsx
```

```ts
// src/routes/_app.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.session)
      throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: AppLayout,       // SidebarProvider + AppSidebar + SiteHeader + <Outlet/>
})
```

Two things this fixes. **The guard**: `src/routes/dashboard/index.tsx:28-31` calls
`navigate()` during render, and because `useSession()` returns `data: null` while
`isPending` is true, it fires on the *first* render — before the session has loaded —
so a signed-in user gets bounced to `/login` on a cold load. **The shell**: the sidebar
and header live in the layout route, so navigating between dashboard pages doesn't
unmount and remount them (today `SidebarProvider` is inside the page component).

### 4.3 Loading and errors

- `pendingComponent` per layout route + `defaultPendingMs: 300` / `defaultPendingMinMs: 500`
  on the router, so fast navigations never flash a spinner.
- Skeletons that match the real layout's dimensions — a spinner that becomes a table is
  two layout shifts.
- `errorComponent` on `_app.tsx` (recoverable, keeps the shell) and on `__root.tsx`
  (fatal). `notFoundComponent` on the root.
- The root route currently has no `errorComponent` at all: any loader throw renders a
  blank page.

---

## 5. Mutations

```ts
// src/features/accounts/mutations.ts
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateAccountInput) =>
      api.accounts[':id'].$patch({ param: { id }, json: body }).then(unwrap),

    onMutate: async ({ id, ...patch }) => {          // optimistic
      await qc.cancelQueries({ queryKey: accountKeys.detail(id) })
      const previous = qc.getQueryData(accountKeys.detail(id))
      qc.setQueryData(accountKeys.detail(id), (old) => old && { ...old, ...patch })
      return { previous }
    },
    onError: (err, { id }, ctx) => {
      qc.setQueryData(accountKeys.detail(id), ctx?.previous)
      toast.error(getErrorMessage(err))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}
```

**What gets optimistic treatment:** renames, reorders, category changes, tag toggles,
status flips — anything where the server's answer is a foregone conclusion and the
latency is felt. **What doesn't:** creates (the server assigns IDs, applies rules, and
may resolve a payee, so the returned row differs from what was sent) and anything
destructive (the user should see the real result).

**The invalidation matrix.** Derived balances mean a transaction write changes account
data. Getting this wrong leaves correct-looking stale numbers on screen, which is worse
than an error:

| Mutation | Invalidates |
|---|---|
| account create/update/close/delete | `accountKeys.all` |
| transaction any write | `transactionKeys.all`, `accountKeys.all`, `budgetKeys.all` |
| transfer create/update/delete | same as transaction (two accounts move) |
| category/payee/tag write | own keys + `transactionKeys.all` (rows embed display fields) |
| settings (base currency) | everything — `qc.invalidateQueries()` |

Codify it as `invalidateAfterLedgerWrite(qc)` in `src/features/shared/invalidate.ts`
rather than repeating the list in every mutation hook.

---

## 6. Module structure

Today everything is flat in `src/components/` — shadcn primitives, the demo dashboard
table, and auth forms side by side. That stops scaling at about the third feature.

```
src/
  routes/                  thin: route config, loaders, guards. No business logic.
  features/
    accounts/              api · queries · mutations · components/ · types
    transactions/
    categories/
    settings/
    shared/                invalidate.ts, error helpers, shared widgets
  components/
    ui/                    shadcn primitives — generated, don't hand-edit
    layout/                app-sidebar, site-header, nav-*
  lib/
    api/client.ts          the Hono RPC client
    auth/                  auth.ts, auth-client.ts, session.ts
    money.ts               formatMoney / parseMoney / minorUnitDigits
    utils.ts
  shared/
    schemas/               zod contracts imported by BOTH client and server
  db/ · server/            server-only
```

**Dependency rules**, in order of how much they'll hurt if broken:

1. `features/*` may not import from another `features/*` — go through `features/shared`.
2. `components/ui/*` imports nothing from `features/*`. Primitives don't know about
   domain concepts.
3. `routes/*` compose features; they don't contain business logic.
4. Nothing under `src/` outside `server/` and `db/` may import `@/db` — that's a
   `pg.Pool` in the browser bundle.

**The `shared/schemas` layer** exists because of rule 4. The account and transaction
zod schemas are currently defined *inside* the route files, so a client form can't
reuse them without importing the route — which imports `@/db`. Move them to
`src/shared/schemas/accounts.ts`; they may import table definitions from
`@/db/schema` (pure metadata, safe) but never `@/db` (a live connection pool).

---

## 7. Conventions

**Path aliases.** `tsconfig.json` maps both `#/*` and `@/*` to `./src/*`, and the
codebase uses both — sometimes in the same file, sometimes with a `.tsx` extension
(`#/components/ui/button.tsx`) and sometimes without. Pick `@/*`, drop extensions, and
let Biome's organise-imports enforce it. This is cosmetic until someone greps.

**Naming.** Files `kebab-case.tsx`; components `PascalCase`; hooks `useThing`; query
option factories `thingQuery` / `thingsQuery`; key factories `thingKeys`.

**Money never crosses the wire formatted.** The server sends signed minor-unit
integers; `src/lib/money.ts` formats at the edge. A server that sends `"$1,234.56"`
can't be summed, sorted, or re-localised.

**Component boundaries.** A component either fetches (calls `useQuery`, owns a
loading state) or renders (takes props, no data hooks). Mixed components can't be
tested or reused, and they're the ones that end up copying server data into `useState`.

---

## 8. Fix list in current code

| Where | Issue |
|---|---|
| [dashboard/index.tsx:28](../../src/routes/dashboard/index.tsx) | `navigate()` during render, fires while `isPending` — bounces signed-in users to `/login` on cold load |
| [api-client.ts:5](../../src/lib/auth/api-client.ts) | SSR path forwards no cookies → every server-side prefetch 401s |
| [root-provider.tsx:4](../../src/integrations/tanstack-query/root-provider.tsx) | `new QueryClient()` with no defaults → SSR payload refetched instantly on hydrate; `TanstackQueryProvider` is an empty function |
| [router.tsx:4-9](../../src/router.tsx) | `ReactNode`, `QueryClient`, `TanstackQueryProvider` imported unused |
| [__root.tsx](../../src/routes/__root.tsx) | no `errorComponent`, no `notFoundComponent`; title is still "TanStack Start Starter" |
| [header-user.tsx:39](../../src/integrations/better-auth/header-user.tsx) | links to `/demo/better-auth`, which doesn't exist in the route tree |
| [app-sidebar.tsx:18](../../src/components/app-sidebar.tsx) | hardcoded demo nav + "Acme Inc." + `shadcn`/`m@example.com` user |
| [dashboard/index.tsx:12](../../src/routes/dashboard/index.tsx) | renders `data.json`; `SidebarProvider` is inside the page rather than a layout route |
| tsconfig / everywhere | duelling `#/*` and `@/*` aliases, inconsistent file extensions in imports |

---

## 9. Implementation order

1. **`lib/api/client.ts`** with cookie-forwarding isomorphic fetch + `toHttpError`.
   Everything else reads through it.
2. **QueryClient defaults** + global error handling.
3. **Session in root context**; `_app.tsx` guard + shell; delete the render-time
   redirect.
4. **`shared/schemas`** extraction; move zod out of the route files.
5. **`lib/money.ts`** ([accounts.md §4.1](./accounts.md)).
6. **`features/accounts`** end to end — the template every later feature copies.
7. **`features/transactions`** — URL-driven filters, infinite list
   ([transactions.md §4](./transactions.md)).
8. Alias/import cleanup, error + not-found components, real sidebar nav.

Steps 1–3 are the ones that block everything else; 4–5 are cheap and unblock parallel
work on either feature.

---

## 10. Open questions

1. **Server functions vs Hono for auth-adjacent reads.** Decision #1 says Hono for
   data, server functions for request context — and `sessionQuery` is deliberately the
   exception, because it needs `getRequestHeaders()`. If a second exception appears,
   revisit the rule rather than accumulating exceptions.
2. **Does `_app.tsx` also own the guard, or should there be a separate `_authed.tsx`
   above it?** Splitting them buys a second authenticated layout later (e.g. a
   full-bleed report view with no sidebar) at the cost of one more nesting level.
   Recommendation: one file now, split when the second layout actually exists.
3. **Optimistic updates on the transaction list.** Optimistically patching a row inside
   an infinite query means walking pages to find it. Worth it for the category cell
   (the most-edited field); probably not worth it for anything else.
4. **Offline / PWA.** Not designed here. If it's wanted, it changes the persistence
   story (`persistQueryClient` + an IndexedDB persister) and mutation queueing —
   decide before the mutation layer calcifies, not after.
