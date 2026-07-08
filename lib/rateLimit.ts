/**
 * In-memory sliding-window rate limiter.
 * Works for single Docker instance deployments (no Redis needed).
 *
 * Usage:
 *   const limited = rateLimit(`orders:${email}`, 30, 60_000);
 *   if (limited) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 5 * 60_000) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

/**
 * Returns true if the request should be rate-limited (blocked).
 *
 * @param key       Unique identifier, e.g. `orders:user@email.com`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;

  if (entry.count > limit) {
    return true; // blocked
  }

  return false;
}
