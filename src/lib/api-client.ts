import { hc } from 'hono/client'
import type { AppType } from '#/server/app'
import { env } from '#/env'

const baseUrl =
  typeof window === 'undefined' ? (env.SERVER_URL ?? 'http://localhost:3000') : ''

export const apiClient = hc<AppType>(baseUrl).api
