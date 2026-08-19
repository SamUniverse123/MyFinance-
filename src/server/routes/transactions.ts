import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AuthEnv } from "../middleware/auth";
import { db } from "#/db";
import { payees, transactions } from "#/db/schema/schemas";
import { and, eq } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema} from 'drizzle-zod';
import z from "zod";
import { AppError } from "#/server/lib/error";

const idParam = z.object({ id: z.uuid() });

/**
 * A client-supplied payeeId must belong to the caller. The wider FK-ownership
 * hardening for account/category is deferred to the transactions security rewrite
 * (transactions.md §3.4); this guards only payeeId, the field payee management
 * newly activates from the entry form.
 */
async function assertPayeeOwned(userId: string, payeeId: string) {
    const [row] = await db
        .select({ id: payees.id })
        .from(payees)
        .where(and(eq(payees.id, payeeId), eq(payees.userId, userId)))
    if (!row) throw new AppError("not_found", "Payee not found", { payeeId })
}

const insertTransactionSchema = createInsertSchema(transactions).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    transferGroupId: true,
    scheduledId: true
})

const updateTransactionSchema = createUpdateSchema(transactions).partial()


const app = new Hono<AuthEnv>()
        //get user's transactions
        .get("/" , async(c)=> {
            const userId = c.get("user").id

            const data = await db.select().from(transactions).where(eq(transactions.userId,userId))

            return c.json({data})
        })
        .post("/", zValidator("json", insertTransactionSchema), async (c) => {
            const userId = c.get("user").id
            const input = c.req.valid("json")

            if (input.payeeId) await assertPayeeOwned(userId, input.payeeId)

            const [row]  = await db
                .insert(transactions)
                .values({
                    ...input,
                    userId,
                })
                .returning()

            return c.json(row, 201)
        })
        .get("/:id",zValidator("param", idParam), async(c)=>{
            const userId = c.get("user").id
            const { id } = c.req.valid("param")

            const [row] = await db.select().from(transactions).where(and(eq(transactions.userId,userId), eq(transactions.id, id )))

             if (!row) {
                throw new AppError('not_found', 'Transaction not found', { transactionId: c.req.param('id')}
                )}
            
             return c.json(row)
        })
        .patch("/:id",zValidator("param", idParam), zValidator("json", updateTransactionSchema), async(c)=>{
            const userId = c.get("user").id
            const {id} = c.req.valid("param")
            const input = c.req.valid("json")

            if (input.payeeId) await assertPayeeOwned(userId, input.payeeId)

            const [row] = await db.update(transactions).set({...input, updatedAt: new Date() }).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).returning()

            if (!row) {
                throw new AppError('not_found', 'Transaction not found', { transactionId: c.req.param('id')}
                )}
            return c.json(row, 201)

        })
        .delete("/:id",zValidator("param", idParam), async(c)=>{
           const userId = c.get("user").id 
           const {id} = c.req.valid("param")
          

         const [row] =  await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).returning()
        
          if (!row) {
                throw new AppError('not_found', 'Transaction not found', { transactionId: c.req.param('id')}
                )}
            return c.body(null, 204);
        })

















export default app