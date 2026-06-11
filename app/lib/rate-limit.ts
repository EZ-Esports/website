/**
 * Sliding-window in-memory rate limiter.
 *
 * Limitations: state is per-process. In a stateless/serverless deployment each
 * cold-start resets the counters. For production hardening, replace the Map with
 * an Upstash Redis store (@upstash/ratelimit). The API surface is identical.
 */

const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * @param key        Usually the client IP address.
 * @param limit      Maximum requests allowed within the window.
 * @param windowMs   Rolling window length in milliseconds (default 60 s).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (store.get(key) ?? []).filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0];
    store.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      resetInMs: oldestInWindow + windowMs - now,
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetInMs: 0,
  };
}

/** Extract the best-effort client IP from a Next.js request. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
