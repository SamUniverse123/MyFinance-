-- ADR-0015: budgets/category_budgets become effective-dated (a `month` column marking
-- when each amount starts applying). This migration adds the column, makes `amount`
-- nullable (for tombstones), backfills existing rows to their earliest navigable month
-- (Q7 — so today's numbers keep applying to every past month), and moves the primary
-- key to include `month`.
--
-- Run this ONCE against the database BEFORE `pnpm db:push`, e.g.:
--   psql "$DATABASE_URL" -f scripts/migrate-budget-months.sql
-- It is idempotent-safe to re-run. After it, `db:push` should report no changes to
-- these two tables.

BEGIN;

-- ── budgets ─────────────────────────────────────────────────────────────────
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS month date;
ALTER TABLE budgets ALTER COLUMN amount DROP NOT NULL;

-- Backfill: earliest month with a transaction in that (user, currency); else this month.
UPDATE budgets b SET month = COALESCE(
  (SELECT date_trunc('month', MIN(t.date))::date
     FROM transactions t
    WHERE t.user_id = b.user_id AND t.currency = b.currency),
  date_trunc('month', CURRENT_DATE)::date
) WHERE b.month IS NULL;

ALTER TABLE budgets ALTER COLUMN month SET NOT NULL;

-- Swap the primary key to (user_id, currency, month), whatever the old PK was named.
DO $$
DECLARE pk text;
BEGIN
  SELECT conname INTO pk FROM pg_constraint
   WHERE conrelid = 'budgets'::regclass AND contype = 'p';
  IF pk IS NOT NULL THEN EXECUTE format('ALTER TABLE budgets DROP CONSTRAINT %I', pk); END IF;
  ALTER TABLE budgets ADD PRIMARY KEY (user_id, currency, month);
END $$;

-- ── category_budgets ────────────────────────────────────────────────────────
ALTER TABLE category_budgets ADD COLUMN IF NOT EXISTS month date;
ALTER TABLE category_budgets ALTER COLUMN amount DROP NOT NULL;

UPDATE category_budgets cb SET month = COALESCE(
  (SELECT date_trunc('month', MIN(t.date))::date
     FROM transactions t
    WHERE t.user_id = cb.user_id AND t.currency = cb.currency),
  date_trunc('month', CURRENT_DATE)::date
) WHERE cb.month IS NULL;

ALTER TABLE category_budgets ALTER COLUMN month SET NOT NULL;

DO $$
DECLARE pk text;
BEGIN
  SELECT conname INTO pk FROM pg_constraint
   WHERE conrelid = 'category_budgets'::regclass AND contype = 'p';
  IF pk IS NOT NULL THEN EXECUTE format('ALTER TABLE category_budgets DROP CONSTRAINT %I', pk); END IF;
  ALTER TABLE category_budgets ADD PRIMARY KEY (category_id, currency, month);
END $$;

COMMIT;
