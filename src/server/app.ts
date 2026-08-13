import { Hono } from "hono";
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from "./middleware/auth";
import accounts from "./routes/accounts";
import transactions from "./routes/transactions"
import { AppError } from "#/server/lib/error";
import { ZodError } from "zod";

const app = new Hono()
	.basePath("/api")
	.use("*", requireAuth)
	.route("/accounts", accounts)
	.route("/transactions", transactions);



//---------------------------Error handling----------------------------------------//	
	app.onError((err, c) => {
  // 1. Your domain errors — the shape you actually designed
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.detail && { detail: err.detail }),
        },
      },
      err.status,
    )
  }

  if (err instanceof ZodError) {
  return c.json(
    { error: { code: 'invalid', message: 'Validation failed', detail: { issues: err.issues } } },
    422,
  )
}

  // 2. Hono / Better Auth internals (body-parse failures, thrown HTTPExceptions)
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'internal', message: err.message } },
      err.status,
    )
  }

  // 3. Everything unexpected — log the real thing, leak nothing
  console.error(err)
  return c.json(
    { error: { code: 'internal', message: 'Internal server error' } },
    500,
  )
})

// Unmatched routes also go through your shape, not Hono's default "404 Not Found" text
app.notFound((c) =>
  c.json({ error: { code: 'not_found', message: 'Not found' } }, 404),
)


export type AppType = typeof app;
export { app };
