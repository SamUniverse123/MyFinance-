# Dashboard ships a minimal, dashboard-specific summary endpoint, not the general one

`accounts.md` and `transactions.md` document a fuller, reusable API surface (`GET /api/accounts/summary` with FX-aware net worth, `GET /api/transactions/summary?groupBy=day`) that nothing has built yet. We're building a smaller, dashboard-specific aggregation endpoint now — just what the four stat cards and the cashflow chart need — rather than the fully general one those docs describe.

The general endpoints carry requirements (FX conversion, arbitrary `groupBy`) that nothing in the app needs yet — the only consumer would be this dashboard. Building the general version first is speculative work against a spec that itself defers FX handling. Generalize when a second consumer (e.g. the accounts page's net-worth header) actually needs the same shape.
