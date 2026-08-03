import { Hono } from "hono";
import { requireAuth } from "./middleware/auth";
import accounts from "./routes/accounts";

const app = new Hono()
	.basePath("/api")
	.use("*", requireAuth)
	.route("/accounts", accounts);

export type AppType = typeof app;
export { app };
