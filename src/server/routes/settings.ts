import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/db";
import { accounts, userSettings } from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";

const updateSchema = z.object({
	baseCurrency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.optional(),
});

/** Most common currency among the user's non-excluded open accounts; USD when none. */
async function inferBaseCurrency(userId: string): Promise<string> {
	const rows = await db
		.select({ currency: accounts.currency })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), isNull(accounts.closedAt)));
	const counts = new Map<string, number>();
	for (const r of rows)
		counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
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

const app = new Hono<AuthEnv>()
	.get("/", async (c) => {
		const userId = c.get("user").id;
		const [row] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId));
		// Don't auto-create a row here — an absent row lets the dashboard infer the base
		// currency instead of pinning it to the USD column default (see dashboard.ts).
		return c.json(row ?? null);
	})
	.patch("/", zValidator("json", updateSchema), async (c) => {
		const userId = c.get("user").id;
		const input = c.req.valid("json");

		const [existing] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId));

		if (existing) {
			const [row] = await db
				.update(userSettings)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(userSettings.userId, userId))
				.returning();
			return c.json(row);
		}

		// First write for this user — seed the row. If they didn't explicitly choose a
		// base currency, infer it from their accounts so creating the row (e.g. just to
		// set a budget) doesn't silently switch net worth to the USD column default.
		const baseCurrency =
			input.baseCurrency ?? (await inferBaseCurrency(userId));
		const [row] = await db
			.insert(userSettings)
			.values({
				userId,
				baseCurrency,
			})
			.returning();
		return c.json(row);
	});

export default app;
