import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10, // keep well under the Postgres compute tier's connection ceiling
  ssl: { rejectUnauthorized: false },
})

export const db = drizzle(pool, { schema })
