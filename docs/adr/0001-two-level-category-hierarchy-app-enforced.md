# Two-level category hierarchy, enforced in application code

`categories.parentId` is a self-referential FK, so the schema permits arbitrary nesting depth. We're capping the hierarchy at two levels (category → subcategory, no grandchildren) and requiring a subcategory's `kind` to match its parent's, both enforced in the API layer rather than as DB constraints — a self-join CHECK constraint for depth is awkward in Postgres/Drizzle and not worth the complexity. Unlimited depth wasn't a product requirement; two levels matches how comparable apps (YNAB, Mint, Copilot) present categories and keeps the tree UI and future budget rollups simple.

Consequence: nothing in the database prevents a direct SQL insert from violating either rule — every write path through the API must validate depth and kind-matching itself.

`kind` is editable after creation, not fixed at creation time — but gated by the same rule: a top-level category can only change kind while it has no subcategories, and a subcategory changing kind must simultaneously move under a parent of the new kind (or be promoted to top-level). No separate mutability rule was needed; kind-matching already covers it.
