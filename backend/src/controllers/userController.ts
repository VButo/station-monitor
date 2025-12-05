import { Request, Response, CookieOptions } from 'express';
import { UserService } from '../services/userService';

const userService = new UserService();
const COOKIE_NAME = 'supabase-token';
const DEFAULT_COOKIE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const baseCookieOptions = (req: Request): CookieOptions => {
  const configuredSecure = parseBoolean(process.env.COOKIE_SECURE, false);
  const sameSiteRaw = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  let sameSite: 'lax' | 'strict' | 'none' = (['lax', 'strict', 'none'] as const).includes(sameSiteRaw as any)
    ? (sameSiteRaw as 'lax' | 'strict' | 'none')
    : 'lax';

  // Determine request origin/host to tailor cookie security & domain
  const origin = (req.headers.origin as string | undefined) || '';
  let hostname = req.hostname;
  try {
    if (origin) hostname = new URL(origin).hostname;
  } catch {
    // ignore
  }

  const isHttps = origin.startsWith('https://');

  // Compute domain: only apply COOKIE_DOMAIN if it matches current hostname
  const envDomain = process.env.COOKIE_DOMAIN;
  let domain: string | undefined = undefined;
  if (envDomain) {
    const wanted = envDomain.replace(/^\./, '');
    if (hostname === wanted || hostname.endsWith('.' + wanted)) {
      domain = envDomain; // valid scope
    } else {
      // Fall back to host-only cookie to avoid "invalid domain" rejections in dev
      domain = undefined;
    }
  }

  // Secure handling: browsers require Secure when SameSite=None.
  // For local HTTP dev, relax to SameSite=Lax and Secure=false so cookie is accepted.
  let secure = configuredSecure;
  if (sameSite === 'none') {
    if (!isHttps) {
      // Dev over HTTP: downgrade for compatibility
      sameSite = 'lax';
      secure = false;
    } else {
      secure = true;
    }
  }

  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  };

  return options;
};

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const session = await userService.signIn(email, password);

    const accessToken = session.session?.access_token;
    if (!accessToken) {
      return res.status(401).json({ error: 'Login failed, no access token.' });
    }

    const maxAgeMs = Number(process.env.COOKIE_MAX_AGE_MS || DEFAULT_COOKIE_TTL_MS);
    res.cookie(COOKIE_NAME, accessToken, {
      ...baseCookieOptions(req),
      maxAge: maxAgeMs,
    });
    res.status(200).json({ message: 'Logged in' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Unknown error occurred' });
    }
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, baseCookieOptions(req));
  res.status(200).json({ message: 'Logged out' });
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ user: null });

    const user = await userService.getUser(token);
    res.json({ user });
  } catch (error: unknown) {
    if(error instanceof Error){
      res.status(401).json({error: error.message, user: null});
    } else{
      res.status(401).json({ error: 'Unknown error occurred', user: null });
    }
  }
}
