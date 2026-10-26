import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import {
  DISCORD_RESULT_COOKIE,
  verifyResultCookie,
  type VerifiedDiscord,
} from './discord-verification';

/**
 * Reads the signed Discord verification cookie for this invite token. This is the single
 * server-side source of truth for a student's Discord identity; anything the browser sends
 * in a form or action payload about Discord is ignored.
 */
export async function readVerifiedDiscord(token: string): Promise<VerifiedDiscord | null> {
  if (!token?.trim() || !process.env.DISCORD_CLIENT_SECRET) return null;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const store = await cookies();
  return verifyResultCookie(store.get(DISCORD_RESULT_COOKIE)?.value, tokenHash);
}
