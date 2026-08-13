import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, accountType } from "@/db/schema";
import type { AuthEnv } from "../middleware/auth";
import { AppError } from "#/server/lib/error";

const idParam = z.object({ id: z.uuid()});

const insertSchema = z.object({
	name: z.string().min(1),
	type: z.enum(accountType.enumValues),
	initialBalance: z.number().int().default(0),
	currency: z.string().regex(/^[A-Z]{3}$/),
	color: z.string().nullish(),
	icon: z.string().nullish(),
});

const updateSchema = insertSchema.pick({ name: true, type: true, color: true, icon: true, initialBalance: true})
  .partial()

const app = new Hono<AuthEnv>()
	.get("/", async (c) => {
		const userId = c.get("user").id;
		return c.json(
			await db.select().from(accounts).where(eq(accounts.userId, userId)),
		);
	})
	.post("/", zValidator("json", insertSchema), async (c) => {
		const userId = c.get("user").id;
		const [row] = await db
			.insert(accounts)
			.values({
				...c.req.valid("json"),
				userId,
			})
			.returning();
		return c.json(row, 201);
	})
	.get("/:id", zValidator("param", idParam), async (c) => {
		const userId = c.get("user").id;
		const { id } = c.req.valid("param");
		const [row] = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
		if (!row) {
			throw new AppError('not_found', 'Account not found', { accountId: c.req.param('id')}
				)}

		return c.json(row);
	})
	.patch(
		"/:id",
		zValidator("param", idParam),
		zValidator("json", updateSchema),
		async (c) => {
			const userId = c.get("user").id;
			const { id } = c.req.valid("param");
			const [row] = await db
				.update(accounts)
				.set({ ...c.req.valid("json"), updatedAt: new Date() })
				.where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
				.returning();
			
			if (!row) {
			throw new AppError('not_found', 'Account not found', { accountId: c.req.param('id')}
				)}	
				
			return c.json(row);
		},
	)
	.delete("/:id", zValidator("param", idParam), async (c) => {
		const userId = c.get("user").id;
		const { id } = c.req.valid("param");
		const [row] = await db
			.delete(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
			.returning();
		
		if (!row) {
			throw new AppError('not_found', 'Account not found', { accountId: c.req.param('id')}
				)}
				

		return c.body(null, 204);
	});

export default app;
