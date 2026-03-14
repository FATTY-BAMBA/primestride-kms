/**
 * Simple in-memory rate limiter for AI endpoints.
 * Works per Vercel function instance — not distributed,
 * but sufficient to prevent casual abuse on a per-user basis.
 * 
 * For production scale, replace with Upstash Redis rate limiting.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 60 * 60 * 1000) { // older than 1 hour
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check if a key (userId + endpoint) is within rate limits.
 * Call this at the top of any expensive API route.
 * 
 * Usage:
 *   const rl = rateLimit(`chat:${userId}`, { limit: 30, windowSeconds: 60 });
 *   if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowSeconds } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }

  if (entry.count >= limit) {
    const resetInSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  entry.count += 1;
  const remaining = limit - entry.count;
  const resetInSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
  return { allowed: true, remaining, resetInSeconds };
}