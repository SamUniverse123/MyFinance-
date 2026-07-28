import { Hono } from 'hono'
import accounts from './routes/accounts'

const app = new Hono().basePath('/api').route('/accounts', accounts)

export type AppType = typeof app
export { app }
