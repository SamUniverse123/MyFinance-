# Budgets become per-category on a dedicated page; currency toggle extends to it

The budget started as a single monthly limit per currency (`budgets` table: `(userId, currency) → amount`), surfaced only as one card on the dashboard. That answers "am I over my ceiling this month?" but not the question a budget is actually for: *which* categories are eating the money. This ADR expands budgets into their own page with per-category limits, keeping the existing per-currency total as an independent rollup.

## Decisions

- **Two independent layers, not a hierarchy of sums.** The existing per-currency **overall budget** (`budgets` table) stays exactly as-is and independently editable. New **category budgets** are an additive layer in a new `category_budgets` table keyed `(categoryId, currency)`. The overall total is deliberately *not* forced to equal the sum of category budgets — real budgeting is "a rough overall ceiling plus a few categories tracked precisely," not a fully-allocated envelope. Retiring the standalone total would also be a breaking migration of a shipped feature for no user benefit.

- **Top-level expense categories only.** Budgets attach to top-level categories of `kind = 'expense'`. Income categories don't fit a "spend limit" framing. Subcategories can't carry their own budget — letting a parent and child each hold one creates a double-counting question with little payoff (ADR-0001 caps the hierarchy at two levels anyway).

- **Subcategory spend rolls up to the parent.** A transaction categorized under a subcategory (e.g. "Dining › Coffee") counts against its top-level parent's budget bar. Attribution: `coalesce(category.parentId, category.id)`. Without this, budget bars would miss most real spend.

- **Uncategorized / split / transfer spend** never counts against any category bar (there's nothing to attribute it to) but **still counts in the overall total's "spent" figure** — consistent with the dashboard's existing `monthExpense`, which has no category filter. No separate "Uncategorized" bucket UI.

- **Spend history is aggregate and unversioned.** One chart: total spend vs. the *current* overall budget over a fixed 6-month lookback. We do **not** store what the budget was in past months — the threshold line reflects today's budget applied backward. Real historical budgeting (a `month`/`period` column, versioned amounts) is deferred until "what was my budget in March" demonstrably matters.

- **Currency toggle extends to `/budgets`.** Because both the overall total and category budgets are per-currency data, the page carries the same `?currency=` toggle as the dashboard and transactions pages. This **extends ADR-0009's stated scope** ("the toggle applies to the dashboard and transactions pages only, for now") — the "for now" is now spent. Still no FX conversion or blending; each currency's budgets are independent (ADR-0006/0009 unchanged in spirit).

## Consequences

- New `category_budgets` table (see `src/db/schema/schemas.ts`) and a `GET /api/budgets/summary?currency=` endpoint that returns the overall figure, per-category rows, and the 6-month history in one shot (same "one summary endpoint per page" rationale as ADR-0005's dashboard endpoint).
- The dashboard's `BudgetCard` becomes read-only (overall total + progress) with a "View budgets" link; all editing moves to the new page, so there's one edit surface for budgets rather than two.
- A new sidebar entry "Budgets" sits between Categories and Projects.
- Month-window math on the new endpoint uses **local** calendar boundaries, matching the fix applied to the dashboard endpoint (transaction dates are naive local dates; a UTC boundary drops "today" for users east of UTC).

## Update — category budget ring chart

The "Categories" card gains a **ring chart** (bklit `@bklit/ring-chart`, same registry family as ADR-0008) above the category widgets, which double as its legend:

- **One ring per budgeted category**, arc = `spent / budget`, **clamped to a full ring** when over budget (an un-clamped arc would overshoot a full circle and self-overlap). Un-budgeted categories get no ring but still appear as widgets. Ring omitted entirely when nothing is budgeted.
- **Ring colors = category colors** (`getCategoryColor`), so a ring identifies its category by color — which is what makes the hover correspondence legible. Over-budget is *not* recolored (it would break that mapping); the "over" signal stays in the widget.
- **Center** is a custom overlay (not bklit's `RingCenter`) showing total spent across budgeted categories, or the hovered category's actual spend — rendered ourselves so it can show real spend even where the arc is clamped.
- **Bidirectional hover**: a single `hoveredId` is lifted to the page and drives both the ring (`RingChart`'s controlled `hoveredIndex`) and the widgets (`highlighted`/`dimmed`), so hovering either surface spotlights the category and fades the rest.
- **Dependency note (extends ADR-0008):** required installing `@visx/group@4.0.1-alpha.0`, which was already listed in `pnpm` `patchedDependencies` (extensionless-import SSR fix) but not actually installed. The other ring deps (`@visx/shape`, `@visx/responsive`, `motion`, `@number-flow/react`) were already present.
