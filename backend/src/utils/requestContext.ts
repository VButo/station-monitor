import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction } from 'express'

export interface RequestContextData {
  requestId?: string
  routeKey?: string
}

export const requestContext = new AsyncLocalStorage<RequestContextData>()

function deriveRouteKey(pathname: string): string {
  // Try to extract segment after /api/
  const match = pathname.match(/\/api\/([A-Za-z0-9._-]+)/)
  if (match && match[1]) return match[1].toLowerCase()
  // Fallback: first segment
  const seg = pathname.replace(/^\/+/, '').split('/')[0]
  return (seg || 'app').toLowerCase()
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (res.locals?.requestId as string | undefined) || undefined
  const routeKey = deriveRouteKey(req.originalUrl || req.url || '')
  const store: RequestContextData = { requestId, routeKey }
  requestContext.run(store, next)
}
