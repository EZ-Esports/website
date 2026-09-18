import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Cross-instance rate limiter for the public apply / staff-apply endpoints,
 * backed by Upstash Redis so the count survives serverless cold starts and
 * is shared across concurrent instances — unlike the in-memory `rateLimit()`
 * in `./rate-limit.ts`, which stays in place for the admin login path (see
 * issue #112) and is intentionally NOT switched to this store.
 *
 * Fail-open, by design: if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
 * are unset, or a call to Redis errors or times out, the request is allowed
 * through rather than blocked. This limiter only guards a public application
 * form, not an authenticated or high-value action — turning a Redis outage
 * into an outage of the apply flow for every legitimate applicant is worse
 * than a temporary gap in spam protection during that outage.
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// One Ratelimit instance per (limit, window) shape, created lazily and
// reused across calls. Apply and staff-apply currently share the same 5-per-
// 10-minutes shape, but this keeps distinct shapes from colliding.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;

  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: 'ratelimit:apply',
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export interface RedisRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * @param key      Usually the client IP address (see `getClientIp` in `./rate-limit.ts`).
 * @param limit    Maximum requests allowed within the window.
 * @param windowMs Rolling window length in milliseconds.
 */
export async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RedisRateLimitResult> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) {
    // Not configured — fail open (see module comment above).
    return { allowed: true, remaining: limit, resetInMs: 0 };
  }

  try {
    const { success, remaining, reset } = await limiter.limit(key);
    return {
      allowed: success,
      remaining,
      resetInMs: Math.max(0, reset - Date.now()),
    };
  } catch (error) {
    // Redis unreachable or erroring — fail open (see module comment above).
    console.error('Redis rate limit check failed; allowing request through:', error);
    return { allowed: true, remaining: limit, resetInMs: 0 };
  }
}
