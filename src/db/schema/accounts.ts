import { pgTable, uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core'

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // add .references() once you have the `user` table here too
  name: text('name').notNull(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
