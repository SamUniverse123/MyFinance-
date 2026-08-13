import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { accounts, transactions, userSettings } from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";

const querySchema = z.object({
	range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
	const copy = new Date(d);
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
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
		const { range } = c.req.valid("query");

		const [settings] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId));
		const baseCurrency = settings?.baseCurrency ?? "USD";

		// --- Net worth (ADR-0006: base-currency accounts only; others are separate subtotals) ---
		const openAccounts = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.userId, userId), isNull(accounts.closedAt)));

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
		const otherCurrencyTotals = new Map<string, number>();
		for (const a of openAccounts) {
			if (a.excludeFromNetWorth) continue;
			const balance = a.initialBalance + (sumByAccount.get(a.id) ?? 0);
			if (a.currency === baseCurrency) {
				netWorth += balance;
			} else {
				otherCurrencyTotals.set(
					a.currency,
					(otherCurrencyTotals.get(a.currency) ?? 0) + balance,
				);
			}
		}

		// --- This month's income / expenses / cashflow ---
		const today = new Date();
		const monthStart = isoDate(
			new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
		);
		const todayStr = isoDate(today);

		const [monthRow] = await db
			.select({ income: incomeExpr, expense: expenseExpr })
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.currency, baseCurrency),
					isNull(transactions.transferGroupId),
					gte(transactions.date, monthStart),
					lte(transactions.date, todayStr),
				),
			);
		const monthIncome = monthRow?.income ?? 0;
		const monthExpense = monthRow?.expense ?? 0;

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
					eq(transactions.currency, baseCurrency),
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
			.filter((a) => !a.excludeFromNetWorth && a.currency === baseCurrency)
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
			currency: baseCurrency,
			netWorth,
			netWorthSeries,
			otherCurrencies: Array.from(
				otherCurrencyTotals,
				([currency, amount]) => ({ currency, amount }),
			),
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
