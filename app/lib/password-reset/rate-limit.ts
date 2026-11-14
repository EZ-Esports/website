import 'server-only';
import { headers } from 'next/headers';
import { rateLimit } from '@/app/lib/rate-limit';

const RESET_WINDOW_MS = 15 * 60_000;
const RESET_IP_LIMIT = 20;

/**
 * Per-IP throttle for the public reset page and its submit action, using the same
 * in-memory limiter as the login forms (per process, so a best-effort brake only).
 * The real protection is the token itself: 256 random bits that cannot be guessed.
 */
export async function checkResetAttemptAllowed(): Promise<boolean> {
  const list = await headers();
  const ip = list.get('x-forwarded-for')?.split(',')[0]?.trim() || list.get('x-real-ip') || 'unknown';
  return rateLimit(`password-reset:ip:${ip}`, RESET_IP_LIMIT, RESET_WINDOW_MS).allowed;
}
