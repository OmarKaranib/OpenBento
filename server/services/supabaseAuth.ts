// Supabase Bearer-token middleware shared by /api/dashboard and /api/cast/*.
// Verifies access tokens via Supabase /auth/v1/user with a 5-minute LRU cache.
import type { Request, Response, NextFunction } from "express";
import { LruTtlCache } from "./lruCache";

const supabaseUserCache = new LruTtlCache<{ id: string; email: string }>({
  max: 500,
  ttlMs: 5 * 60 * 1000,
});

export async function attachSupabaseUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();
  const token = match[1].trim();
  if (!token) return next();

  const cached = supabaseUserCache.get(token);
  if (cached) {
    (req as any).userId = cached.id;
    (req as any).user = { id: cached.id, email: cached.email };
    return next();
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey) return next();

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const user = await r.json();
      if (user?.id) {
        supabaseUserCache.set(token, { id: user.id, email: user.email });
        (req as any).userId = user.id;
        (req as any).user = { id: user.id, email: user.email };
      }
    }
  } catch {
    /* leave userId unset */
  }
  next();
}

export function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || null;
}
