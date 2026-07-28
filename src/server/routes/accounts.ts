import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { accounts } from '#/db/schema'

const idParam = z.object({ id: z.string().uuid() })

const insertSchema = z.object({
  name: z.string().min(1),
  balance: z.number().int().default(0),
  currency: z.string().length(3).default('USD'),
})

const updateSchema = insertSchema.partial()

const app = new Hono()
  .get('/', async (c) => {
    return c.json(await db.select().from(accounts))
  })
  .post('/', zValidator('json', insertSchema), async (c) => {
    const [row] = await db
      .insert(accounts)
      .values({
        ...c.req.valid('json'),
        // TODO: derive from the authenticated session (see #/lib/auth) once
        // accounts are wired up to a signed-in user.
        userId: '',
      })
      .returning()
    return c.json(row, 201)
  })
  .get('/:id', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id))
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  })
  .patch(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', updateSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const [row] = await db
        .update(accounts)
        .set({ ...c.req.valid('json'), updatedAt: new Date() })
        .where(eq(accounts.id, id))
        .returning()
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json(row)
    },
  )
  .delete('/:id', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const [row] = await db
      .delete(accounts)
      .where(eq(accounts.id, id))
      .returning()
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.body(null, 204)
  })

export default app
