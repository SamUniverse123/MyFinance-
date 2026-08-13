# System categories are seeded per-user, not stored as global rows

`categories.userId` is `NOT NULL`, so there's no representation for a single shared "system" category — every category, system or not, belongs to exactly one user. We're seeding system categories (e.g. "Balance Adjustment", per `docs/design/accounts.md`) into each user's own category list at signup, flagged `isSystem`, rather than making `userId` nullable to support true global rows.

Considered making `userId` nullable so system categories could be single global rows referenced by everyone. Rejected: every existing query already scopes categories by `userId`, and a nullable-owner special case would ripple through all of them for a handful of rows.

Note transfers do *not* get a system category — `docs/design/transactions.md` has transfer legs carry `categoryId: null` directly, since a transfer is neither income nor expense. The seeded set is exactly `Balance Adjustment`, nothing more: no ordinary starter categories (e.g. "Groceries") are pre-populated. Users build their own list from a clean slate rather than inheriting someone else's assumptions about their spending.

`Balance Adjustment` is seeded with `kind: expense`, arbitrarily — `category.kind` is a strict `income`/`expense` enum with no neutral option, but an adjustment can move a balance either direction. `kind` only groups categories for picker/report display; the transaction's own signed `amount` is the actual source of truth for direction, so one category suffices rather than seeding one per direction.
