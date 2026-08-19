# Transaction sub-views (Transactions / Payees / Recurring) are tabs on one route

The `/transactions` page hosts three sub-views as **client-state tabs on a single route**, with the active tab synced to a `?tab=` search param (absent = Transactions). This **supersedes** the earlier decision (ADR-0012's companion payee-management design, Q10/Q11) that made **Payees its own route** (`/transactions/payees`); that route now 301s to `/transactions?tab=payees`.

We switched because the tab UI uses animate-ui's Radix `Tabs`, whose animated panel transition only works when all panels render inside one component with shared state — separate routes remount and can't cross-animate. Keeping the animation *and* bookmarkability meant one route plus `?tab=` sync rather than a route per tab. `currency`/`view` (ADR-0009/0011) stay on the same search schema and apply only within the Transactions tab. The transaction **detail** page (`/transactions/$transactionId`) remains a separate route — it's a drill-in, not a tab.

## Consequences

- Each panel owns its own loading/error/empty states (rather than the page early-returning), so the tab bar stays reachable while any one panel resolves.
- Header actions are driven by the active tab: Transactions → currency toggle + Add transaction; Payees → Add payee; Recurring → none.
- animate-ui's Radix tabs added **zero npm dependencies** (`motion` + `radix-ui` were already present); no ADR was warranted for that choice on its own.
