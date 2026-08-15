# Transactions page: a 7-day preview list that expands into a full-history table

The transactions page fetched every transaction and rendered all of it as one day-grouped list — no time scoping, no alternate format. This ADR splits it into a recent-activity **preview** and a full-history **table**, without changing the fetch-everything data model.

## Decisions

- **The list is a fixed 7-day preview.** By default the page shows only transactions from the past rolling week (local calendar, matching the date handling elsewhere). The window is **not** adjustable — "recent activity" is the list's whole job, and "See more" is the designated way past it, so a range picker here would duplicate that.

- **Full history is reached via "See more" → a table view, reversible via "Show less".** Not a symmetric list/grid toggle: framing the list as a preview and the table as "everything" resolves the otherwise-ambiguous question of whether switching format also keeps the week filter. The expanded state lives in the URL (`?view=table`), consistent with `?currency=`/`?range=` on other pages — shareable, refresh-safe, and carried across a currency switch. The button is shown **whenever the list is non-empty**, not only when older-than-a-week transactions exist: the table is a materially different view (sortable, searchable, column controls), so gating it on row count would make it undiscoverable for users whose activity all fits in the past week.

- **The table is read-only and sortable, not editable.** Columns: Merchant/Description, Category, Account, Date, Amount. Clicking a row opens the transaction detail page (same as the list). Sortable on Category, Date, Amount. **No** inline category editing (a materially bigger per-cell-mutation feature with no precedent — category changes go through the full form today).

- **Ships with client-side search and column-visibility; filtering is deferred.** Search filters the in-memory list by payee/note (no backend, no debounce needed). Column visibility is a checkbox menu persisted to `localStorage` (same pattern as the Accounts page's list/grid preference). A multi-facet **filter** panel is deliberately out of scope — it has real cost and an unresolved question (does it apply within the week preview too?) that wants its own design pass.

- **No pagination.** Continues the app-wide fetch-all/render-all pattern; the table scrolls horizontally on small screens rather than falling back to the list.

- **One shared summary across both views, computed from the visible scope.** The money-in/out summary (previously baked into the list) is extracted and reused: it reflects the past week on the list, the full history in the table. It gains a **transaction count**; it does **not** get a "date range" stat (redundant when the scope is always either "past week" or "all history").

- **Category badge added to both surfaces.** List rows previously showed no category at all; building the badge (icon + color via `category-visuals.tsx`) for the table makes it free to show on list rows too.

- **A distinct "nothing in the past week" empty state** (with a jump to "See more"), separate from the existing "no transactions ever" state — the old `transactions.length === 0` check wouldn't fire for a user with history but a quiet week.
