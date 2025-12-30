import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies['supabase-token']
  if (!token) {
    logger.warn('Auth: no token cookie present', {
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin || null,
    })
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    logger.warn('Auth: invalid token or user not found', {
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin || null,
      supabaseError: error || null,
    })
    return res.status(401).json({ error: 'Invalid token' })
  }

  // Attach user to request for downstream handlers
  const reqAny = req as any
  reqAny.user = data.user
  logger.info('Auth: token validated, proceeding', {
    method: req.method,
    path: req.originalUrl,
    userId: data.user.id,
  })
  next()
}
