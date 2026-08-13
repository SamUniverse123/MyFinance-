// src/lib/api/client.ts
import { hc } from 'hono/client'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { AppType } from '@/server/app'          // TYPE-ONLY — see the warning below

const fetchImpl = createIsomorphicFn()
  .client((input: RequestInfo | URL, init?: RequestInit) =>
    // same-origin request → send the session cookie so requireAuth can resolve it
    fetch(input, { ...init, credentials: 'include' }),
  )
  .server(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { app } = await import('@/server/app')
    const req = new Request(input, init)
    // forward the browser's cookies so requireAuth can resolve the session
    const cookie = getRequestHeaders().get('cookie')
    if (cookie) req.headers.set('cookie', cookie)
    return app.fetch(req)                            // in-process, no network hop
  })

// The base host is placeholder-only. On the server, fetchImpl dispatches in-process
// via app.fetch and the host is ignored; in the browser it must be the real origin
// or fetch tries to reach a host named "internal" and the request never lands.
const baseUrl = createIsomorphicFn()
  .client(() => window.location.origin)
  .server(() => 'http://internal')

export const api = hc<AppType>(baseUrl(), { fetch: fetchImpl }).api