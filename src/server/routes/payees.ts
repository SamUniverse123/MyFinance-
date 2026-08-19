import { zValidator } from "@hono/zod-validator";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "#/env";
import { AppError } from "#/server/lib/error";
import { db } from "@/db";
import {
	payees,
	rules,
	scheduledTransactions,
	transactions,
} from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";

const idParam = z.object({ id: z.uuid() });

/** Full URL or messy input → bare hostname ("https://www.netflix.com/browse" → "netflix.com"). */
function normalizeDomain(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/\/.*$/, "")
		.trim();
}

const payeeBodySchema = z.object({
	name: z.string().trim().min(1),
	// Optional website/domain, normalized to a bare hostname; "" or absent → null.
	domain: z
		.string()
		.trim()
		.optional()
		.nullable()
		.transform((v) => (v ? normalizeDomain(v) || null : null)),
});

const searchQuerySchema = z.object({ q: z.string().trim().default("") });

/** A single Brand Search hit exposed to the client. */
type BrandResult = { name: string; domain: string };

const mergeSchema = z.object({
	survivorId: z.uuid(),
	mergedIds: z.array(z.uuid()).min(1),
});

/**
 * Postgres unique_violation → the app's conflict shape. drizzle-orm wraps driver
 * errors in `DrizzleQueryError`, so the pg error code lands on `.cause`. Mirrors the
 * helper in `routes/categories.ts`.
 */
function isUniqueViolation(err: unknown): boolean {
	const pgCode = (code: unknown): code is string => code === "23505";
	if (typeof err !== "object" || err === null) return false;
	if (pgCode((err as { code?: unknown }).code)) return true;
	const cause = (err as { cause?: unknown }).cause;
	return (
		typeof cause === "object" &&
		cause !== null &&
		pgCode((cause as { code?: unknown }).code)
	);
}

async function getOwned(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(payees)
		.where(and(eq(payees.id, id), eq(payees.userId, userId)));
	return row;
}

const app = new Hono<AuthEnv>()
	/** GET / — every payee owned by the caller, with its live transaction count. */
	.get("/", async (c) => {
		const userId = c.get("user").id;
		return c.json(
			await db
				.select({
					id: payees.id,
					name: payees.name,
					domain: payees.domain,
					createdAt: payees.createdAt,
					transactionCount: count(transactions.id),
				})
				.from(payees)
				.leftJoin(
					transactions,
					and(
						eq(transactions.payeeId, payees.id),
						eq(transactions.userId, userId),
					),
				)
				.where(eq(payees.userId, userId))
				.groupBy(payees.id)
				.orderBy(sql`lower(${payees.name})`),
		);
	})
	/**
	 * GET /brand-search?q= — logo.dev Brand Search proxy (ADR-0014). Uses the secret
	 * key server-side (never exposed to the client). Degrades to an empty list when the
	 * key is unset or the upstream call fails, so the typeahead is best-effort.
	 */
	.get("/brand-search", zValidator("query", searchQuerySchema), async (c) => {
		const { q } = c.req.valid("query");
		const key = env.LOGO_DEV_SECRET_KEY;
		const empty: BrandResult[] = [];
		if (!q || !key) return c.json(empty);

		try {
			const res = await fetch(
				`https://api.logo.dev/search?q=${encodeURIComponent(q)}`,
				{ headers: { Authorization: `Bearer ${key}` } },
			);
			if (!res.ok) return c.json(empty);
			const data = (await res.json()) as Array<{
				name?: string;
				domain?: string;
			}>;
			const results: BrandResult[] = data
				.filter((d): d is BrandResult => Boolean(d.name && d.domain))
				.map((d) => ({ name: d.name, domain: d.domain }));
			return c.json(results);
		} catch {
			return c.json(empty);
		}
	})
	/**
	 * POST / — create-or-link. Returns the existing payee (200) when the name already
	 * exists case-insensitively, else the newly created one (201). This is the upsert
	 * the entry-form combobox relies on so two rapid entries of a new payee can't race
	 * into a unique-violation error (transactions.md §2.5).
	 */
	.post("/", zValidator("json", payeeBodySchema), async (c) => {
		const userId = c.get("user").id;
		const { name, domain } = c.req.valid("json");
		try {
			const [row] = await db
				.insert(payees)
				.values({ userId, name, domain })
				.returning();
			return c.json(row, 201);
		} catch (err) {
			if (isUniqueViolation(err)) {
				const [existing] = await db
					.select()
					.from(payees)
					.where(
						and(
							eq(payees.userId, userId),
							sql`lower(${payees.name}) = lower(${name})`,
						),
					);
				return c.json(existing, 200);
			}
			throw err;
		}
	})
	/** PATCH /:id — rename and/or set the domain. */
	.patch(
		"/:id",
		zValidator("param", idParam),
		zValidator("json", payeeBodySchema),
		async (c) => {
			const userId = c.get("user").id;
			const { id } = c.req.valid("param");
			const { name, domain } = c.req.valid("json");

			const existing = await getOwned(id, userId);
			if (!existing) {
				throw new AppError("not_found", "Payee not found", { payeeId: id });
			}

			try {
				const [row] = await db
					.update(payees)
					.set({ name, domain })
					.where(and(eq(payees.id, id), eq(payees.userId, userId)))
					.returning();
				return c.json(row);
			} catch (err) {
				if (isUniqueViolation(err)) {
					throw new AppError(
						"conflict",
						"A payee with this name already exists",
					);
				}
				throw err;
			}
		},
	)
	/**
	 * DELETE /:id — 204. The three FKs referencing a payee are `SET NULL` (ADR-0012),
	 * so referencing transactions/scheduled/rules simply lose the link; no reassignment
	 * flow. The client warns about the affected count using the list's transactionCount.
	 */
	.delete("/:id", zValidator("param", idParam), async (c) => {
		const userId = c.get("user").id;
		const { id } = c.req.valid("param");

		const existing = await getOwned(id, userId);
		if (!existing) {
			throw new AppError("not_found", "Payee not found", { payeeId: id });
		}

		await db
			.delete(payees)
			.where(and(eq(payees.id, id), eq(payees.userId, userId)));
		return c.body(null, 204);
	})
	/**
	 * POST /merge — collapse duplicate payees into one survivor (Q14). Every
	 * transaction/scheduled/rule pointing at a merged payee is repointed to the
	 * survivor, then the merged payees are deleted — all in one DB transaction so a
	 * partial merge can never leave dangling references.
	 */
	.post("/merge", zValidator("json", mergeSchema), async (c) => {
		const userId = c.get("user").id;
		const { survivorId, mergedIds } = c.req.valid("json");

		const losers = mergedIds.filter((mergedId) => mergedId !== survivorId);
		if (losers.length === 0) {
			throw new AppError(
				"invalid",
				"Pick at least one other payee to merge into the survivor",
			);
		}

		const survivor = await getOwned(survivorId, userId);
		if (!survivor) {
			throw new AppError("not_found", "Survivor payee not found", {
				payeeId: survivorId,
			});
		}

		const owned = await db
			.select({ id: payees.id })
			.from(payees)
			.where(and(eq(payees.userId, userId), inArray(payees.id, losers)));
		if (owned.length !== losers.length) {
			throw new AppError(
				"not_found",
				"One or more payees to merge weren't found",
			);
		}

		await db.transaction(async (tx) => {
			await tx
				.update(transactions)
				.set({ payeeId: survivorId, updatedAt: new Date() })
				.where(
					and(
						eq(transactions.userId, userId),
						inArray(transactions.payeeId, losers),
					),
				);
			await tx
				.update(scheduledTransactions)
				.set({ payeeId: survivorId, updatedAt: new Date() })
				.where(
					and(
						eq(scheduledTransactions.userId, userId),
						inArray(scheduledTransactions.payeeId, losers),
					),
				);
			await tx
				.update(rules)
				.set({ setPayeeId: survivorId })
				.where(
					and(eq(rules.userId, userId), inArray(rules.setPayeeId, losers)),
				);
			await tx
				.delete(payees)
				.where(and(eq(payees.userId, userId), inArray(payees.id, losers)));
		});

		return c.json(survivor);
	});

export default app;
