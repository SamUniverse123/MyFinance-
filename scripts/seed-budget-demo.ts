/**
 * Seeds a throwaway demo user built specifically to exercise the budget month toggle
 * (ADR-0015): 8 months of USD transaction history (past the 6-month trend window, so
 * the toggle's earliest bound is reachable), plus budgets that actually *change* over
 * that history so carry-forward, a mid-history bump, and a tombstone-clear are all
 * visible when scrolling back:
 *
 *   - Overall (USD):  $2,000/mo starting 7 months ago  →  bumped to $2,500 3 months ago
 *   - Groceries:      $400/mo starting 6 months ago    →  bumped to $500 2 months ago
 *   - Dining:         $150/mo starting 5 months ago    →  cleared (tombstoned) 1 month ago
 *   - Rent:           never budgeted — the "Set budget" empty state, for contrast
 *
 * Safe to re-run — each run creates a fresh user (random email suffix).
 *
 * Usage: pnpm seed:budgets
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
// Dynamic imports: `#/db` transitively loads `src/env.ts`, which validates env vars
// at module-eval time — it must run *after* the `config()` call above, not before.
const { db } = await import("#/db");
const { accounts, budgets, categories, categoryBudgets, transactions, user } =
	await import("#/db/schema");
const { auth } = await import("#/lib/auth/auth");

const DEMO_PASSWORD = "DemoPassword123!";
const MONTHS_OF_HISTORY = 8;

function minor(major: number): number {
	return Math.round(major * 100);
}

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** First-of-month date, `n` months before the current month. */
function monthsAgoStart(n: number): string {
	const d = new Date();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() - n);
	return isoDate(d);
}

async function main() {
	const email = `budgets-demo-${faker.string.alphanumeric(8).toLowerCase()}@example.com`;

	const signUp = await auth.api.signUpEmail({
		body: { email, password: DEMO_PASSWORD, name: "Budget Demo" },
	});
	const userId = signUp.user.id;

	// Skip email verification — this is a throwaway local account.
	await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));

	// --- Accounts ---
	const [checking] = await db
		.insert(accounts)
		.values({
			userId,
			name: "Everyday Checking",
			type: "checking",
			currency: "USD",
			initialBalance: minor(3000),
			color: "#2a78d6",
			icon: "checking",
		})
		.returning();
	const [creditCard] = await db
		.insert(accounts)
		.values({
			userId,
			name: "Rewards Credit Card",
			type: "credit_card",
			currency: "USD",
			initialBalance: minor(-200),
			color: "#4a3aa7",
			icon: "credit_card",
		})
		.returning();

	// --- Categories ---
	const expenseDefs = [
		{ name: "Groceries", icon: "shopping-cart", color: "#eb6834" },
		{ name: "Rent", icon: "home", color: "#e34948" },
		{ name: "Dining", icon: "utensils", color: "#eda100" },
		{ name: "Transport", icon: "car", color: "#2a78d6" },
	] as const;
	const incomeDefs = [{ name: "Salary", icon: "briefcase", color: "#1baf7a" }] as const;

	const expenseCategories = await db
		.insert(categories)
		.values(expenseDefs.map((c) => ({ userId, kind: "expense" as const, ...c })))
		.returning();
	const incomeCategories = await db
		.insert(categories)
		.values(incomeDefs.map((c) => ({ userId, kind: "income" as const, ...c })))
		.returning();
	const byName = new Map(
		[...expenseCategories, ...incomeCategories].map((c) => [c.name, c]),
	);

	// --- Transactions: MONTHS_OF_HISTORY months back, so the toggle's earliest bound
	// sits well past the 6-month trend window. ---
	const today = new Date();
	const daysBack = MONTHS_OF_HISTORY * 31;
	const rows: (typeof transactions.$inferInsert)[] = [];

	for (let daysAgo = daysBack; daysAgo >= 0; daysAgo--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - daysAgo);
		const dateStr = isoDate(date);
		const dayOfMonth = date.getUTCDate();

		if (dayOfMonth === 1) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Salary")?.id,
				amount: minor(4200),
				currency: "USD",
				date: dateStr,
				payeeName: "Acme Corp Payroll",
				status: "cleared",
			});
		}
		if (dayOfMonth === 2) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Rent")?.id,
				amount: minor(-1500),
				currency: "USD",
				date: dateStr,
				payeeName: "Maple Court Apartments",
				status: "cleared",
			});
		}
		// Groceries roughly twice a week, drifting a bit month to month so the trend
		// bars (and the budget-vs-spend status colors) actually vary.
		if (daysAgo % 3 === 0) {
			rows.push({
				userId,
				accountId: creditCard.id,
				categoryId: byName.get("Groceries")?.id,
				amount: minor(-faker.number.float({ min: 25, max: 130, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement([
					"Trader Joe's",
					"Whole Foods",
					"Safeway",
					"Local Market",
				]),
				status: "cleared",
			});
		}
		// Dining a few times a week.
		if (faker.number.int({ min: 1, max: 10 }) <= 4) {
			rows.push({
				userId,
				accountId: creditCard.id,
				categoryId: byName.get("Dining")?.id,
				amount: minor(-faker.number.float({ min: 8, max: 60, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement([
					"Blue Bottle Coffee",
					"Ramen House",
					"Corner Deli",
					"Pizzeria Roma",
				]),
				status: "cleared",
			});
		}
		// Transport a few times a week.
		if (faker.number.int({ min: 1, max: 10 }) <= 3) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Transport")?.id,
				amount: minor(-faker.number.float({ min: 4, max: 45, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement([
					"Metro Transit",
					"Shell Gas",
					"Uber",
					"City Parking",
				]),
				status: "cleared",
			});
		}
	}

	await db.insert(transactions).values(rows);

	// --- Budgets: effective-dated, deliberately changing partway through history
	// (ADR-0015) so the toggle actually has something to show off. ---
	await db.insert(budgets).values([
		{ userId, currency: "USD", month: monthsAgoStart(7), amount: minor(2000) },
		{ userId, currency: "USD", month: monthsAgoStart(3), amount: minor(2500) },
	]);

	const groceries = byName.get("Groceries");
	const dining = byName.get("Dining");
	if (groceries) {
		await db.insert(categoryBudgets).values([
			{
				userId,
				categoryId: groceries.id,
				currency: "USD",
				month: monthsAgoStart(6),
				amount: minor(400),
			},
			{
				userId,
				categoryId: groceries.id,
				currency: "USD",
				month: monthsAgoStart(2),
				amount: minor(500),
			},
		]);
	}
	if (dining) {
		await db.insert(categoryBudgets).values([
			{
				userId,
				categoryId: dining.id,
				currency: "USD",
				month: monthsAgoStart(5),
				amount: minor(150),
			},
			// Tombstone: no Dining budget from 1 month ago onward.
			{
				userId,
				categoryId: dining.id,
				currency: "USD",
				month: monthsAgoStart(1),
				amount: null,
			},
		]);
	}
	// Rent is deliberately left with no budget rows at all.

	console.log("Seeded budget-toggle demo account:");
	console.log("  email:   ", email);
	console.log("  password:", DEMO_PASSWORD);
	console.log("  transactions:", rows.length);
	console.log("  budget history:");
	console.log(`    Overall:   $2,000 from ${monthsAgoStart(7)}, $2,500 from ${monthsAgoStart(3)}`);
	console.log(`    Groceries: $400 from ${monthsAgoStart(6)}, $500 from ${monthsAgoStart(2)}`);
	console.log(`    Dining:    $150 from ${monthsAgoStart(5)}, cleared from ${monthsAgoStart(1)}`);
	console.log("    Rent:      never budgeted");
	console.log(`  toggle range: ${monthsAgoStart(MONTHS_OF_HISTORY - 1)} .. current month`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
