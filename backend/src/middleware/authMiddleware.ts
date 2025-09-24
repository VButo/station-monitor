import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies['supabase-token']
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' })

  // Attach user to request for downstream handlers
  ;(req as any).user = data.user
  next()
}
