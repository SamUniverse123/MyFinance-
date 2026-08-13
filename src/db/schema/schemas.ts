import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { user } from './auth-schema'
 




/* ────────────────────────────────────────────────────────────────────────────
   Enums
   ──────────────────────────────────────────────────────────────────────────── */
export const accountType = pgEnum('account_type', [
  'checking', 'savings', 'cash', 'credit_card', 'loan', 'investment', 'other',
])
export const categoryKind = pgEnum('category_kind', ['income', 'expense'])
export const txnStatus = pgEnum('txn_status', ['pending', 'cleared', 'reconciled'])
export const txnSource = pgEnum('txn_source', ['manual', 'import', 'recurring'])
export const ruleField = pgEnum('rule_field', ['payee', 'note', 'amount'])
export const ruleOp = pgEnum('rule_op', ['contains', 'equals', 'gt', 'lt'])
export const budgetPeriod = pgEnum('budget_period', ['weekly', 'monthly', 'yearly'])
export const recurrence = pgEnum('recurrence', ['once', 'daily', 'weekly', 'monthly', 'yearly'])
export const assetClass = pgEnum('asset_class', [
  'equity', 'etf', 'mutual_fund', 'bond', 'crypto', 'cash', 'other',
])
export const activityType = pgEnum('activity_type', [
  'buy', 'sell', 'dividend', 'deposit', 'withdrawal',
  'interest', 'fee', 'split', 'transfer_in', 'transfer_out',
])
 
/* ── SPLIT: settings.ts ─────────────────────────────────────────────────────── */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  baseCurrency: char('base_currency', { length: 3 }).notNull().default('USD'),
  locale: text('locale'),
  weekStart: smallint('week_start').notNull().default(1), // 0=Sun, 1=Mon
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
 
/* ── SPLIT: ledger.ts (accounts, categories, payees, tags, scheduled, transactions,
      splits, transaction_tags, rules — keep these together to avoid cycles) ───── */
 
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountType('type').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  initialBalance: bigint('initial_balance', { mode: 'number' }).notNull().default(0),
  color: text('color'),
  icon: text('icon'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  //newly added
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
 
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Self-reference needs the explicit AnyPgColumn return annotation:
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
  name: text('name').notNull(),
  kind: categoryKind('kind').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('categories_user_idx').on(t.userId),
  index('categories_parent_idx').on(t.parentId),
  // ADR-0004: uniqueness is scoped to (user, parent, kind), not global per user —
  // "Other" may recur as a subcategory under different parents.
  uniqueIndex('categories_top_level_name_uq')
    .on(t.userId, t.kind, sql`lower(${t.name})`)
    .where(sql`${t.parentId} is null`),
  uniqueIndex('categories_child_name_uq')
    .on(t.parentId, sql`lower(${t.name})`)
    .where(sql`${t.parentId} is not null`),
])
 
export const payees = pgTable('payees', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('payees_user_name_uq').on(t.userId, t.name),
])
 
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
}, (t) => [
  unique('tags_user_name_uq').on(t.userId, t.name),
])
 
export const scheduledTransactions = pgTable('scheduled_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id),
  payeeId: uuid('payee_id').references(() => payees.id),
  payeeName: text('payee_name'),
  amount: bigint('amount', { mode: 'number' }).notNull(), // signed
  currency: char('currency', { length: 3 }).notNull(),
  note: text('note'),
  frequency: recurrence('frequency').notNull(),
  interval: integer('interval').notNull().default(1),
  anchorDate: date('anchor_date', { mode: 'string' }).notNull(),
  nextRunDate: date('next_run_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  autoPost: boolean('auto_post').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('scheduled_user_active_idx').on(t.userId, t.isActive),
  index('scheduled_next_run_idx').on(t.nextRunDate),
])
 
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id ,{ onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => categories.id), // null: uncategorized / split / transfer
  payeeId: uuid('payee_id').references(() => payees.id),
  payeeName: text('payee_name'),
  amount: bigint('amount', { mode: 'number' }).notNull(), // signed minor units
  currency: char('currency', { length: 3 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  note: text('note'),
  status: txnStatus('status').notNull().default('cleared'),
  transferGroupId: uuid('transfer_group_id'), // two rows share this for a transfer
  scheduledId: uuid('scheduled_id').references(() => scheduledTransactions.id),
  source: txnSource('source').notNull().default('manual'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('transactions_account_date_idx').on(t.userId, t.accountId, t.date),
  index('transactions_category_idx').on(t.userId, t.categoryId),
  index('transactions_transfer_group_idx').on(t.transferGroupId),
  // idempotent import: unique only where external_id is present
  uniqueIndex('transactions_external_uq')
    .on(t.userId, t.source, t.externalId)
    .where(sql`${t.externalId} is not null`),
])
 
export const transactionSplits = pgTable('transaction_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id),
  amount: bigint('amount', { mode: 'number' }).notNull(), // SUM must equal parent.amount (en ce in app)
  note: text('note'),
}, (t) => [
  index('splits_transaction_idx').on(t.transactionId),
])
 
export const transactionTags = pgTable('transaction_tags', {
  transactionId: uuid('transaction_id').notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.transactionId, t.tagId] }),
])
 
export const rules = pgTable('rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  priority: integer('priority').notNull().default(0), // lower runs first
  matchField: ruleField('match_field').notNull(),
  matchOp: ruleOp('match_op').notNull(),
  matchValue: text('match_value').notNull(),
  setCategoryId: uuid('set_category_id').references(() => categories.id),
  setPayeeId: uuid('set_payee_id').references(() => payees.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('rules_user_priority_idx').on(t.userId, t.priority),
])
