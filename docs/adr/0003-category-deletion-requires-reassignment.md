# Category deletion requires reassignment, never cascades or nulls silently

Neither `transactions.categoryId` nor `categories.parentId` declares an `onDelete` rule, so Postgres already defaults to `RESTRICT` — deleting a referenced category fails at the DB level today. We're keeping that and building a UI flow that forces the user to pick a replacement category for any orphaned transactions or subcategories before the delete is allowed, rather than relaxing the FKs to `SET NULL` or `CASCADE`.

Silently falling back to "uncategorized" (or deleting subcategories along with their parent) would misrepresent historical spending in reports without the user noticing. A blocked delete with an explicit reassignment prompt costs one extra step but keeps the ledger honest.
