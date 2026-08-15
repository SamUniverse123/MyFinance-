import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { budgets, categories, categoryBudgets, transactions } from "@/db/schema";
import { AppError } from "@/server/lib/error";
import { resolveCurrencyScope } from "@/server/lib/currency-scope";
import type { AuthEnv } from "../middleware/auth";

const currencyParam = z.object({ currency: z.string().regex(/^[A-Za-z]{3}$/) });

// null clears the budget for that currency; a number sets it (minor units, > 0).
const updateSchema = z.object({ amount: z.number().int().min(1).nullable() });

const summaryQuery = z.object({
	currency: z
		.string()
		.regex(/^[A-Za-z]{3}$/)
		.optional(),
});

const categoryIdParam = z.object({ categoryId: z.string().uuid() });
const categoryUpdateSchema = z.object({
	currency: z.string().regex(/^[A-Za-z]{3}$/),
	amount: z.number().int().min(1).nullable(),
});

const HISTORY_MONTHS = 6;

/** Local `YYYY-MM-DD` — transaction dates are naive local dates, so the month/history
 *  boundaries must be local too (a UTC boundary drops "today" east of UTC; see the
 *  matching fix in `dashboard.ts`). */
function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

const app = new Hono<AuthEnv>()
	// GET / — every currency this user has an overall budget set for (ADR-0009).
	.get("/", async (c) => {
		const userId = c.get("user").id;
		const rows = await db
			.select({ currency: budgets.currency, amount: budgets.amount })
			.from(budgets)
			.where(eq(budgets.userId, userId));
		return c.json(rows);
	})
	// GET /summary?currency= — everything the budgets page needs in one shot (ADR-0010,
	// same "one summary endpoint per page" rationale as ADR-0005): the overall figure,
	// per-category rows, and a 6-month spend history, all scoped to one currency.
	.get("/summary", zValidator("query", summaryQuery), async (c) => {
		const userId = c.get("user").id;
		const { currency: requestedCurrency } = c.req.valid("query");
		const { currency, availableCurrencies } = await resolveCurrencyScope(
			userId,
			requestedCurrency,
		);

		const today = new Date();
		const monthStart = isoDate(
			new Date(today.getFullYear(), today.getMonth(), 1),
		);
		const todayStr = isoDate(today);
		const historyStart = isoDate(
			new Date(today.getFullYear(), today.getMonth() - (HISTORY_MONTHS - 1), 1),
		);

		// Expense transactions in this currency over the history window. Transfers are
		// excluded (they move money between accounts, they aren't spending).
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
					isNull(transactions.transferGroupId),
					gte(transactions.date, historyStart),
					lte(transactions.date, todayStr),
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

		// A transaction categorized under a subcategory rolls up to its top-level
		// parent's budget (ADR-0010). Non-expense / unknown categories contribute to
		// no category bar (but still to the overall total, below).
		const topExpenseIdOf = (categoryId: string | null): string | null => {
			if (!categoryId) return null;
			const cat = catById.get(categoryId);
			if (!cat || cat.kind !== "expense") return null;
			return cat.parentId ?? cat.id;
		};

		const catBudgetRows = await db
			.select({
				categoryId: categoryBudgets.categoryId,
				amount: categoryBudgets.amount,
			})
			.from(categoryBudgets)
			.where(
				and(
					eq(categoryBudgets.userId, userId),
					eq(categoryBudgets.currency, currency),
				),
			);
		const catBudgetMap = new Map(
			catBudgetRows.map((r) => [r.categoryId, r.amount]),
		);

		const [overallBudgetRow] = await db
			.select({ amount: budgets.amount })
			.from(budgets)
			.where(and(eq(budgets.userId, userId), eq(budgets.currency, currency)));

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
			budget: catBudgetMap.get(cat.id) ?? null,
			spent: catSpent.get(cat.id) ?? 0,
		}));

		// Zero-filled, oldest → newest; `month` is the first day of each month.
		const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
			const d = new Date(
				today.getFullYear(),
				today.getMonth() - (HISTORY_MONTHS - 1) + i,
				1,
			);
			const key = isoDate(d).slice(0, 7);
			return { month: `${key}-01`, spent: historyByMonth.get(key) ?? 0 };
		});

		return c.json({
			currency,
			availableCurrencies,
			overall: { budget: overallBudgetRow?.amount ?? null, spent: overallSpent },
			categories: categoriesOut,
			history,
		});
	})
	// PATCH /:currency — upsert the overall budget with a positive amount, or clear it.
	.patch(
		"/:currency",
		zValidator("param", currencyParam),
		zValidator("json", updateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { currency } = c.req.valid("param");
			const code = currency.toUpperCase();
			const { amount } = c.req.valid("json");

			if (amount === null) {
				await db
					.delete(budgets)
					.where(and(eq(budgets.userId, userId), eq(budgets.currency, code)));
				return c.json(null);
			}

			const [row] = await db
				.insert(budgets)
				.values({ userId, currency: code, amount })
				.onConflictDoUpdate({
					target: [budgets.userId, budgets.currency],
					set: { amount, updatedAt: new Date() },
				})
				.returning({ currency: budgets.currency, amount: budgets.amount });
			return c.json(row);
		},
	)
	// PATCH /categories/:categoryId — upsert/clear a category budget for one currency.
	// Only top-level expense categories may carry one (ADR-0010).
	.patch(
		"/categories/:categoryId",
		zValidator("param", categoryIdParam),
		zValidator("json", categoryUpdateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { categoryId } = c.req.valid("param");
			const { currency, amount } = c.req.valid("json");
			const code = currency.toUpperCase();

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

			if (amount === null) {
				await db
					.delete(categoryBudgets)
					.where(
						and(
							eq(categoryBudgets.categoryId, categoryId),
							eq(categoryBudgets.currency, code),
						),
					);
				return c.json(null);
			}

			const [row] = await db
				.insert(categoryBudgets)
				.values({ userId, categoryId, currency: code, amount })
				.onConflictDoUpdate({
					target: [categoryBudgets.categoryId, categoryBudgets.currency],
					set: { amount, updatedAt: new Date() },
				})
				.returning({
					categoryId: categoryBudgets.categoryId,
					currency: categoryBudgets.currency,
					amount: categoryBudgets.amount,
				});
			return c.json(row);
		},
	);

export default app;
