# Accounts Management — Design

Status: proposed · Owner: @samUniverse123 · Last updated: 2026-08-06

An *account* is a container of money the user tracks: a bank account, a wallet, a
credit card, a loan, a brokerage. Everything else in the ledger (transactions,
budgets, net worth) hangs off it, so this subsystem needs to be right before the
rest is built on top of it.

---

## 1. Core decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Balances are derived, never stored** | `initial_balance + SUM(transactions.amount)`. A stored balance is a second source of truth that drifts the first time a transaction is edited, deleted, or imported out of order. |
| 2 | **Money is signed `bigint` minor units** | Already the schema's convention. No floats anywhere, including the wire format. |
| 3 | **One sign convention for all account types** | Positive = the user owns it, negative = the user owes it. A credit card with a $500 balance owed stores `-50000`. The *display layer* flips the sign for liabilities; the ledger never does. |
| 4 | **Close, don't delete** | `closed_at` retires an account while preserving history. Hard delete is only allowed when the account has zero transactions. |
| 5 | **`currency` is immutable once the account has transactions** | The stored minor units are meaningless if reinterpreted in another currency. |
| 6 | **Accounts own their currency; transactions inherit it** | A transaction's `currency` must equal its account's. Multi-currency happens *between* accounts, not inside one. |
| 7 | **Ownership is checked on the account, not just the row** | Every write that names an `account_id` must prove the account belongs to the caller. |

### Why derived balances are affordable here

The read is `SUM(amount) GROUP BY account_id` over one user's transactions,
covered by the existing `transactions_account_date_idx (user_id, account_id, date)`.
For a personal-finance dataset (10³–10⁵ rows/user) this is sub-millisecond. If it
ever isn't, the fix is an `account_balances` rollup table maintained by trigger or
a monthly `account_balance_snapshots` table that the sum starts from — both are
additive, and neither changes the API. Don't pre-optimize into a stored balance.

---

## 2. Data model

### 2.1 Blockers to fix first

These are pre-existing and will bite during implementation:

1. **Duplicate `user` table.** `src/db/schema/schemas.ts:28` redefines `user`, and
   `src/db/schema/index.ts` `export *`s it alongside `auth-schema.ts`'s `user`.
   The re-export is ambiguous, and Drizzle's `db` schema object gets a collision.
   → Delete the copy in `schemas.ts`, `import { user } from './auth-schema'`.
2. **Timestamp mismatch.** `auth-schema.ts` uses `timestamp(...)` (no timezone);
   `schemas.ts` uses `{ withTimezone: true }`. Standardise on `withTimezone: true`
   everywhere, including the better-auth tables.
3. **Stale migrations.** `drizzle/0000_*.sql` contains only the *old* accounts
   table (`balance`, `currency text`) — none of the current ledger schema exists in
   a migration. Squash: drop `drizzle/`, re-`db:generate` from the fixed schema.

### 2.2 Columns to add to `accounts`

```ts
export const accounts = pgTable('accounts', {
  // ... existing: id, userId, name, type, currency, initialBalance, color, icon,
  //     closedAt, createdAt, updatedAt

  institution:        text('institution'),                       // "Maybank", "Chase"
  mask:               char('mask', { length: 4 }),               // last 4 digits, display only
  creditLimit:        bigint('credit_limit', { mode: 'number' }),// credit_card only → utilisation
  excludeFromNetWorth: boolean('exclude_from_net_worth').notNull().default(false),
  sortOrder:          integer('sort_order').notNull().default(0),
}, (t) => [
  index('accounts_user_idx').on(t.userId),
  index('accounts_user_sort_idx').on(t.userId, t.sortOrder),
  // one active account per name; closed accounts may reuse the name
  uniqueIndex('accounts_user_name_active_uq')
    .on(t.userId, sql`lower(${t.name})`)
    .where(sql`${t.closedAt} is null`),
])
```

Also tighten the FK so a delete can't orphan a ledger:

```ts
accountId: uuid('account_id').notNull()
  .references(() => accounts.id, { onDelete: 'restrict' }),   // transactions, scheduled_transactions
```

`restrict` makes the database the last line of defence; the API returns a clean
`409` long before Postgres has to.

### 2.3 Default account

Goes in `user_settings`, not on `accounts` — it's a single-valued user preference,
and a `boolean is_default` column invites two rows both being true.

```ts
defaultAccountId: uuid('default_account_id').references(() => accounts.id, { onDelete: 'set null' }),
```

### 2.4 FX rates (needed for net worth, not for v1 CRUD)

Net worth across accounts in different currencies is undefined without rates.

```ts
export const fxRates = pgTable('fx_rates', {
  date:  date('date', { mode: 'string' }).notNull(),
  base:  char('base',  { length: 3 }).notNull(),
  quote: char('quote', { length: 3 }).notNull(),
  rate:  numeric('rate', { precision: 20, scale: 10 }).notNull(),
}, (t) => [primaryKey({ columns: [t.base, t.quote, t.date] })])
```

Until it's populated, `/accounts/summary` returns per-currency subtotals and sets
`convertedTotal: null` with `missingRates: ['EUR', …]`. **Never invent a rate of 1.**

### 2.5 Investment accounts — reserved, out of scope for v1

`assetClass` and `activityType` enums already exist with no tables behind them. An
investment account's balance is `cash + Σ(quantity × latest price)`, which the
`SUM(transactions.amount)` formula can't express. For v1, treat `type:
'investment'` as a plain cash-like account and revisit with `holdings` +
`investment_activities` + `security_prices` tables. Flag it in the UI as
"balance tracked manually" so the number isn't silently wrong.

---

## 3. Server design

### 3.1 Layering

Routes today query `db` inline. That stops working the moment two routes need the
same rule — and `transactions` already needs `assertAccountOwned`. Introduce a thin
service module; routes keep parsing/status codes, services own invariants.

```
src/server/
  routes/accounts.ts      HTTP: validation, status codes, shaping
  routes/transfers.ts
  services/accounts.ts    invariants, balance queries, transactions (DB)
  lib/errors.ts           AppError → HTTP mapping
```

```ts
// src/server/lib/errors.ts
export class AppError extends Error {
  constructor(
    readonly code: 'not_found' | 'conflict' | 'forbidden' | 'invalid',
    readonly status: 404 | 409 | 403 | 422,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) { super(message) }
}
```

Register `app.onError` once in `src/server/app.ts` so every route reports errors in
one shape: `{ error: { code, message, detail? } }`. The current routes each invent
`{ error: "Not found" }` / `{ error: "not found" }` — inconsistent even between two
files.

### 3.2 The balance query

One query for the whole list — no N+1:

```ts
// src/server/services/accounts.ts
const balances = db.$with('balances').as(
  db.select({
    accountId: transactions.accountId,
    total: sql<number>`sum(${transactions.amount})::bigint`.as('total'),
    cleared: sql<number>`
      sum(${transactions.amount}) filter (where ${transactions.status} <> 'pending')::bigint
    `.as('cleared'),
  })
  .from(transactions)
  .where(eq(transactions.userId, userId))
  .groupBy(transactions.accountId),
)

export async function listAccounts(userId: string, opts: { includeClosed?: boolean } = {}) {
  return db.with(balances)
    .select({
      ...getTableColumns(accounts),
      balance:        sql<number>`${accounts.initialBalance} + coalesce(${balances.total}, 0)`,
      clearedBalance: sql<number>`${accounts.initialBalance} + coalesce(${balances.cleared}, 0)`,
    })
    .from(accounts)
    .leftJoin(balances, eq(balances.accountId, accounts.id))
    .where(and(
      eq(accounts.userId, userId),
      opts.includeClosed ? undefined : isNull(accounts.closedAt),
    ))
    .orderBy(accounts.sortOrder, accounts.createdAt)
}
```

Two balances, because they answer different questions: `balance` is "what the
ledger says", `clearedBalance` is "what the bank would say today". Reconciliation
compares the second.

### 3.3 Ownership guard

```ts
export async function assertAccountOwned(userId: string, accountId: string, tx = db) {
  const [row] = await tx.select().from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
  if (!row) throw new AppError('not_found', 404, 'Account not found')
  return row
}

export function assertPostable(account: Account, date: string) {
  if (account.closedAt && date > toDateString(account.closedAt))
    throw new AppError('conflict', 409, 'Account is closed as of ' + …)
}
```

> **Live bug this closes:** `src/server/routes/transactions.ts:31` accepts any
> `accountId` from the body and inserts with the caller's `userId`. Any
> authenticated user can write transactions into another user's account. Same for
> `categoryId` and `payeeId`. Every FK that arrives from a client needs an
> ownership check.

### 3.4 API surface

All under `/api/accounts`, all behind `requireAuth`, all scoped to `c.get('user').id`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List with balances. `?includeClosed=true`, `?type=`. |
| `GET` | `/summary` | Net worth: totals by type + by currency, asset/liability split. |
| `POST` | `/` | Create. `currency` defaults to `user_settings.base_currency`. |
| `GET` | `/:id` | One account + balances + `transactionCount`, `firstTxnDate`, `lastTxnDate`. |
| `PATCH` | `/:id` | Mutable fields only (§3.5). |
| `POST` | `/:id/close` | Sets `closed_at` (default now). Idempotent. |
| `POST` | `/:id/reopen` | Clears `closed_at`. |
| `DELETE` | `/:id` | Only if `transactionCount === 0`, else `409`. `?force=true` cascades in one DB transaction. |
| `POST` | `/reorder` | `{ ids: string[] }` → rewrites `sort_order`. |
| `POST` | `/:id/reconcile` | `{ statementBalance, date }` → posts an adjustment transaction for the difference. |
| `GET` | `/:id/balance-history` | `?from&to&interval=day\|week\|month` → running balance series for the detail chart. |
| `POST` | `/api/transfers` | `{ fromAccountId, toAccountId, amount, date, note? }` → the paired rows. |

### 3.5 Field mutability

Not every column in the insert schema belongs in the update schema.
`updateSchema = insertSchema.partial()` (`routes/accounts.ts:20`) currently lets a
client `PATCH { currency: "JPY" }` and silently reinterpret every stored amount.

| Field | Rule |
|---|---|
| `name`, `color`, `icon`, `institution`, `mask`, `sortOrder`, `excludeFromNetWorth`, `creditLimit` | freely editable |
| `initialBalance` | editable — it shifts the derived balance, which is the point |
| `type` | editable *within a class* (checking ↔ savings ↔ cash; credit_card ↔ loan). Crossing asset/liability flips the meaning of every sign. |
| `currency` | editable **only while `transactionCount === 0`**, else `409` |
| `userId`, `id`, `createdAt` | never accepted from the client |
| `closedAt` | not via `PATCH` — use `/close` and `/reopen` |

```ts
const updateSchema = insertSchema
  .pick({ name: true, color: true, icon: true, initialBalance: true, /* … */ })
  .partial()
```

### 3.6 Transfers

A transfer is two transactions sharing a `transfer_group_id`, written atomically:

```ts
await db.transaction(async (tx) => {
  const from = await assertAccountOwned(userId, fromAccountId, tx)
  const to   = await assertAccountOwned(userId, toAccountId, tx)
  if (from.id === to.id) throw new AppError('invalid', 422, 'Cannot transfer to the same account')

  const groupId = crypto.randomUUID()
  await tx.insert(transactions).values([
    { userId, accountId: from.id, amount: -amount,   currency: from.currency, transferGroupId: groupId, categoryId: null, date, note },
    { userId, accountId: to.id,   amount: +toAmount, currency: to.currency,   transferGroupId: groupId, categoryId: null, date, note },
  ])
})
```

Cross-currency transfers take an explicit `toAmount` from the user (the rate they
actually got beats any rate table). Same-currency transfers derive it. Transfers
carry `categoryId: null` — a transfer is not income or expense, and letting one
carry a category is how budget reports start double-counting.

### 3.7 Validation notes

- `currency`: `z.string().regex(/^[A-Z]{3}$/)`, not `.length(3)` — `"usd"` and
  `"$$$"` both pass today.
- Default currency comes from `user_settings.base_currency`, not a hardcoded
  `"USD"` (`routes/accounts.ts:15`).
- `amount`: `z.number().int()` is correct but add `.safe()`; JS numbers hold ±2⁵³,
  fine for minor units, but reject `NaN`/`Infinity` explicitly.
- `z.string().uuid()` is deprecated in Zod 4 → `z.uuid()`.
- `createInsertSchema(transactions)` (`transactions.ts:12`) must also omit
  `transferGroupId` and `scheduledId` — those are server-assigned.

---

## 4. Client design

### 4.1 Money formatting — build this first

There is no money utility in the codebase yet, and every screen needs one.

```ts
// src/lib/money.ts
export function formatMoney(minor: number, currency: string, locale?: string): string
export function parseMoney(input: string, currency: string): number   // "12.34" → 1234
export function minorUnitDigits(currency: string): number             // JPY → 0, USD → 2
export function signedForDisplay(minor: number, type: AccountType): number
```

`minorUnitDigits` matters: a hardcoded `/ 100` renders ¥1,000 as ¥10.00.

### 4.2 Routes

```
src/routes/dashboard/accounts/index.tsx        list + net worth header
src/routes/dashboard/accounts/$accountId.tsx   detail: balance chart + transactions
```

Both `loader`-prefetch via TanStack Query so the shell renders with data (the
project already wires `@tanstack/react-router-ssr-query`).

### 4.3 Feature module

```
src/features/accounts/
  api.ts          apiClient.accounts.* wrappers (typed by Hono RPC)
  queries.ts      queryOptions + accountKeys factory
  mutations.ts    useCreateAccount, useUpdateAccount, useCloseAccount, useReorderAccounts
  components/
    account-card.tsx        icon, name, institution ••mask, balance, utilisation bar
    account-form.tsx        create/edit sheet — TanStack Form, matches login-form.tsx
    account-list.tsx        grouped by type, dnd-kit reorder (already a dependency)
    net-worth-summary.tsx   assets / liabilities / net, per-currency breakdown
    transfer-dialog.tsx
    close-account-dialog.tsx
    balance-display.tsx     sign-aware, currency-aware, colour-coded
```

Query keys:

```ts
export const accountKeys = {
  all:     ['accounts'] as const,
  list:    (f: ListFilters) => [...accountKeys.all, 'list', f] as const,
  detail:  (id: string)     => [...accountKeys.all, 'detail', id] as const,
  summary: ()               => [...accountKeys.all, 'summary'] as const,
}
```

Any mutation that moves money invalidates `accountKeys.all` **and** the
transactions keys — balances are derived, so a transaction edit changes an
account's balance.

### 4.4 Interaction rules

- **Reorder** and **rename** are optimistic; they can't fail in a way the user
  cares about. **Close** and **delete** are not — they show the server's answer.
- **Delete** presents the transaction count and offers the two real options:
  "Close instead" (recommended) or "Delete N transactions too".
- Liability accounts render the owed amount as a positive number with a
  "you owe" label, in `--destructive`; the sign flip lives only in
  `balance-display.tsx`.
- Closed accounts: filtered out of every account picker, shown in a collapsed
  "Closed" group at the bottom of the list, still counted in historical charts.
- Empty state on the list route is the create form, not a placeholder — a user
  with zero accounts can do nothing else.

---

## 5. Invariants

Enforced in the service layer, with DB constraints where Postgres can express it.

1. Every account row's `user_id` equals the session user. *(done)*
2. `transaction.currency == account.currency`.
3. `transaction.account_id` belongs to the same user. *(missing today)*
4. No transaction dated after `account.closed_at`.
5. `currency` frozen once `transactionCount > 0`.
6. Both legs of a transfer share a `transfer_group_id`, exist or don't together,
   and carry `category_id = null`.
7. An account with transactions cannot be hard-deleted without `force`.
8. `sort_order` is unique per user *by convention* — reorder rewrites the whole
   list, so collisions are cosmetic, not corrupting.

---

## 6. Implementation order

1. **Schema fixes** — dedupe `user`, timezone consistency, new columns, squash
   migrations. Nothing else can land cleanly first.
2. **`src/lib/money.ts`** + `src/server/lib/errors.ts` + `app.onError`.
3. **`services/accounts.ts`** — balance CTE, `assertAccountOwned`, close/delete rules.
4. **Rewrite `routes/accounts.ts`** onto the service; fix the update schema.
5. **Patch `routes/transactions.ts`** to use `assertAccountOwned` (closes the
   cross-tenant write).
6. **`/summary`** + `/balance-history`.
7. **Client**: queries/mutations → list route → detail route → transfer dialog.
8. **FX rates + net worth conversion.**
9. Investment holdings — separate design.

Steps 1–5 are the load-bearing ones; 6+ can ship incrementally.

---

## 7. Open questions

1. **Should `/accounts` return balances at all, or should the client call
   `/summary`?** Returning them keeps the list one round-trip; it also means the
   list query can never be a cheap cache hit. Recommendation: include them —
   an account row without a balance is not worth rendering.
2. **Reconciliation adjustments** — post as a transaction against a system
   "Balance Adjustment" category (needs `categories.is_system` seeding), or as a
   nullable-category transaction? Recommendation: system category, so it's visible
   in reports rather than silently uncategorised.
3. **Shared/joint accounts** — out of scope, but if it's ever coming, `accounts`
   needs an owner *set* rather than a `user_id`. Cheaper to decide now than to
   migrate later.
