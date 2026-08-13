# Dashboard & Accounts Pages — Build Approach

Status: proposed · Owner: @samUniverse123 · Last updated: 2026-08-06
Companions: [frontend-architecture.md](./frontend-architecture.md), [accounts.md](./accounts.md)

Two questions to answer: how to build these two pages, and whether you can switch
between them without reloading the whole screen. The second answer drives the first,
so it goes first.

---

## 1. Can you switch pages without a full reload? Yes — and you're currently not.

This is exactly what TanStack Router does: client-side navigation swaps only the part
of the tree that changed, keyed on a shared **layout route** whose `<Outlet/>` marks
the swap point. Everything outside the outlet — sidebar, header — stays mounted and
never re-renders on navigation.

You're getting full reloads today for two concrete reasons:

**1. `<a href>` instead of `<Link>`.** [nav-main.tsx:60](../../src/components/nav-main.tsx#L60)
renders `<a href={item.url}>`. A raw anchor is a browser navigation — it throws away
the entire JS runtime, the QueryClient cache, and the session, then boots the app from
scratch. That's the reload you're seeing. `<Link to="...">` intercepts the click and
navigates in-app instead. (Same issue in [login-form.tsx:159](../../src/components/login-form.tsx#L159)'s
`<a href="/signup">`.)

**2. The shell lives *inside* the page.** [dashboard/index.tsx:30](../../src/routes/dashboard/index.tsx#L30)
renders `SidebarProvider > AppSidebar + SiteHeader` as part of the Dashboard component.
If the accounts page renders its own copy of that shell, then even with `<Link>`,
navigating dashboard→accounts unmounts one shell and mounts another. The sidebar's
open/collapsed state resets, the header re-animates, and any scroll position is lost.
It *looks* like a reload even though it technically isn't.

Fix both and navigation becomes instant: the shell renders once, and only the content
under `<Outlet/>` changes.

---

## 2. The layout route — the one structural change everything depends on

Introduce a pathless layout route (per [frontend-architecture.md §4.2](./frontend-architecture.md))
that owns the guard *and* the shell. Every dashboard page becomes a child that renders
only its own content.

```
src/routes/
  _app.tsx                         guard + SidebarProvider + AppSidebar + SiteHeader + <Outlet/>
  _app/dashboard/index.tsx         → /dashboard   (just the page body)
  _app/dashboard.tsx? no — keep it flat:
  _app/accounts/index.tsx          → /accounts
  _app/accounts/$accountId.tsx     → /accounts/:id
```

```tsx
// src/routes/_app.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.session)
      throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <SidebarProvider style={{ '--sidebar-width': 'calc(var(--spacing) * 72)',
                              '--header-height': 'calc(var(--spacing) * 12)' } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />        {/* title comes from route context — see §3 */}
        <Outlet />            {/* ← ONLY this swaps on navigation */}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

What this buys, all at once:

- **The guard runs in one place**, in `beforeLoad`, before render — no more per-page
  `if (!context.session) redirect`. Delete the copy in
  [dashboard/index.tsx:16](../../src/routes/dashboard/index.tsx#L16); accounts never
  needs its own.
- **The shell mounts once.** Sidebar state, header, scroll all survive navigation.
- **Pages shrink to their content.** `dashboard/index.tsx`'s component becomes just the
  cards + chart + table, no provider wrapper.

This is a route *move*, so regenerate the tree (`pnpm generate-routes`) after creating
the files.

---

## 3. Making the sidebar actually navigate

Three fixes in [nav-main.tsx](../../src/components/nav-main.tsx) / [app-sidebar.tsx](../../src/components/app-sidebar.tsx):

**Real routes, not `"#"`.** The nav data in `app-sidebar.tsx` has every `url: "#"`.
Give them real paths and type them as router paths:

```ts
navMain: [
  { title: 'Dashboard', url: '/dashboard', icon: <LayoutDashboardIcon /> },
  { title: 'Accounts',  url: '/accounts',  icon: <WalletIcon /> },
  { title: 'Transactions', url: '/transactions', icon: <ArrowLeftRightIcon /> },
]
```

**`<Link>`, not `<a>`.** Swap the anchor for a router `Link` and let it own the active
state — TanStack's `Link` sets `data-status="active"` and exposes it via
`activeProps`, which is more reliable than the current
`new URL(item.url).pathname === pathname` string match (that `new URL()` call *throws*
on a relative `"#"`, silently falling into the `catch` and marking nothing active):

```tsx
<SidebarMenuButton asChild tooltip={item.title}>
  <Link
    to={item.url}
    activeProps={{ 'data-active': 'true' }}
    activeOptions={{ exact: item.url === '/dashboard' }}   // dashboard shouldn't stay active on /accounts
  >
    {item.icon}
    <span>{item.title}</span>
  </Link>
</SidebarMenuButton>
```

You can then delete the `useLocation` + `new URL` block entirely.

**Preloading is already on.** `router.tsx` sets `defaultPreload: "intent"`, so hovering
a sidebar link prefetches that route's loader data. Combined with the layout route,
clicking a preloaded link paints the new page with data already in hand — no spinner.

---

## 4. Page-level data — loaders, not `data.json`

Both pages fetch through the loader → `ensureQueryData` pattern from
[frontend-architecture.md §3](./frontend-architecture.md), so the shell paints with
data already resolved (SSR + preload), and the component reads it from the same
`queryOptions` via `useSuspenseQuery` — one source of truth, no `useState` copy.

### 4.1 Dashboard (`/dashboard`)

Today it renders static [data.json](../../src/routes/dashboard/data.json). Replace with
a summary query. The dashboard is a *read-only overview*; it should issue one or two
aggregate calls, not re-fetch every transaction.

```tsx
export const Route = createFileRoute('/_app/dashboard/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardSummaryQuery()),
  component: Dashboard,
})
```

- **SectionCards** ← `/api/accounts/summary` ([accounts.md §3.4](./accounts.md)): net
  worth, assets, liabilities, month cashflow. Wire the four cards to real figures via
  `formatMoney`.
- **ChartAreaInteractive** ← a `/api/transactions/summary?groupBy=day` series (or reuse
  balance-history). Its date-range toggle is **URL state** (`?range=30d`), not
  `useState` — so the selection survives refresh and is shareable.
- **DataTable** → the recent-transactions preview: the transactions list query
  ([transactions.md §3.1](./transactions.md)) with `limit=10`, "View all" linking to
  `/transactions`. Don't build the full filterable table here; that's the transactions
  page's job.

### 4.2 Accounts (`/accounts`)

```tsx
export const Route = createFileRoute('/_app/accounts/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery()),
  component: AccountsPage,
})
```

Layout, top to bottom:

- **Net-worth header** — `net-worth-summary` from [accounts.md §4.3](./accounts.md):
  assets / liabilities / net, with the per-currency breakdown.
- **Account grid**, grouped by type (Cash · Credit · Loans · Investments), each card
  showing icon, name, `institution ••mask`, and the derived balance — sign- and
  currency-aware via `balance-display`. Credit cards get a utilisation bar.
- **`+ Add account`** opens the create sheet (`account-form`), not a new route — a
  modal keeps you on the list. Optional deep-link `/accounts/new` via a
  `?` search flag if you want it shareable.
- **Closed accounts** collapsed at the bottom.
- **Empty state** *is* the create form (a user with zero accounts can do nothing else).

Each card links to `/accounts/$accountId` — the detail route with the balance chart and
that account's transactions. That page is a sibling under `_app`, so opening it keeps
the sidebar mounted; only the outlet content changes.

### 4.3 Per-page header title

`SiteHeader` now takes a `title` prop. Rather than thread it through each page, have the
layout read it from the matched route's context. Give each route a `staticData` title
and pull it in `AppLayout`:

```tsx
// in each route: staticData: { title: 'Accounts' }
// in AppLayout:
const matches = useMatches()
const title = [...matches].reverse().find(m => m.staticData?.title)?.staticData.title ?? ''
<SiteHeader title={title} />
```

Now the header updates on navigation without remounting.

---

## 5. What changes, in order

1. **Create `_app.tsx`** with the guard + shell; move `dashboard/` under it and strip the
   shell/guard out of the page. Regenerate routes. *(unblocks everything, fixes the
   "feels like a reload" remount)*
2. **`nav-main` → `<Link>`** with real paths in `app-sidebar`; delete the `new URL`
   active-state hack. *(fixes the actual full-page reload)*
3. **Dashboard data** — summary query replacing `data.json`; range toggle to URL state.
4. **Accounts page** — net-worth header + grouped grid + create sheet, on
   `features/accounts` ([frontend-architecture.md §6](./frontend-architecture.md)).
5. **Account detail** `/accounts/$accountId`.

Steps 1–2 are what your question is actually about; do them first and page switching is
instant. 3–5 are the feature build on top.

---

## 6. Open questions

1. **Should dashboard and accounts share the recent-transactions component?** They render
   the same rows at different sizes. Recommendation: one `TransactionPreviewTable` in
   `features/transactions`, consumed by both — but *not* the full server-driven table
   from [transactions.md §4.2](./transactions.md); that one owns URL filter state the
   dashboard shouldn't inherit.
2. **Add-account: modal vs route.** Modal (`?new` flag) keeps context; a route
   (`/accounts/new`) is deep-linkable. Recommendation: modal, with the search-param flag
   so it's still shareable — cheaper than a route and matches the "stay on the list"
   mental model.
