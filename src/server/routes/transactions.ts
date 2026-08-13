import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AuthEnv } from "../middleware/auth";
import { db } from "#/db";
import { transactions } from "#/db/schema/schemas";
import { and, eq } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema} from 'drizzle-zod';
import z from "zod";
import { AppError } from "#/server/lib/error";

const idParam = z.object({ id: z.uuid() });

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

            const [row]  = await db
                .insert(transactions)
                .values({
                    ...c.req.valid("json"),
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
            
            const [row] = await db.update(transactions).set({...c.req.valid("json"), updatedAt: new Date() }).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).returning()

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