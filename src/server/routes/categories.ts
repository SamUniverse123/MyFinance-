import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "#/server/lib/error";
import { db } from "@/db";
import {
	categories,
	categoryKind,
	rules,
	scheduledTransactions,
	transactionSplits,
	transactions,
} from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";

const idParam = z.object({ id: z.uuid() });

const insertSchema = z.object({
	name: z.string().trim().min(1),
	kind: z.enum(categoryKind.enumValues),
	parentId: z.uuid().nullish(),
	color: z.string().nullish(),
	icon: z.string().nullish(),
});

const updateSchema = z.object({
	name: z.string().trim().min(1).optional(),
	kind: z.enum(categoryKind.enumValues).optional(),
	parentId: z.uuid().nullable().optional(),
	color: z.string().nullish(),
	icon: z.string().nullish(),
	sortOrder: z.number().int().optional(),
});

const deleteBodySchema = z
	.object({ reassignTo: z.uuid().nullable().optional() })
	.optional();

/**
 * Postgres unique_violation → the app's conflict shape (see ADR-0004).
 * drizzle-orm wraps driver errors in `DrizzleQueryError`, so the pg error code
 * lands on `.cause`, not the caught error itself.
 */
function isUniqueViolation(err: unknown): boolean {
	const pgCode = (code: unknown): code is string => code === "23505";
	if (typeof err !== "object" || err === null) return false;
	if (pgCode((err as { code?: unknown }).code)) return true;
	const cause = (err as { cause?: unknown }).cause;
	return typeof cause === "object" && cause !== null && pgCode((cause as { code?: unknown }).code);
}

async function getOwned(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.id, id), eq(categories.userId, userId)));
	return row;
}

const app = new Hono<AuthEnv>()
	.get("/", async (c) => {
		const userId = c.get("user").id;
		return c.json(
			await db
				.select()
				.from(categories)
				.where(eq(categories.userId, userId))
				.orderBy(categories.kind, categories.sortOrder, categories.name),
		);
	})
	.post("/", zValidator("json", insertSchema), async (c) => {
		const userId = c.get("user").id;
		const input = c.req.valid("json");

		if (input.parentId) {
			const parent = await getOwned(input.parentId, userId);
			if (!parent) {
				throw new AppError("not_found", "Parent category not found", {
					parentId: input.parentId,
				});
			}
			if (parent.parentId !== null) {
				throw new AppError(
					"invalid",
					"Cannot create a subcategory under another subcategory — the hierarchy is capped at two levels",
				);
			}
			if (parent.kind !== input.kind) {
				throw new AppError(
					"invalid",
					"A subcategory's kind must match its parent's kind",
				);
			}
		}

		try {
			const [row] = await db
				.insert(categories)
				.values({ ...input, userId })
				.returning();
			return c.json(row, 201);
		} catch (err) {
			if (isUniqueViolation(err)) {
				throw new AppError(
					"conflict",
					"A category with this name already exists here",
				);
			}
			throw err;
		}
	})
	.patch(
		"/:id",
		zValidator("param", idParam),
		zValidator("json", updateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { id } = c.req.valid("param");
			const input = c.req.valid("json");

			const existing = await getOwned(id, userId);
			if (!existing) {
				throw new AppError("not_found", "Category not found", {
					categoryId: id,
				});
			}

			const changesIdentity =
				input.name !== undefined ||
				input.parentId !== undefined ||
				input.kind !== undefined;
			if (existing.isSystem && changesIdentity) {
				throw new AppError(
					"forbidden",
					"System categories can't be renamed or reorganized — only color and icon can be changed",
				);
			}

			const effectiveKind = input.kind ?? existing.kind;
			const effectiveParentId =
				"parentId" in input ? input.parentId : existing.parentId;

			if (effectiveParentId) {
				if (effectiveParentId === id) {
					throw new AppError("invalid", "A category cannot be its own parent");
				}
				const parent = await getOwned(effectiveParentId, userId);
				if (!parent) {
					throw new AppError("not_found", "Parent category not found", {
						parentId: effectiveParentId,
					});
				}
				if (parent.parentId !== null) {
					throw new AppError(
						"invalid",
						"Cannot move under another subcategory — the hierarchy is capped at two levels",
					);
				}
				if (parent.kind !== effectiveKind) {
					throw new AppError(
						"invalid",
						"A subcategory's kind must match its parent's kind",
					);
				}
			}

			const [{ childCount }] = await db
				.select({ childCount: count() })
				.from(categories)
				.where(eq(categories.parentId, id));

			if (childCount > 0) {
				if (effectiveKind !== existing.kind) {
					throw new AppError(
						"conflict",
						`This category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"} — change their kind first`,
						{ childCount },
					);
				}
				if (effectiveParentId !== null) {
					throw new AppError(
						"conflict",
						"This category has subcategories and can't become a subcategory itself",
						{ childCount },
					);
				}
			}

			try {
				const [row] = await db
					.update(categories)
					.set(input)
					.where(and(eq(categories.id, id), eq(categories.userId, userId)))
					.returning();
				return c.json(row);
			} catch (err) {
				if (isUniqueViolation(err)) {
					throw new AppError(
						"conflict",
						"A category with this name already exists here",
					);
				}
				throw err;
			}
		},
	)
	.delete(
		"/:id",
		zValidator("param", idParam),
		zValidator("json", deleteBodySchema),
		async (c) => {
			const userId = c.get("user").id;
			const { id } = c.req.valid("param");
			const body = c.req.valid("json");
			const reassignProvided = body !== undefined && "reassignTo" in body;
			const reassignTo = body?.reassignTo ?? null;

			const existing = await getOwned(id, userId);
			if (!existing) {
				throw new AppError("not_found", "Category not found", {
					categoryId: id,
				});
			}
			if (existing.isSystem) {
				throw new AppError("forbidden", "System categories can't be deleted");
			}

			const [
				[{ n: childCount }],
				[{ n: transactionCount }],
				[{ n: scheduledCount }],
				[{ n: splitCount }],
				[{ n: ruleCount }],
			] = await Promise.all([
				db
					.select({ n: count() })
					.from(categories)
					.where(eq(categories.parentId, id)),
				db
					.select({ n: count() })
					.from(transactions)
					.where(
						and(
							eq(transactions.categoryId, id),
							eq(transactions.userId, userId),
						),
					),
				db
					.select({ n: count() })
					.from(scheduledTransactions)
					.where(
						and(
							eq(scheduledTransactions.categoryId, id),
							eq(scheduledTransactions.userId, userId),
						),
					),
				db
					.select({ n: count() })
					.from(transactionSplits)
					.where(eq(transactionSplits.categoryId, id)),
				db
					.select({ n: count() })
					.from(rules)
					.where(and(eq(rules.setCategoryId, id), eq(rules.userId, userId))),
			]);

			const hasDependents =
				childCount > 0 ||
				transactionCount > 0 ||
				scheduledCount > 0 ||
				splitCount > 0 ||
				ruleCount > 0;

			if (hasDependents && !reassignProvided) {
				throw new AppError(
					"conflict",
					"This category is still in use — pick a replacement before deleting it",
					{
						childCount,
						transactionCount,
						scheduledCount,
						splitCount,
						ruleCount,
					},
				);
			}

			if (reassignTo) {
				if (reassignTo === id) {
					throw new AppError(
						"invalid",
						"Cannot reassign to the category being deleted",
					);
				}
				const target = await getOwned(reassignTo, userId);
				if (!target) {
					throw new AppError("not_found", "Reassignment target not found", {
						categoryId: reassignTo,
					});
				}
				if (target.kind !== existing.kind) {
					throw new AppError(
						"invalid",
						"Reassignment target must have the same kind",
					);
				}
				if (childCount > 0 && target.parentId !== null) {
					throw new AppError(
						"invalid",
						"Reassignment target must be a top-level category to receive subcategories",
					);
				}
			}

			try {
				await db.transaction(async (tx) => {
					if (childCount > 0) {
						await tx
							.update(categories)
							.set({ parentId: reassignTo })
							.where(eq(categories.parentId, id));
					}
					if (transactionCount > 0) {
						await tx
							.update(transactions)
							.set({ categoryId: reassignTo, updatedAt: new Date() })
							.where(
								and(
									eq(transactions.categoryId, id),
									eq(transactions.userId, userId),
								),
							);
					}
					if (scheduledCount > 0) {
						await tx
							.update(scheduledTransactions)
							.set({ categoryId: reassignTo, updatedAt: new Date() })
							.where(
								and(
									eq(scheduledTransactions.categoryId, id),
									eq(scheduledTransactions.userId, userId),
								),
							);
					}
					if (splitCount > 0) {
						await tx
							.update(transactionSplits)
							.set({ categoryId: reassignTo })
							.where(eq(transactionSplits.categoryId, id));
					}
					if (ruleCount > 0) {
						await tx
							.update(rules)
							.set({ setCategoryId: reassignTo })
							.where(and(eq(rules.setCategoryId, id), eq(rules.userId, userId)));
					}
					await tx
						.delete(categories)
						.where(and(eq(categories.id, id), eq(categories.userId, userId)));
				});
			} catch (err) {
				if (isUniqueViolation(err)) {
					// e.g. reassigning a subcategory onto a parent that already has a
					// same-named child — the transaction rolled back, nothing was changed.
					throw new AppError(
						"conflict",
						"Reassignment target already has a category with that name — rename or merge it first",
					);
				}
				throw err;
			}

			return c.body(null, 204);
		},
	);

export default app;
