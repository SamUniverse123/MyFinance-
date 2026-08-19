import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, lt, min } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import {
	budgets,
	categories,
	categoryBudgets,
	transactions,
} from "@/db/schema";
import { resolveCurrencyScope } from "@/server/lib/currency-scope";
import { AppError } from "@/server/lib/error";
import type { AuthEnv } from "../middleware/auth";

const currencyParam = z.object({ currency: z.string().regex(/^[A-Za-z]{3}$/) });
const monthField = z.string().regex(/^\d{4}-\d{2}$/);

// null clears the budget for that month onward (a tombstone); a number sets it.
const updateSchema = z.object({
	month: monthField,
	amount: z.number().int().min(1).nullable(),
});

const summaryQuery = z.object({
	currency: z
		.string()
		.regex(/^[A-Za-z]{3}$/)
		.optional(),
	month: monthField.optional(),
});

const categoryIdParam = z.object({ categoryId: z.string().uuid() });
const categoryUpdateSchema = z.object({
	currency: z.string().regex(/^[A-Za-z]{3}$/),
	month: monthField,
	amount: z.number().int().min(1).nullable(),
});

const HISTORY_MONTHS = 6;

/** Local `YYYY-MM-DD` — transaction dates are naive local dates, so month boundaries
 *  must be local too (a UTC boundary drops "today" east of UTC; see `dashboard.ts`). */
function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** "YYYY-MM" → first-of-month `Date`. */
function monthToDate(month: string): Date {
	const [y, m] = month.split("-").map(Number);
	return new Date(y, m - 1, 1);
}

/** `Date` → "YYYY-MM". */
function toMonthKey(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Effective amount as of `monthKey` from an effective-dated series (ADR-0015): the
 * most recent row at or before that month. Rows are `{ month: "YYYY-MM-01", amount }`.
 * A tombstone (`amount === null`) resolves to null, as does "no row yet".
 */
function effectiveAsOf(
	rows: { month: string; amount: number | null }[],
	monthKey: string,
): number | null {
	const cutoff = `${monthKey}-01`;
	let best: { month: string; amount: number | null } | null = null;
	for (const r of rows) {
		if (r.month <= cutoff && (!best || r.month > best.month)) best = r;
	}
	return best ? best.amount : null;
}

const app = new Hono<AuthEnv>()
	// GET / — every currency this user has any overall budget row for, with its latest
	// effective amount (ADR-0009). Effective-dated rows (ADR-0015) are reduced per
	// currency to the most recent month.
	.get("/", async (c) => {
		const userId = c.get("user").id;
		const rows = await db
			.select({
				currency: budgets.currency,
				month: budgets.month,
				amount: budgets.amount,
			})
			.from(budgets)
			.where(eq(budgets.userId, userId));

		const latest = new Map<string, { month: string; amount: number | null }>();
		for (const r of rows) {
			const cur = latest.get(r.currency);
			if (!cur || r.month > cur.month) {
				latest.set(r.currency, { month: r.month, amount: r.amount });
			}
		}
		return c.json(
			[...latest.entries()].map(([currency, v]) => ({
				currency,
				amount: v.amount,
			})),
		);
	})
	// GET /summary?currency=&month= — everything the budgets page needs in one shot,
	// scoped to one currency and one month (ADR-0010/0015). Budgets are effective-dated,
	// so figures resolve to whatever amount was in effect as of the selected month.
	.get("/summary", zValidator("query", summaryQuery), async (c) => {
		const userId = c.get("user").id;
		const { currency: requestedCurrency, month: requestedMonth } =
			c.req.valid("query");
		const { currency, availableCurrencies } = await resolveCurrencyScope(
			userId,
			requestedCurrency,
		);

		const now = new Date();
		const currentMonth = toMonthKey(now);

		// Earliest navigable month = first transaction month in this currency (Q5),
		// else the current month for a user with no data.
		const [{ earliest } = { earliest: null }] = await db
			.select({ earliest: min(transactions.date) })
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.currency, currency),
				),
			);
		const earliestMonth = earliest ? earliest.slice(0, 7) : currentMonth;

		// Clamp the requested month into [earliestMonth, currentMonth]; default = current.
		let selectedMonth = requestedMonth ?? currentMonth;
		if (selectedMonth > currentMonth) selectedMonth = currentMonth;
		if (selectedMonth < earliestMonth) selectedMonth = earliestMonth;

		const selectedStart = monthToDate(selectedMonth);
		const nextMonthStart = isoDate(
			new Date(selectedStart.getFullYear(), selectedStart.getMonth() + 1, 1),
		);
		const monthStart = isoDate(selectedStart);
		const historyStartDate = new Date(
			selectedStart.getFullYear(),
			selectedStart.getMonth() - (HISTORY_MONTHS - 1),
			1,
		);
		const historyStart = isoDate(historyStartDate);

		// Expense transactions in this currency across the history window (up to the end
		// of the selected month). Transfers are excluded — they aren't spending.
		const txns = await db
			.select({
				date: transactions.date,
				amount: transactions.amount,
				categoryId: transactions.categoryId,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.currency, currency),
					gte(transactions.date, historyStart),
					lt(transactions.date, nextMonthStart),
				),
			);

		const cats = await db
			.select()
			.from(categories)
			.where(eq(categories.userId, userId));
		const catById = new Map(cats.map((cat) => [cat.id, cat]));
		const topExpense = cats
			.filter((cat) => cat.parentId === null && cat.kind === "expense")
			.sort(
				(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
			);

		// A subcategory's spend rolls up to its top-level parent's budget (ADR-0010).
		const topExpenseIdOf = (categoryId: string | null): string | null => {
			if (!categoryId) return null;
			const cat = catById.get(categoryId);
			if (!cat || cat.kind !== "expense") return null;
			return cat.parentId ?? cat.id;
		};

		// All effective-dated budget rows for this currency (resolved in JS per month).
		const overallRows = await db
			.select({ month: budgets.month, amount: budgets.amount })
			.from(budgets)
			.where(and(eq(budgets.userId, userId), eq(budgets.currency, currency)));
		const catRows = await db
			.select({
				categoryId: categoryBudgets.categoryId,
				month: categoryBudgets.month,
				amount: categoryBudgets.amount,
			})
			.from(categoryBudgets)
			.where(
				and(
					eq(categoryBudgets.userId, userId),
					eq(categoryBudgets.currency, currency),
				),
			);
		const catRowsById = new Map<
			string,
			{ month: string; amount: number | null }[]
		>();
		for (const r of catRows) {
			const list = catRowsById.get(r.categoryId) ?? [];
			list.push({ month: r.month, amount: r.amount });
			catRowsById.set(r.categoryId, list);
		}

		let overallSpent = 0;
		const catSpent = new Map<string, number>();
		const historyByMonth = new Map<string, number>();
		for (const t of txns) {
			if (t.amount >= 0) continue; // expenses only
			const expense = -t.amount;
			historyByMonth.set(
				t.date.slice(0, 7),
				(historyByMonth.get(t.date.slice(0, 7)) ?? 0) + expense,
			);
			if (t.date >= monthStart) {
				overallSpent += expense;
				const topId = topExpenseIdOf(t.categoryId);
				if (topId) catSpent.set(topId, (catSpent.get(topId) ?? 0) + expense);
			}
		}

		const categoriesOut = topExpense.map((cat) => ({
			id: cat.id,
			name: cat.name,
			color: cat.color,
			icon: cat.icon,
			budget: effectiveAsOf(catRowsById.get(cat.id) ?? [], selectedMonth),
			spent: catSpent.get(cat.id) ?? 0,
		}));

		// 6 months ending at the selected month; each carries its own effective budget
		// (Q6 — the trend line steps to match history) and that month's spend.
		const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
			const d = new Date(
				selectedStart.getFullYear(),
				selectedStart.getMonth() - (HISTORY_MONTHS - 1) + i,
				1,
			);
			const key = toMonthKey(d);
			return {
				month: `${key}-01`,
				spent: historyByMonth.get(key) ?? 0,
				budget: effectiveAsOf(overallRows, key),
			};
		});

		return c.json({
			currency,
			availableCurrencies,
			month: selectedMonth,
			earliestMonth,
			currentMonth,
			overall: {
				budget: effectiveAsOf(overallRows, selectedMonth),
				spent: overallSpent,
			},
			categories: categoriesOut,
			history,
		});
	})
	// PATCH /:currency — set (or tombstone-clear) the overall budget effective from the
	// given month onward (ADR-0015). Never rewrites earlier months.
	.patch(
		"/:currency",
		zValidator("param", currencyParam),
		zValidator("json", updateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { currency } = c.req.valid("param");
			const code = currency.toUpperCase();
			const { month, amount } = c.req.valid("json");
			const monthDate = `${month}-01`;

			const [row] = await db
				.insert(budgets)
				.values({ userId, currency: code, month: monthDate, amount })
				.onConflictDoUpdate({
					target: [budgets.userId, budgets.currency, budgets.month],
					set: { amount, updatedAt: new Date() },
				})
				.returning({
					currency: budgets.currency,
					month: budgets.month,
					amount: budgets.amount,
				});
			return c.json(row);
		},
	)
	// PATCH /categories/:categoryId — set/tombstone-clear a category budget effective
	// from the given month. Only top-level expense categories may carry one (ADR-0010).
	.patch(
		"/categories/:categoryId",
		zValidator("param", categoryIdParam),
		zValidator("json", categoryUpdateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { categoryId } = c.req.valid("param");
			const { currency, month, amount } = c.req.valid("json");
			const code = currency.toUpperCase();
			const monthDate = `${month}-01`;

			const [cat] = await db
				.select()
				.from(categories)
				.where(
					and(eq(categories.id, categoryId), eq(categories.userId, userId)),
				);
			if (!cat) {
				throw new AppError("not_found", "Category not found");
			}
			if (cat.parentId !== null || cat.kind !== "expense") {
				throw new AppError(
					"invalid",
					"Only top-level expense categories can be budgeted",
				);
			}

			const [row] = await db
				.insert(categoryBudgets)
				.values({
					userId,
					categoryId,
					currency: code,
					month: monthDate,
					amount,
				})
				.onConflictDoUpdate({
					target: [
						categoryBudgets.categoryId,
						categoryBudgets.currency,
						categoryBudgets.month,
					],
					set: { amount, updatedAt: new Date() },
				})
				.returning({
					categoryId: categoryBudgets.categoryId,
					currency: categoryBudgets.currency,
					month: categoryBudgets.month,
					amount: categoryBudgets.amount,
				});
			return c.json(row);
		},
	);

export default app;
