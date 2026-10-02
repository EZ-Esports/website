import crypto from 'crypto';
import type { CompetitiveRole, SchoolManagerContext } from './types';

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
 * Normalizes competitive roles to database representation.
 * In the database, role is 'captain' or 'player' or null, with isCaptain boolean flag.
 */
export function normalizeCompetitiveRole(role: CompetitiveRole | string): {
  dbRole: string;
  isCaptain: boolean;
} {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'captain') {
    return { dbRole: 'captain', isCaptain: true };
  }
  return { dbRole: normalized || 'player', isCaptain: false };
}

/**
 * Validates that an actor has authorization to manage the specified school & game.
 */
export function assertManagerTenancy(
  context: SchoolManagerContext,
  targetSchoolId: string,
  targetGameId?: string | null
): void {
  if (context.isSuperAdmin) {
    return;
  }
  if (context.schoolId !== targetSchoolId) {
    throw new Error(`Unauthorized: Manager not authorized for school ${targetSchoolId}`);
  }
  if (
    targetGameId &&
    context.managedGames &&
    context.managedGames.length > 0 &&
    !context.managedGames.includes(targetGameId)
  ) {
    throw new Error(`Unauthorized: Manager not authorized for game ${targetGameId}`);
  }
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
