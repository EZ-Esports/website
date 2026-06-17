import { randomBytes, createHash } from 'crypto';

/**
 * Admin invite tokens. The raw token is a 256-bit random value shown to the
 * inviter exactly once (to build the accept link); only its SHA-256 hash is
 * persisted, so a database leak cannot be turned into a usable invite.
 *
 * Kept out of the `'use server'` action module so it can be imported by the
 * (server-rendered) accept page, which only needs the hashing half.
 */

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
