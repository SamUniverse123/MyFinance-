# Reports query `transactions` directly; the `transaction_lines` view is deferred

`transactions.md` proposes a `transaction_lines` view so split-transaction category attribution works uniformly across reports. Zero split transactions and zero scheduled transactions exist anywhere in the dev database — nothing in the app produces splits yet. The dashboard's cashflow/category aggregations query `transactions` directly instead of building the view.

Building a reporting abstraction for a feature (splits) that doesn't exist yet is exactly the premature generalization worth avoiding. Revisit once splits ship and something actually needs split-aware reporting — at that point existing dashboard queries will need updating to read the view instead.
