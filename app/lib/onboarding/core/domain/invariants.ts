import crypto from 'crypto';

// ============================================================================
// HEXAGONAL ARCHITECTURE: DOMAIN INVARIANTS & POLICIES
// ============================================================================

/**
 * Computes deterministic SHA-256 hash for raw invite tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generates a high-entropy random token with its SHA-256 digest.
 */
export function generateCryptoToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/**
 * Validates that an invite is valid for candidate submission.
 */
export function assertValidInviteForSubmission(invite: {
  status: string;
  expiresAt: Date | string | null;
}): void {
  if (invite.status === 'approved') {
    throw new Error('This invitation has already been accepted and processed.');
  }
  if (invite.status === 'rejected') {
    throw new Error('This invitation has been revoked or rejected.');
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new Error('This invitation has expired.');
  }
}
