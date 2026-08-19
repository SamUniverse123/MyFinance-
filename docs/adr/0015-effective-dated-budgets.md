# Budgets are effective-dated, not constant

The budgets page gained a month toggle (`< August 2026 >`) letting the user view any past month up to the current one. That turned budgets from a single perpetual number per `(user, currency)` / `(category, currency)` into an **effective-dated history**: `budgets` and `category_budgets` gain a `month` column (first-of-month) in the primary key, and `amount` becomes nullable.

## Decisions

- **A row means "this amount, starting this month."** A month's *effective* budget is the most recent row at or before it (carry-forward). Setting a budget while viewing month M writes/updates the row at M only — it never rewrites earlier months, and it takes effect from M onward until a later row overrides it. A month you never touch stores no row, so histories stay sparse.

- **Clearing is a forward-only tombstone, not a delete.** Clearing while viewing month M writes a row at M with `amount = null` ("no budget from M on"). Earlier months keep whatever was effective for them. This is the exact mirror of the set rule — both only ever affect month M forward — so the two operations share one mental model. (This is why `amount` is nullable and why clears `INSERT` rather than `DELETE`.)

- **The whole page re-scopes to the selected month**, including the 6-month trend chart: its window ends at the selected month, and its reference line **steps per month** to each month's effective budget rather than drawing one flat line (a flat line would misrepresent history the moment a budget changed inside the window).

- **Left bound = earliest month with a transaction** in the selected currency; **right bound = current month** (no future budgets). Both are per-currency.

- **Existing rows backfilled to the earliest navigable month** (`scripts/migrate-budget-months.sql`), so pre-existing budgets appear to have always applied and nothing changes visually on deploy — rather than backfilling to "now", which would blank every past month.

## Consequences

- The dashboard's budget card resolves the current month's effective budget (latest row ≤ this month), not a single `(user, currency)` row.
- `PATCH /api/budgets/:currency` and `/categories/:categoryId` now require a `month`; both upsert (set or null-tombstone) and never delete.
