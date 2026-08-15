# Multi-currency is a view toggle, not FX conversion — no `fx_rates` table

ADR-0006 predicted that real multi-currency usage would eventually force building FX conversion (`accounts.md` §2.4's proposed `fx_rates` table). A real user now holds accounts in two currencies (MYR, SGD), but rather than convert-and-blend into one number, the dashboard and transactions pages get a **currency toggle**: the user picks one of their currencies at a time, and every figure — net worth, cashflow, budget, the transaction list — scopes to that currency alone. No conversion happens anywhere.

This isn't a stopgap on the way to FX — it's the considered answer. A converted blended total is always slightly wrong (rates move, spreads aren't modeled) and answers a question ("what's everything worth in one number") the user didn't actually ask for; scoping answers the question a multi-currency user actually has ("how am I doing in *this* currency"), with every figure exact. `fx_rates` and the `accounts.md` §2.4 proposal stay unbuilt. Revisit only if a real need for a single blended total emerges — the toggle doesn't preclude adding conversion later, it just isn't the mechanism now.

## Settled specifics

- **Scope**: the toggle applies to the **dashboard** and **transactions** pages only, for now. Account detail and other pages are unchanged. _(Update: [[0010-per-category-budgets-and-budgets-page]] extends this to the new **budgets** page — the "for now" is spent.)_
- **Selection lives in the URL**, one `?currency=` param per page, independent between the two pages (same pattern as the dashboard's existing `?range=`). Shareable/bookmarkable; the two pages may sit on different currencies without that being a sync bug.
- **Default** (no `?currency=` yet): `userSettings.baseCurrency` when set, else the most-common account currency via the existing `inferBaseCurrency`. No new base-currency picker is built now — the stored/inferred value is the default toggle position.
- **Everything scopes to the selected currency**: net worth, cashflow, month income/expense, the budget card, the spending calendar, *and* the transaction row list (not just its summary). No figure ever mixes currencies.
- **Budgets become per-currency.** `userSettings.monthlyBudget` (a single amount that borrowed the display currency) moves to a small `(userId, currency) → amount` table; a MYR budget and an SGD budget are independent. The existing single value migrates to a row keyed by that user's base currency.
- **Single-currency users see no toggle** — with only one currency there's nothing to switch, so the page renders as it does today.
- The net-worth hero's old **"Not counted (different currency)" line is removed** — the toggle replaces it (you switch to that currency to see it), so it's now redundant.
