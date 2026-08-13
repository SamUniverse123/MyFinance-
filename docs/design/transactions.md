# Transactions Management — Design

Status: proposed · Owner: @samUniverse123 · Last updated: 2026-08-06
Companion to [accounts.md](./accounts.md) — money conventions, the service layer,
`AppError`, and `assertAccountOwned` are defined there and assumed here.

Transactions are the only table in this app that grows without bound and the only
one the user touches every day. Two things follow from that, and they drive every
decision below: **reads must be paginated and indexed from day one**, and **entry
must be fast enough to do fifty times in a row**.

---

## 1. Core decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **`kind` discriminator column** | `category_id IS NULL` currently means three different things — uncategorised, split, or transfer. Reports can't distinguish them without a join. |
| 2 | **Reports read a `transaction_lines` view, never `transactions`** | A split transaction has no single category. One view flattens splits and non-splits into a uniform stream so every report has one shape to query. |
| 3 | **Keyset (cursor) pagination, never `OFFSET`** | Offset pagination degrades linearly and skips/duplicates rows when new transactions land above the cursor — which they constantly do. |
| 4 | **Filter state lives in the URL** | TanStack Router's `validateSearch` makes the filtered view shareable, bookmarkable, and back-button-correct for free. |
| 5 | **Soft delete (`deleted_at`)** | Bulk delete is a first-class operation here. Undo has to be real, not a hope. |
| 6 | **Both legs of a transfer move together** | Editing or deleting one leg without the other silently unbalances the ledger. |
| 7 | **Rules run at write time, not read time** | A categorised transaction stays categorised even after the rule changes. Re-running rules is an explicit user action with a preview. |
| 8 | **Recurring transactions materialise lazily** | There is no worker process in this stack. A catch-up pass on read is simpler than infrastructure that doesn't exist yet. |

---

## 2. Data model

### 2.1 Columns to add to `transactions`

```ts
export const txnKind = pgEnum('txn_kind', ['standard', 'split', 'transfer'])

export const transactions = pgTable('transactions', {
  // ... existing columns

  kind:      txnKind('kind').notNull().default('standard'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // stable tiebreaker for keyset pagination — `date` has no time component
  // and same-day entries are the common case, not the edge case
  seq:       bigserial('seq', { mode: 'number' }).notNull(),
}, (t) => [
  // the list query's covering index: newest-first within a user, live rows only
  index('transactions_user_feed_idx')
    .on(t.userId, t.date.desc(), t.seq.desc())
    .where(sql`${t.deletedAt} is null`),
  index('transactions_account_date_idx').on(t.userId, t.accountId, t.date.desc(), t.seq.desc()),
  index('transactions_category_idx').on(t.userId, t.categoryId),
  index('transactions_payee_idx').on(t.userId, t.payeeId),
  index('transactions_transfer_group_idx').on(t.transferGroupId),
  index('transactions_uncategorized_idx')
    .on(t.userId, t.date.desc())
    .where(sql`${t.categoryId} is null and ${t.kind} = 'standard' and ${t.deletedAt} is null`),
  uniqueIndex('transactions_external_uq')
    .on(t.userId, t.source, t.externalId)
    .where(sql`${t.externalId} is not null`),
  // a scheduled transaction posts at most once per occurrence date
  uniqueIndex('transactions_scheduled_occurrence_uq')
    .on(t.scheduledId, t.date)
    .where(sql`${t.scheduledId} is not null`),
])
```

**On `seq`:** `date` is a `date`, not a `timestamp`. Ten transactions entered on
the same day are tied, and a cursor over a tied column either loses rows or repeats
them. `created_at` isn't sufficient either — bulk imports share a timestamp. A
`bigserial` gives a total order for free.

**On soft delete:** every query pays `and deleted_at is null`. That is the price of
a working undo on a bulk operation that can wipe 500 rows, and the partial indexes
above absorb it. Add a nightly `DELETE ... WHERE deleted_at < now() - interval '30 days'`
when you get around to it.

### 2.2 The `kind` discriminator

| `kind` | `category_id` | Splits | Meaning |
|---|---|---|---|
| `standard` | set | none | An ordinary categorised transaction |
| `standard` | `NULL` | none | **Uncategorised** — needs the user's attention, drives the inbox badge |
| `split` | `NULL` (always) | ≥ 2 | Categories live on the split rows |
| `transfer` | `NULL` (always) | none | Paired by `transfer_group_id`; not income, not expense |

Without this column, "how many uncategorised transactions do I have?" requires a
`NOT EXISTS` against splits plus a `transfer_group_id IS NULL` check, on the hottest
badge query in the app.

### 2.3 `transaction_lines` — the reporting view

Reports care about *category attribution*, and a split transaction attributes to
several categories at once. Rather than making every report handle both shapes:

```sql
CREATE VIEW transaction_lines AS
  -- non-split transactions contribute one line each
  SELECT t.id AS transaction_id, NULL::uuid AS split_id, t.user_id, t.account_id,
         t.category_id, t.payee_id, t.amount, t.currency, t.date, t.status, t.kind
  FROM transactions t
  WHERE t.kind <> 'split' AND t.deleted_at IS NULL
UNION ALL
  -- split transactions contribute one line per split
  SELECT t.id, s.id, t.user_id, t.account_id,
         s.category_id, t.payee_id, s.amount, t.currency, t.date, t.status, t.kind
  FROM transactions t
  JOIN transaction_splits s ON s.transaction_id = t.id
  WHERE t.kind = 'split' AND t.deleted_at IS NULL;
```

Budgets, category reports, and cashflow charts read `transaction_lines`. The
transaction list and account balances read `transactions` — a split's parent
already carries the full amount, so summing lines *and* parents would double-count.
That split of responsibility is the whole point of having both.

> Note: `SUM(amount)` for account balances must exclude `kind = 'transfer'`? **No** —
> transfers genuinely move money in and out of accounts and belong in the balance.
> They must be excluded from *income/expense* reporting, which is what `kind` is for.

### 2.4 Splits

`transaction_splits` exists. The invariant `SUM(splits.amount) = parent.amount` is
enforced in the service inside a DB transaction, and re-checked on every split
mutation. Additional rules:

- Minimum 2 splits; a 1-split transaction is a `standard` transaction.
- Every split shares the parent's sign — mixed signs mean the user wanted two
  transactions, not one split.
- Deleting down to 1 split converts the parent back to `kind: 'standard'` and lifts
  that split's category onto the parent.
- The parent's `category_id` is force-nulled on conversion to `split`.

### 2.5 Payees: `payee_id` vs `payee_name`

Both columns exist, which is right — imports carry raw merchant strings that don't
match anything yet. The resolution rule:

- `payee_name` is always the **raw display string** (`"SQ *BLUE BOTTLE 4412"`).
- `payee_id` is the **resolved entity**, set when a rule matches or the user picks
  one from the combobox.
- The UI shows the payee's name when `payee_id` is set, otherwise `payee_name`.
- Creating a payee from the entry form does a `INSERT ... ON CONFLICT (user_id, name)
  DO UPDATE RETURNING id` — the `payees_user_name_uq` constraint already exists, and
  two rapid entries of the same new payee must not race into an error.

---

## 3. Server design

### 3.1 The list endpoint

This is the endpoint everything else hangs off; it deserves the most care.

```
GET /api/transactions
  ?accountIds=uuid,uuid      &categoryIds=…  &payeeIds=…  &tagIds=…
  &from=2026-01-01           &to=2026-03-31
  &minAmount=-50000          &maxAmount=0
  &status=pending,cleared    &source=manual,import
  &kind=standard,transfer    &uncategorized=true
  &q=coffee                  &sort=date_desc|date_asc|amount_desc|amount_asc
  &cursor=<opaque>           &limit=50
```

Response:

```jsonc
{
  "items": [ /* TransactionListItem[] — see §3.2 */ ],
  "nextCursor": "eyJkIjoiMjAyNi0wMS0xNCIsInMiOjkxMjJ9",  // null when exhausted
  "totals": { "count": 412, "inflow": 820000, "outflow": -612300, "net": 207700 }
}
```

`totals` is computed over the **whole filtered set**, not the page — "what did I
spend on groceries in Q1" is answered by the filter bar, and a per-page total would
be a lie. It's a second aggregate query against the same predicate; run both in
`Promise.all`.

**Cursor encoding.** Base64 of `{ d: date, s: seq }`, matching the sort:

```sql
WHERE (date, seq) < (:cursorDate, :cursorSeq)   -- for date_desc
ORDER BY date DESC, seq DESC
LIMIT :limit
```

Row-value comparison, so `transactions_user_feed_idx` serves it as a single index
range scan regardless of depth. Amount sorts need `(amount, seq)` and their own
index — add it only when that sort ships.

**Text search.** `q` matches `payee_name` and `note`. Start with `ILIKE '%q%'` behind
a trigram index; don't reach for `tsvector` until the user asks for phrase search:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX transactions_search_idx ON transactions
  USING gin ((coalesce(payee_name,'') || ' ' || coalesce(note,'')) gin_trgm_ops);
```

**Tag filtering** is a semi-join against `transaction_tags`, not a join — a
transaction with three matching tags must appear once:

```sql
AND EXISTS (SELECT 1 FROM transaction_tags tt
            WHERE tt.transaction_id = t.id AND tt.tag_id = ANY(:tagIds))
```

### 3.2 Response shape

The list must not N+1 into accounts, categories, payees, and tags. Two options; take
the first:

- **Join the display fields** the row actually renders (`accountName`, `categoryName`,
  `categoryColor`, `payeeName`, plus tags via `array_agg`). One query, one round trip.
- Return bare IDs and let the client hydrate from its cached
  accounts/categories/payees lists. Fewer bytes, but every list render now depends on
  three other queries having resolved.

```ts
type TransactionListItem = {
  id: string; date: string; amount: number; currency: string
  kind: 'standard' | 'split' | 'transfer'
  status: 'pending' | 'cleared' | 'reconciled'
  note: string | null
  account:  { id: string; name: string; color: string | null }
  category: { id: string; name: string; color: string | null } | null
  payee:    { id: string | null; name: string | null }
  tags: { id: string; name: string; color: string | null }[]
  transferGroupId: string | null
  counterAccount: { id: string; name: string } | null   // populated for transfers
  splitCount: number
}
```

`counterAccount` is what makes a transfer row readable ("→ Savings" instead of a
bare negative number), and it's a cheap self-join on `transfer_group_id`.

### 3.3 Full API surface

| Method | Path | Notes |
|---|---|---|
| `GET` | `/` | §3.1 |
| `POST` | `/` | Single create. Runs rules unless `?applyRules=false`. |
| `GET` | `/:id` | Full detail incl. splits and tags |
| `PATCH` | `/:id` | Blocked on `reconciled` (§3.6); syncs transfer legs |
| `DELETE` | `/:id` | Soft delete; deletes both transfer legs |
| `POST` | `/bulk` | `{ ids[], action }` — categorise, tag, untag, status, delete, restore |
| `POST` | `/:id/splits` | Replace the full split set atomically |
| `DELETE` | `/:id/splits` | Collapse back to `standard` |
| `PUT` | `/:id/tags` | Replace tag set |
| `POST` | `/import/preview` | Parse + dedupe + rule-match, persist nothing |
| `POST` | `/import/commit` | Insert the reviewed rows |
| `POST` | `/rules/apply` | `{ ruleIds?, filter?, dryRun }` — re-run rules over existing rows |
| `GET` | `/uncategorized/count` | Cheap badge query, hits the partial index |
| `POST` | `/api/transfers` | Defined in [accounts.md §3.6](./accounts.md) |

Scheduled transactions get their own router at `/api/scheduled` (§3.7) — they are
templates, not transactions, and mixing them into this router's list semantics
would be a mistake.

### 3.4 Write-path validation

Every FK arriving from a client is checked for ownership, in one place:

```ts
async function assertRefsOwned(userId: string, input: TxnInput, tx = db) {
  const account = await assertAccountOwned(userId, input.accountId, tx)
  if (input.categoryId) await assertOwned(categories, userId, input.categoryId, tx)
  if (input.payeeId)    await assertOwned(payees,     userId, input.payeeId,    tx)
  if (input.tagIds?.length) await assertAllOwned(tags, userId, input.tagIds,    tx)

  if (input.currency && input.currency !== account.currency)
    throw new AppError('invalid', 422, `Account is in ${account.currency}`)
  assertPostable(account, input.date)   // rejects dates after account.closed_at
  return account
}
```

Currency is **derived from the account**, not accepted from the client. A transaction
in a currency its account doesn't use has no meaning under the balance formula in
[accounts.md §1](./accounts.md).

Server-assigned, never accepted from the request body:
`id`, `userId`, `currency`, `kind`, `transferGroupId`, `scheduledId`, `source`,
`externalId`, `seq`, `createdAt`, `updatedAt`, `deletedAt`.

> **Live bugs this closes** in [transactions.ts](../../src/server/routes/transactions.ts):
> - `:12` — `createInsertSchema(transactions)` accepts `accountId` with no ownership
>   check. Any authenticated user can write into another user's account.
> - `:19` — `createUpdateSchema(transactions).partial()` leaves `userId` writable, and
>   `:57` spreads it straight into `.set()`. A client can reassign its own transaction
>   to another user by ID.
> - `:60` — `PATCH` returns `201`; it should be `200`.
> - `:27` — the list returns every transaction the user has ever recorded, unpaginated,
>   and wraps it in `{ data }` while [accounts.ts](../../src/server/routes/accounts.ts)
>   returns a bare array. Pick one envelope; this doc assumes the object form
>   (`{ items, nextCursor, totals }`) for lists and a bare object for single resources.
> - Deleting one leg of a transfer leaves the other leg orphaned and the ledger
>   unbalanced.

### 3.5 Transfer coupling

A transfer is one logical row rendered twice. The service enforces that:

- **Edit** `date`, `note`, or `status` → applied to both legs.
- **Edit** `amount` on either leg → the counter-leg's amount is negated to match,
  *unless* the pair is cross-currency, where the two amounts are independent and the
  client must send both.
- **Edit** `accountId` → rewrites that leg only (moving one side of the transfer).
- **Delete** either leg → both legs soft-delete together, in one DB transaction.
- **Category** may never be set on a transfer leg.
- Converting a `standard` transaction into a transfer creates the counter-leg;
  converting away deletes it.

All of this lives in `services/transactions.ts` and is unreachable from the route
handler by any path — that's what keeps the ledger balanced.

### 3.6 Status and locking

`pending → cleared → reconciled` is a progression, and `reconciled` means "I checked
this against a bank statement."

- Editing a `reconciled` transaction's `amount`, `date`, or `accountId` returns `409`.
  The user must explicitly un-reconcile first, which is one click and one audit line.
- `note`, `category`, and `tags` stay editable while reconciled — they're bookkeeping,
  not ledger facts.
- Bulk status changes are allowed in both directions; the lock is about accidental
  edits, not about preventing correction.

### 3.7 Recurring transactions

`scheduled_transactions` holds templates with `next_run_date`, `frequency`,
`interval`, `auto_post`. With no worker process in this stack, materialise lazily:

```ts
// runs at the top of GET /transactions and GET /accounts, cheap when nothing is due
export async function catchUpScheduled(userId: string, today: string) {
  const due = await db.select().from(scheduledTransactions).where(and(
    eq(scheduledTransactions.userId, userId),
    eq(scheduledTransactions.isActive, true),
    lte(scheduledTransactions.nextRunDate, today),
  ))
  for (const s of due) {
    await db.transaction(async (tx) => {
      // advance one occurrence at a time so a dormant account catches up correctly
      while (s.nextRunDate <= today && (!s.endDate || s.nextRunDate <= s.endDate)) {
        if (s.autoPost) {
          await tx.insert(transactions)
            .values({ /* … */ scheduledId: s.id, date: s.nextRunDate, source: 'recurring' })
            .onConflictDoNothing()          // transactions_scheduled_occurrence_uq
        }
        s.nextRunDate = advance(s.nextRunDate, s.frequency, s.interval)
      }
      await tx.update(scheduledTransactions).set({ nextRunDate: s.nextRunDate }).where(…)
    })
  }
}
```

The unique index on `(scheduled_id, date)` plus `onConflictDoNothing` makes this
idempotent under concurrent requests — two browser tabs hitting the list endpoint at
once cannot double-post rent.

`auto_post: false` templates don't insert; they surface as an "upcoming" section the
user confirms. Month-end dates need care: `advance('2026-01-31', 'monthly', 1)` must
give `2026-02-28`, and the *anchor* stays the 31st so March returns to the 31st.
Clamp from `anchor_date`, never from the previous occurrence.

### 3.8 Rules engine

```ts
export function applyRules(rules: Rule[], input: TxnInput): TxnInput {
  // priority ascending; later matches overwrite earlier ones
  for (const r of rules.filter(r => r.isEnabled).sort((a, b) => a.priority - b.priority)) {
    if (!matches(r, input)) continue
    if (r.setCategoryId && !input.categoryId) input.categoryId = r.setCategoryId
    if (r.setPayeeId    && !input.payeeId)    input.payeeId    = r.setPayeeId
  }
  return input
}
```

Two deliberate choices: **all** matching rules apply (not first-match-wins — one rule
sets a category, another sets a payee), and a rule **never overwrites a value the user
explicitly set**. Rules fill blanks; they don't argue with the user.

`POST /rules/apply` re-runs them over existing transactions with `dryRun: true` first,
returning the before/after diff for confirmation. Retroactive recategorisation without
a preview is how a user loses six months of manual work in one click.

### 3.9 Import

Two phases, because a bad CSV mapping discovered *after* the insert is expensive:

1. **`POST /import/preview`** — parse the file, map columns, normalise the sign
   convention, compute `externalId`, mark rows that collide with the
   `transactions_external_uq` index as `duplicate`, run rules in dry-run, and return
   the whole set for review. Persists nothing.
2. **`POST /import/commit`** — insert the rows the user kept, in one DB transaction,
   with `source: 'import'` and `onConflictDoNothing` on the external-ID index.

When the source file has no stable ID, derive one deterministically —
`sha256(accountId | date | amount | rawDescription)` — so re-importing an overlapping
statement is a no-op rather than a duplicate. Note the failure mode honestly: two
genuinely identical transactions on the same day (two $3.50 coffees) hash the same
and the second is dropped. Append an occurrence index within the file to fix it.

---

## 4. Client design

### 4.1 Filter state in the URL

```ts
// src/routes/dashboard/transactions/index.tsx
export const Route = createFileRoute('/dashboard/transactions/')({
  validateSearch: transactionFiltersSchema,        // zod, all fields optional
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureInfiniteQueryData(transactionsInfiniteQuery(deps)),
  component: TransactionsPage,
})
```

Every filter control is a `navigate({ search })` call. Back button works, links are
shareable, refresh preserves the view, and there is no second copy of filter state to
keep in sync with the query key — `loaderDeps` *is* the query key.

### 4.2 The table

The existing [data-table.tsx](../../src/components/data-table.tsx) is the shadcn
dashboard demo: client-side `getPaginationRowModel` over a static `data.json`. It is a
useful reference for the drag/drop and column-visibility wiring, but **it can't back
this list** — it assumes the whole dataset is in memory. Build a sibling with
`manualPagination`, `manualSorting`, and `manualFiltering`, driving
`useInfiniteQuery` + an intersection-observer sentinel row.

Columns: `[select] · date · payee · category · account · tags · amount · status`.
Amount is right-aligned, tabular-nums, sign-coloured. Rows for `kind: 'transfer'`
render `→ Counter Account` in the category slot and are visually muted — they aren't
spending.

### 4.3 Entry and editing

Two paths, because they serve different moods:

- **Quick-add row** pinned at the top of the table: date, payee, amount, category. Enter
  saves and returns focus to the date field for the next entry. This is the path used
  fifty times in a row and it must never open a modal.
- **Detail drawer** for everything else — splits, tags, notes, status, attachments
  later. The `Drawer` component is already in the project and already used this way in
  the demo table.

Inline editing on the category cell (the single most-changed field) via a combobox
popover, committed on select with an optimistic update.

### 4.4 Bulk operations

Checkbox selection surfaces a floating action bar: **Categorise · Tag · Mark cleared ·
Delete**. Delete fires the soft-delete endpoint and shows a `sonner` toast with an
Undo action wired to `/bulk { action: 'restore' }`. Selection is capped
(2,000 rows) and "select all matching filter" sends the *filter*, not 2,000 IDs.

### 4.5 Cache invalidation

Transaction writes change account balances, category totals, and budget progress.
Anything less than this leaves stale numbers on screen:

```ts
onSettled: () => {
  qc.invalidateQueries({ queryKey: transactionKeys.all })
  qc.invalidateQueries({ queryKey: accountKeys.all })     // balances are derived
  qc.invalidateQueries({ queryKey: budgetKeys.all })
}
```

Optimistic updates on the fast paths only — category change, status toggle, tag
add/remove, delete. Creates are not optimistic: the server assigns `seq`, applies
rules, and may resolve a payee, so the returned row differs from what was sent.

### 4.6 Feature module

```
src/features/transactions/
  api.ts            apiClient.transactions.* wrappers
  queries.ts        transactionsInfiniteQuery, transactionQuery, uncategorizedCountQuery
  mutations.ts      create/update/delete/bulk/splits/tags
  filters.ts        zod search schema + URL helpers (shared with the route)
  components/
    transaction-table.tsx        server-driven TanStack Table
    transaction-row.tsx
    quick-add-row.tsx
    transaction-drawer.tsx       detail + edit
    split-editor.tsx             enforces Σ splits = parent, live remainder
    filter-bar.tsx               chips reflecting URL state
    bulk-action-bar.tsx
    amount-input.tsx             parses "12.34", "-12.34", "12,34" → minor units
    date-range-picker.tsx
```

`amount-input.tsx` pairs with `parseMoney` from [accounts.md §4.1](./accounts.md) —
locale-aware separators and per-currency minor-unit digits, so JPY doesn't get two
decimal places it doesn't have.

---

## 5. Invariants

1. `transaction.user_id` = session user, always. *(done)*
2. `transaction.account_id`, `category_id`, `payee_id`, `tag_id`s all belong to the same
   user. *(missing today — §3.4)*
3. `transaction.currency` = its account's currency, server-derived.
4. No transaction dated after its account's `closed_at`.
5. `kind = 'split'` ⟺ ≥ 2 split rows, `category_id IS NULL`, and
   `SUM(splits.amount) = amount`.
6. `kind = 'transfer'` ⟺ exactly 2 live rows share the `transfer_group_id`,
   `category_id IS NULL` on both.
7. `kind = 'standard'` ⟹ zero split rows and `transfer_group_id IS NULL`.
8. A `reconciled` transaction's `amount`/`date`/`account_id` are immutable (§3.6).
9. `(scheduled_id, date)` is unique — a recurrence posts at most once per occurrence.
10. `(user_id, source, external_id)` is unique where `external_id` is present. *(done)*

Numbers 5–7 are the ones worth a test suite; they're the ones a partial failure
silently violates.

---

## 6. Implementation order

Assumes [accounts.md](./accounts.md) steps 1–5 have landed — the service layer,
`AppError`, `assertAccountOwned`, and `src/lib/money.ts` are prerequisites.

1. **Schema** — `kind`, `deleted_at`, `seq`, the partial indexes, `pg_trgm`,
   `transaction_lines` view. One migration.
2. **`services/transactions.ts`** — `assertRefsOwned`, create/update/delete with
   transfer coupling, the keyset list query.
3. **Rewrite `routes/transactions.ts`** onto it. Closes the cross-tenant write and the
   `userId` reassignment bug — do this before anything ships.
4. **List UI** — filter bar, URL search params, infinite table.
5. **Quick-add + detail drawer.**
6. **Splits + tags.**
7. **Bulk operations + undo.**
8. **Rules apply/preview.**
9. **Recurring catch-up + upcoming section.**
10. **Import preview/commit.**

Steps 1–3 are security work, not features. Everything after 4 is independently
shippable.

---

## 7. Open questions

1. **Does `catchUpScheduled` belong on the read path?** It makes a `GET` mutate, which
   is unpleasant, and a cold user with two years of dormant recurrences pays for it in
   one request. Recommendation: keep it there for v1 behind a per-user "last caught up"
   timestamp so it runs at most once a day, and move it to a real cron
   (`/api/cron/scheduled`, hit by an external scheduler) when the app has one.
2. **Should the list join display fields or return bare IDs?** §3.2 recommends joining.
   Revisit if the payload gets fat — 50 rows × ~400 bytes is fine, 200 rows × tags is
   less fine.
3. **Attachments (receipt photos).** Not designed here. It needs blob storage, which is
   an infrastructure decision, not a schema one. The hook is a `transaction_attachments`
   table keyed by `transaction_id`.
4. **Multi-currency transactions within one account** — deliberately excluded (§3.4). If
   a real use case appears (a travel card holding two currencies), the answer is two
   accounts, not a nullable `original_amount`/`original_currency` pair on every row.
