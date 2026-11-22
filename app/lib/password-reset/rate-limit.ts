import 'server-only';
import { headers } from 'next/headers';
import { isRateLimited, rateLimit } from '@/app/lib/rate-limit';

const RESET_WINDOW_MS = 15 * 60_000;
const RESET_FAILURE_LIMIT = 20;

async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get('x-forwarded-for')?.split(',')[0]?.trim() || list.get('x-real-ip') || 'unknown';
}

/**
 * Per-IP brake on failed submissions only, using the same in-memory limiter as the
 * login forms (per process, so best-effort). Page views and successful resets are
 * not counted, so a school behind one NAT cannot lock out its own managers by
 * opening links. The real protection is the token: 256 random bits cannot be guessed.
 */
export async function isResetBlocked(): Promise<boolean> {
  return isRateLimited(`password-reset:fail:${await clientIp()}`, RESET_FAILURE_LIMIT, RESET_WINDOW_MS);
}

export async function recordFailedResetAttempt(): Promise<void> {
  rateLimit(`password-reset:fail:${await clientIp()}`, RESET_FAILURE_LIMIT, RESET_WINDOW_MS);
}
