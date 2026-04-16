/**
 * Simple in-memory rate limiter.
 * Creates a rate limiter instance with configurable limit and window.
 * Used across API routes: /api/ask, /api/extract-document, /api/document/attach
 */

interface RateLimiter {
  check(ip: string): { allowed: boolean; retryAfterSeconds?: number };
}

const DEFAULT_WINDOW_MS = 60_000; // 1 minute

/**
 * Create a rate limiter that allows `maxRequests` per `windowMs` per IP.
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number = DEFAULT_WINDOW_MS
): RateLimiter {
  const map = new Map<string, number[]>();

  return {
    check(ip: string) {
      const now = Date.now();
      const timestamps = map.get(ip) ?? [];
      const recent = timestamps.filter((t) => now - t < windowMs);

      if (recent.length >= maxRequests) {
        // Calculate when the oldest relevant timestamp will expire
        const oldestRelevant = recent[0];
        const retryAfterMs = windowMs - (now - oldestRelevant);
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
        return { allowed: false, retryAfterSeconds };
      }

      recent.push(now);
      map.set(ip, recent);
      return { allowed: true };
    },
  };
}
