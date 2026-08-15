/**
 * Seeds a throwaway demo user with a few months of realistic accounts/transactions,
 * so the dashboard's stat cards, cashflow chart, and net-worth sparkline have
 * something meaningful to render. Safe to re-run — each run creates a fresh user
 * (email includes a random suffix), so it never touches your real data.
 *
 * Usage: pnpm seed:demo
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
// Dynamic imports: `#/db` transitively loads `src/env.ts`, which validates env vars
// at module-eval time — it must run *after* the `config()` call above, not before.
// Static imports get hoisted ahead of that call, so they'd see an empty environment.
const { db } = await import("#/db");
const { accounts, categories, transactions, user } = await import("#/db/schema");
const { auth } = await import("#/lib/auth/auth");

const DEMO_PASSWORD = "DemoPassword123!";

function minor(major: number): number {
	return Math.round(major * 100);
}

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

async function main() {
	const email = `demo-${faker.string.alphanumeric(8).toLowerCase()}@example.com`;

	const signUp = await auth.api.signUpEmail({
		body: { email, password: DEMO_PASSWORD, name: "Demo User" },
	});
	const userId = signUp.user.id;

	// Skip email verification — this is a throwaway local account.
	await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));

	// --- Accounts ---
	const [checking] = await db
		.insert(accounts)
		.values({ userId, name: "Everyday Checking", type: "checking", currency: "USD", initialBalance: minor(3500), color: "#2a78d6", icon: "checking" })
		.returning();
	const [savings] = await db
		.insert(accounts)
		.values({ userId, name: "Savings", type: "savings", currency: "USD", initialBalance: minor(12000), color: "#1baf7a", icon: "savings" })
		.returning();
	const [creditCard] = await db
		.insert(accounts)
		.values({ userId, name: "Rewards Credit Card", type: "credit_card", currency: "USD", initialBalance: minor(-350), color: "#4a3aa7", icon: "credit_card" })
		.returning();

	// Extra-currency accounts (ADR-0009: currency toggle, never converted) — enough
	// currencies to exercise the toggle's 3-circle-button layout plus its overflow
	// dropdown for a 4th+.
	const [myrChecking] = await db
		.insert(accounts)
		.values({ userId, name: "Kuala Lumpur Checking", type: "checking", currency: "MYR", initialBalance: minor(8000), color: "#e34948", icon: "checking" })
		.returning();
	const [sgdSavings] = await db
		.insert(accounts)
		.values({ userId, name: "Singapore Savings", type: "savings", currency: "SGD", initialBalance: minor(15000), color: "#eda100", icon: "savings" })
		.returning();
	const [eurTravel] = await db
		.insert(accounts)
		.values({ userId, name: "Europe Travel Fund", type: "savings", currency: "EUR", initialBalance: minor(2000), color: "#008300", icon: "savings" })
		.returning();

	// --- Categories (beyond the auto-seeded "Balance Adjustment") ---
	const expenseDefs = [
		{ name: "Groceries", icon: "shopping-cart", color: "#eb6834" },
		{ name: "Rent", icon: "home", color: "#e34948" },
		{ name: "Dining", icon: "utensils", color: "#eda100" },
		{ name: "Transport", icon: "car", color: "#2a78d6" },
		{ name: "Entertainment", icon: "film", color: "#e87ba4" },
		{ name: "Utilities", icon: "zap", color: "#008300" },
	] as const;
	const incomeDefs = [
		{ name: "Salary", icon: "briefcase", color: "#1baf7a" },
		{ name: "Freelance", icon: "trending-up", color: "#4a3aa7" },
	] as const;

	const expenseCategories = await db
		.insert(categories)
		.values(expenseDefs.map((c) => ({ userId, kind: "expense" as const, ...c })))
		.returning();
	const incomeCategories = await db
		.insert(categories)
		.values(incomeDefs.map((c) => ({ userId, kind: "income" as const, ...c })))
		.returning();

	const byName = new Map([...expenseCategories, ...incomeCategories].map((c) => [c.name, c]));

	// --- Transactions: 90 days of realistic activity ---
	const today = new Date();
	const rows: (typeof transactions.$inferInsert)[] = [];

	for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - daysAgo);
		const dateStr = isoDate(date);
		const dayOfMonth = date.getUTCDate();

		// Monthly salary on the 1st
		if (dayOfMonth === 1) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Salary")!.id,
				amount: minor(4500),
				currency: "USD",
				date: dateStr,
				payeeName: "Acme Corp Payroll",
				status: "cleared",
			});
		}
		// Monthly rent on the 2nd
		if (dayOfMonth === 2) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Rent")!.id,
				amount: minor(-1500),
				currency: "USD",
				date: dateStr,
				payeeName: "Maple Court Apartments",
				status: "cleared",
			});
		}
		// Monthly utilities around the 5th
		if (dayOfMonth === 5) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Utilities")!.id,
				amount: minor(-faker.number.int({ min: 80, max: 160 })),
				currency: "USD",
				date: dateStr,
				payeeName: "City Power & Water",
				status: "cleared",
			});
		}
		// Groceries roughly twice a week
		if (daysAgo % 3 === 0) {
			rows.push({
				userId,
				accountId: creditCard.id,
				categoryId: byName.get("Groceries")!.id,
				amount: minor(-faker.number.float({ min: 25, max: 110, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Trader Joe's", "Whole Foods", "Safeway", "Local Market"]),
				status: "cleared",
			});
		}
		// Dining out a few times a week
		if (faker.number.int({ min: 1, max: 10 }) <= 4) {
			rows.push({
				userId,
				accountId: creditCard.id,
				categoryId: byName.get("Dining")!.id,
				amount: minor(-faker.number.float({ min: 8, max: 55, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Blue Bottle Coffee", "Ramen House", "Corner Deli", "Pizzeria Roma"]),
				status: "cleared",
			});
		}
		// Transport a few times a week
		if (faker.number.int({ min: 1, max: 10 }) <= 3) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Transport")!.id,
				amount: minor(-faker.number.float({ min: 4, max: 45, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Metro Transit", "Shell Gas", "Uber", "City Parking"]),
				status: "cleared",
			});
		}
		// Occasional entertainment
		if (faker.number.int({ min: 1, max: 10 }) === 1) {
			rows.push({
				userId,
				accountId: creditCard.id,
				categoryId: byName.get("Entertainment")!.id,
				amount: minor(-faker.number.float({ min: 12, max: 90, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Netflix", "AMC Theatres", "Steam", "Spotify"]),
				status: "cleared",
			});
		}
		// Occasional freelance income
		if (faker.number.int({ min: 1, max: 30 }) === 1) {
			rows.push({
				userId,
				accountId: checking.id,
				categoryId: byName.get("Freelance")!.id,
				amount: minor(faker.number.float({ min: 200, max: 900, fractionDigits: 2 })),
				currency: "USD",
				date: dateStr,
				payeeName: faker.company.name(),
				status: "cleared",
			});
		}

		// MYR: monthly salary + a few groceries runs a week, so its own currency
		// scope has independent income/expense figures to toggle to.
		if (dayOfMonth === 1) {
			rows.push({
				userId,
				accountId: myrChecking.id,
				categoryId: byName.get("Salary")!.id,
				amount: minor(9500),
				currency: "MYR",
				date: dateStr,
				payeeName: "Petronas Payroll",
				status: "cleared",
			});
		}
		if (daysAgo % 4 === 0) {
			rows.push({
				userId,
				accountId: myrChecking.id,
				categoryId: byName.get("Groceries")!.id,
				amount: minor(-faker.number.float({ min: 30, max: 150, fractionDigits: 2 })),
				currency: "MYR",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Jaya Grocer", "AEON", "Village Grocer"]),
				status: "cleared",
			});
		}

		// SGD: a lighter monthly cadence — rent plus occasional dining.
		if (dayOfMonth === 3) {
			rows.push({
				userId,
				accountId: sgdSavings.id,
				categoryId: byName.get("Rent")!.id,
				amount: minor(-1800),
				currency: "SGD",
				date: dateStr,
				payeeName: "Marina Bay Residences",
				status: "cleared",
			});
		}
		if (faker.number.int({ min: 1, max: 10 }) === 1) {
			rows.push({
				userId,
				accountId: sgdSavings.id,
				categoryId: byName.get("Dining")!.id,
				amount: minor(-faker.number.float({ min: 10, max: 60, fractionDigits: 2 })),
				currency: "SGD",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Din Tai Fung", "Newton Food Centre", "Ya Kun Kaya Toast"]),
				status: "cleared",
			});
		}

		// EUR: sparse — just enough to prove it toggles and to push the toggle into
		// its overflow-dropdown state (4th currency).
		if (faker.number.int({ min: 1, max: 20 }) === 1) {
			rows.push({
				userId,
				accountId: eurTravel.id,
				categoryId: byName.get("Entertainment")!.id,
				amount: minor(-faker.number.float({ min: 15, max: 120, fractionDigits: 2 })),
				currency: "EUR",
				date: dateStr,
				payeeName: faker.helpers.arrayElement(["Louvre Museum", "Café de Flore", "Trattoria Roma"]),
				status: "cleared",
			});
		}
	}

	await db.insert(transactions).values(rows);

	console.log("Seeded demo account:");
	console.log("  email:   ", email);
	console.log("  password:", DEMO_PASSWORD);
	console.log("  accounts:", [checking, savings, creditCard, myrChecking, sgdSavings, eurTravel].map((a) => a.name).join(", "));
	console.log("  transactions:", rows.length);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
