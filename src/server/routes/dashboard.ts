import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { accounts, budgets, transactions, userSettings } from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";

const querySchema = z.object({
	range: z.enum(["7d", "30d", "90d"]).default("30d"),
	// Loosely validated (uppercased below) — an unrecognized/omitted value just falls
	// back to the default currency rather than erroring (same tolerance as `range`).
	currency: z
		.string()
		.regex(/^[A-Za-z]{3}$/)
		.optional(),
});

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

// Transaction dates are naive local calendar dates (the form stamps "today" as a
// local YYYY-MM-DD, and the column has no timezone). The dashboard's date boundaries
// must therefore also be computed in local time, NOT UTC — otherwise, for users east
// of UTC (e.g. UTC+8), a transaction dated "today" locally sits past a UTC-derived
// upper bound during the local morning and silently drops out of the month/budget/
// cashflow figures.
function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
	const copy = new Date(d);
	copy.setDate(copy.getDate() + days);
	return copy;
}

/** Open-account count per currency (ADR-0009: currencies are scoped, never blended). */
function accountCurrencyCounts(
	openAccounts: { currency: string }[],
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const a of openAccounts)
		counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
	return counts;
}

/** Most common currency among open accounts; USD when there are none. */
function inferBaseCurrency(counts: Map<string, number>): string {
	let best: string | null = null;
	let bestCount = 0;
	for (const [currency, count] of counts) {
		if (count > bestCount) {
			best = currency;
			bestCount = count;
		}
	}
	return best ?? "USD";
}

/** Toggle order: base/default currency first, then by account count descending. */
function orderCurrencies(
	counts: Map<string, number>,
	baseCurrency: string,
): string[] {
	return [...counts.keys()].sort((a, b) => {
		if (a === baseCurrency) return -1;
		if (b === baseCurrency) return 1;
		return (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b);
	});
}

// Postgres `sum()` over a bigint column returns `numeric`, which node-postgres hands
// back as a string (to avoid precision loss) — `sql<number>` only asserts the TS type,
// it doesn't cast the runtime value. Every raw sum/case expression here casts to
// `::float8` so the driver actually returns a JS number (safe: amounts are minor-unit
// integers, well within float8's 53-bit exact-integer range).

/** `sum(amount)` where amount > 0 — this period's income (ADR-0007: reads `transactions` directly). */
const incomeExpr = sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)::float8`;
/** `sum(-amount)` where amount < 0 — this period's expenses, returned positive. */
const expenseExpr = sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)::float8`;

const app = new Hono<AuthEnv>().get(
	"/summary",
	zValidator("query", querySchema),
	async (c) => {
		const userId = c.get("user").id;
		const { range, currency: requestedCurrency } = c.req.valid("query");

		const [settings] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId));

		const openAccounts = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.userId, userId), isNull(accounts.closedAt)));

		// Default currency: an explicit settings row wins; otherwise infer from the
		// user's most common account currency (fixes net worth silently zeroing out for
		// users whose accounts are all non-USD and who have no settings row yet).
		const currencyCounts = accountCurrencyCounts(openAccounts);
		const defaultCurrency =
			settings?.baseCurrency ?? inferBaseCurrency(currencyCounts);
		const availableCurrencies = orderCurrencies(
			currencyCounts,
			defaultCurrency,
		);

		// ADR-0009: currencies are a view toggle, never converted/blended. An unknown or
		// omitted `?currency=` falls back to the default rather than erroring.
		const requestedUpper = requestedCurrency?.toUpperCase();
		const currency =
			requestedUpper && availableCurrencies.includes(requestedUpper)
				? requestedUpper
				: defaultCurrency;

		// --- Net worth: only accounts in the selected currency ---
		const accountSums = await db
			.select({
				accountId: transactions.accountId,
				total: sql<number>`coalesce(sum(${transactions.amount}), 0)::float8`,
			})
			.from(transactions)
			.where(eq(transactions.userId, userId))
			.groupBy(transactions.accountId);
		const sumByAccount = new Map(
			accountSums.map((r) => [r.accountId, r.total]),
		);

		let netWorth = 0;
		for (const a of openAccounts) {
			if (a.excludeFromNetWorth || a.currency !== currency) continue;
			netWorth += a.initialBalance + (sumByAccount.get(a.id) ?? 0);
		}

		// --- This month's income / expenses / cashflow, in the selected currency ---
		const today = new Date();
		const monthStart = isoDate(
			new Date(today.getFullYear(), today.getMonth(), 1),
		);
		const todayStr = isoDate(today);

		const [monthRow] = await db
			.select({ income: incomeExpr, expense: expenseExpr })
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.currency, currency),
					isNull(transactions.transferGroupId),
					gte(transactions.date, monthStart),
					lte(transactions.date, todayStr),
				),
			);
		const monthIncome = monthRow?.income ?? 0;
		const monthExpense = monthRow?.expense ?? 0;

		// --- Budget for the selected currency (ADR-0009: per-currency, never shared) ---
		const [budgetRow] = await db
			.select({ amount: budgets.amount })
			.from(budgets)
			.where(and(eq(budgets.userId, userId), eq(budgets.currency, currency)));

		// --- Daily cashflow series for the chart, zero-filled so there are no gaps ---
		const days = RANGE_DAYS[range];
		const rangeStartDate = addDays(today, -(days - 1));
		const rangeStart = isoDate(rangeStartDate);

		const seriesRows = await db
			.select({
				date: transactions.date,
				income: incomeExpr,
				expense: expenseExpr,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.currency, currency),
					isNull(transactions.transferGroupId),
					gte(transactions.date, rangeStart),
					lte(transactions.date, todayStr),
				),
			)
			.groupBy(transactions.date)
			.orderBy(transactions.date);
		const rowByDate = new Map(seriesRows.map((r) => [r.date, r]));

		const cashflow = Array.from({ length: days }, (_, i) => {
			const date = isoDate(addDays(rangeStartDate, i));
			const row = rowByDate.get(date);
			return { date, income: row?.income ?? 0, expense: row?.expense ?? 0 };
		});

		// --- Net-worth sparkline for the stat card: walk `netWorth` backward day by day
		// using the same accounts, INCLUDING transfers (they still move balances, unlike
		// the income/expense figures above which exclude them). ---
		const netWorthAccountIds = openAccounts
			.filter((a) => !a.excludeFromNetWorth && a.currency === currency)
			.map((a) => a.id);

		const dailyDeltaRows = netWorthAccountIds.length
			? await db
					.select({
						date: transactions.date,
						delta: sql<number>`coalesce(sum(${transactions.amount}), 0)::float8`,
					})
					.from(transactions)
					.where(
						and(
							eq(transactions.userId, userId),
							inArray(transactions.accountId, netWorthAccountIds),
							gte(transactions.date, rangeStart),
							lte(transactions.date, todayStr),
						),
					)
					.groupBy(transactions.date)
			: [];
		const deltaByDate = new Map(dailyDeltaRows.map((r) => [r.date, r.delta]));

		const netWorthSeries = new Array<{ date: string; value: number }>(days);
		let runningNetWorth = netWorth;
		for (let i = days - 1; i >= 0; i--) {
			const date = isoDate(addDays(rangeStartDate, i));
			netWorthSeries[i] = { date, value: runningNetWorth };
			runningNetWorth -= deltaByDate.get(date) ?? 0;
		}

		return c.json({
			currency,
			availableCurrencies,
			netWorth,
			netWorthSeries,
			budget: budgetRow?.amount ?? null,
			month: {
				income: monthIncome,
				expense: monthExpense,
				netCashflow: monthIncome - monthExpense,
			},
			cashflow,
		});
	},
);

export default app;
