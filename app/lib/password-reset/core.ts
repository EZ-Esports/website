import { generateInviteToken, hashInviteToken } from '@/app/lib/invite-token';
import { canActOnMember, hasPermission, Permissions } from '@/app/lib/roles';
import { RESET_PASSWORD_MIN_LENGTH } from './constants';

/**
 * Staff-issued one-time password reset links.
 *
 * There is no outbound email, so a staff member hands the link to the account
 * holder (over a Discord ticket). The link is a bearer token whose only power is
 * setting a new password for its one target user; it never creates a session.
 * Everything here is free of database and Supabase imports: the service takes
 * its storage and auth backends as ports so the rules can be tested in memory.
 */

export const RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000;
export { RESET_PASSWORD_MIN_LENGTH };
/** How many recent links the admin UI lists per account. */
export const RESET_LINK_HISTORY_LIMIT = 10;

/**
 * The single message for a token that is unknown, expired, used, revoked or whose
 * account is no longer eligible. One text for all of them so a visitor cannot
 * learn which tokens exist.
 */
export const INVALID_RESET_LINK_MESSAGE =
  'This password reset link is invalid or has expired. Ask League staff for a new one.';

export type ResetTargetKind = 'manager' | 'staff';
export type ResetLinkStatus = 'outstanding' | 'used' | 'expired' | 'revoked';

export function isResetTargetKind(value: unknown): value is ResetTargetKind {
  return value === 'manager' || value === 'staff';
}

/** 256-bit random token; only its SHA-256 hash is ever stored. */
export function generateResetToken(): string {
  return generateInviteToken();
}

export function hashResetToken(token: string): string {
  return hashInviteToken(token);
}

export function loginPathForKind(kind: ResetTargetKind): string {
  return kind === 'manager' ? '/portal/login' : '/login';
}

export interface ResetLinkRow {
  id: string;
  userId: string;
  targetKind: ResetTargetKind;
  issuedByUserId: string;
  issuedByEmail: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
}

export function resetLinkStatus(
  row: Pick<ResetLinkRow, 'usedAt' | 'revokedAt' | 'expiresAt'>,
  now: Date,
): ResetLinkStatus {
  if (row.usedAt) return 'used';
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'outstanding';
}

export interface ResetActor {
  id: string;
  permissions: bigint;
  isOwner: boolean;
  highestRolePosition: number;
}

export interface ResetTarget {
  userId: string;
  kind: ResetTargetKind;
  /** Active school manager (kind manager) or current staff member (kind staff). */
  active: boolean;
  /** Has a staff_members row, whatever the requested kind. */
  isStaff: boolean;
  isOwner: boolean;
  highestRolePosition: number;
}

export function permissionForKind(kind: ResetTargetKind): bigint {
  // Same gates as creating a manager invite (MANAGE_SCHOOLS) and inviting or editing staff (MANAGE_ROLES).
  return kind === 'manager' ? Permissions.MANAGE_SCHOOLS : Permissions.MANAGE_ROLES;
}

export type Authorization = { ok: true } | { ok: false; error: string };

/** Whether the actor holds the permission that governs resets for this kind of account. */
export function checkKindPermission(actor: ResetActor, kind: ResetTargetKind): Authorization {
  if (!hasPermission(actor.permissions, actor.isOwner, permissionForKind(kind))) {
    return { ok: false, error: 'You do not have permission to manage password resets for this account type.' };
  }
  return { ok: true };
}

/**
 * Permission plus anti-escalation. Whenever the target holds a staff identity,
 * whatever kind of link is requested, the same hierarchy rule as revokeStaff and
 * updateUserRoles applies: the actor must be an Owner or hold a strictly higher
 * role than the target, and an Owner account is only resettable by an Owner.
 * Otherwise a MANAGE_SCHOOLS user could take over a staff account that also has
 * a manager row. Staff may never issue a link for themselves.
 */
export function checkIssueAuthorization(actor: ResetActor, target: ResetTarget): Authorization {
  const permission = checkKindPermission(actor, target.kind);
  if (!permission.ok) return permission;
  if (target.userId === actor.id) {
    return { ok: false, error: 'You cannot issue a password reset link for your own account.' };
  }
  if (!target.active) {
    return {
      ok: false,
      error:
        target.kind === 'manager'
          ? 'That user is not an active school manager.'
          : 'That user is not a current staff member.',
    };
  }
  if (
    target.isStaff &&
    !canActOnMember(actor.highestRolePosition, actor.isOwner, target.highestRolePosition, target.isOwner)
  ) {
    return { ok: false, error: 'You do not have permission to reset this account due to role hierarchy.' };
  }
  return { ok: true };
}

export interface ResetStore {
  getTarget(userId: string, kind: ResetTargetKind): Promise<ResetTarget | null>;
  /** Atomically revoke every outstanding link of the user and insert the new one. */
  replaceOutstanding(input: {
    userId: string;
    kind: ResetTargetKind;
    tokenHash: string;
    issuedByUserId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ id: string }>;
  findByHash(tokenHash: string): Promise<ResetLinkRow | null>;
  getById(id: string): Promise<ResetLinkRow | null>;
  /** Atomic single-use claim: sets used_at only if still unused, unrevoked and unexpired. */
  claim(id: string, now: Date): Promise<boolean>;
  /** Undo a claim whose password update failed so the link can be retried. */
  release(id: string): Promise<void>;
  /** Revoke one outstanding link; false when it was no longer outstanding. */
  revoke(id: string, revokedBy: string, now: Date): Promise<boolean>;
  listForUser(userId: string, limit: number): Promise<ResetLinkRow[]>;
}

export interface ResetAuthAdmin {
  setPassword(userId: string, password: string): Promise<void>;
  /** Global sign-out: end every session and refresh token of the user. */
  revokeAllSessions(userId: string): Promise<void>;
}

export interface ResetServiceDeps {
  store: ResetStore;
  auth: ResetAuthAdmin;
  now?: () => Date;
  generateToken?: () => string;
  onSessionRevocationFailed?: (userId: string, error: unknown) => void;
  /**
   * Account kinds this deployment may issue, list and revoke links for. Staff resets are
   * deliberately switched off for now (spec-064); the table and checks still support them.
   */
  enabledKinds?: readonly ResetTargetKind[];
}

export interface IssuedLinkView {
  id: string;
  targetKind: ResetTargetKind;
  status: ResetLinkStatus;
  issuedByEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export type IssueResult =
  | { success: true; token: string; linkId: string; expiresAt: Date }
  | { success: false; error: string };

export type RedeemResult =
  | { ok: true; kind: ResetTargetKind }
  | { ok: false; error: string; retryable: boolean };

export function createPasswordResetService(deps: ResetServiceDeps) {
  const { store, auth } = deps;
  const clock = deps.now ?? (() => new Date());
  const newToken = deps.generateToken ?? generateResetToken;
  const enabled = (kind: ResetTargetKind) => (deps.enabledKinds ?? ['manager', 'staff']).includes(kind);
  const DISABLED = 'Password reset links are not available for this account type.';

  function toView(row: ResetLinkRow, now: Date): IssuedLinkView {
    return {
      id: row.id,
      targetKind: row.targetKind,
      status: resetLinkStatus(row, now),
      issuedByEmail: row.issuedByEmail,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  return {
    /** Issue a link; any outstanding link for the same user is revoked in the same transaction. */
    async issue(actor: ResetActor, params: { userId: string; kind: ResetTargetKind }): Promise<IssueResult> {
      if (!enabled(params.kind)) return { success: false, error: DISABLED };
      const permission = checkKindPermission(actor, params.kind);
      if (!permission.ok) return { success: false, error: permission.error };
      const target = await store.getTarget(params.userId, params.kind);
      if (!target) return { success: false, error: 'Account not found.' };
      const verdict = checkIssueAuthorization(actor, target);
      if (!verdict.ok) return { success: false, error: verdict.error };

      const now = clock();
      const token = newToken();
      const expiresAt = new Date(now.getTime() + RESET_LINK_TTL_MS);
      const { id } = await store.replaceOutstanding({
        userId: target.userId,
        kind: target.kind,
        tokenHash: hashResetToken(token),
        issuedByUserId: actor.id,
        expiresAt,
        now,
      });
      return { success: true, token, linkId: id, expiresAt };
    },

    async revoke(actor: ResetActor, linkId: string): Promise<{ success: boolean; error?: string }> {
      const link = await store.getById(linkId);
      if (!link || !enabled(link.targetKind)) return { success: false, error: 'Link not found.' };
      const permission = checkKindPermission(actor, link.targetKind);
      if (!permission.ok) return { success: false, error: permission.error };
      // Same hierarchy rule as issuing, but a dead account no longer blocks revoking its link.
      const target = await store.getTarget(link.userId, link.targetKind);
      if (
        target?.isStaff &&
        link.userId !== actor.id &&
        !canActOnMember(actor.highestRolePosition, actor.isOwner, target.highestRolePosition, target.isOwner)
      ) {
        return { success: false, error: 'You do not have permission to reset this account due to role hierarchy.' };
      }
      const revoked = await store.revoke(linkId, actor.id, clock());
      if (!revoked) return { success: false, error: 'That link is no longer outstanding.' };
      return { success: true };
    },

    /**
     * Recent links for one account. Empty (not an error) unless the actor could also issue
     * for it: same permission, a live account and the same hierarchy rule, so history is
     * never exposed for accounts the caller may not act on. Viewing your own is allowed.
     */
    async list(
      actor: ResetActor,
      params: { userId: string; kind: ResetTargetKind },
    ): Promise<IssuedLinkView[]> {
      if (!enabled(params.kind) || !checkKindPermission(actor, params.kind).ok) return [];
      const target = await store.getTarget(params.userId, params.kind);
      if (!target?.active) return [];
      if (
        target.isStaff &&
        target.userId !== actor.id &&
        !canActOnMember(actor.highestRolePosition, actor.isOwner, target.highestRolePosition, target.isOwner)
      ) {
        return [];
      }
      const now = clock();
      const rows = await store.listForUser(params.userId, RESET_LINK_HISTORY_LIMIT);
      return rows.filter((r) => r.targetKind === params.kind).map((r) => toView(r, now));
    },

    /** Read-only check used to decide whether the public page shows the form. */
    async peek(token: string): Promise<boolean> {
      if (!token) return false;
      const row = await store.findByHash(hashResetToken(token));
      if (!row || resetLinkStatus(row, clock()) !== 'outstanding') return false;
      const target = await store.getTarget(row.userId, row.targetKind);
      return Boolean(target?.active);
    },

    /**
     * Set the new password. The link is claimed atomically first so two
     * concurrent submissions cannot both succeed, but the old password is only
     * replaced afterwards, and a failed update releases the claim: the old
     * password stays valid and the link stays usable until the change succeeds.
     */
    async redeem(token: string, password: string): Promise<RedeemResult> {
      const invalid: RedeemResult = { ok: false, error: INVALID_RESET_LINK_MESSAGE, retryable: false };
      if (!token) return invalid;
      const now = clock();
      const row = await store.findByHash(hashResetToken(token));
      if (!row || resetLinkStatus(row, now) !== 'outstanding') return invalid;
      const target = await store.getTarget(row.userId, row.targetKind);
      if (!target?.active) return invalid;

      if (password.length < RESET_PASSWORD_MIN_LENGTH) {
        return {
          ok: false,
          error: `Password must be at least ${RESET_PASSWORD_MIN_LENGTH} characters.`,
          retryable: true,
        };
      }

      if (!(await store.claim(row.id, now))) return invalid;

      try {
        await auth.setPassword(row.userId, password);
      } catch {
        // Best effort: if releasing fails the link stays spent and staff issue a new one.
        await store.release(row.id).catch(() => undefined);
        return {
          ok: false,
          error: 'Could not update your password. Try a different password or try again shortly.',
          retryable: true,
        };
      }

      try {
        await auth.revokeAllSessions(row.userId);
      } catch (error) {
        // The password is already changed and the link spent; failing now would strand the user.
        deps.onSessionRevocationFailed?.(row.userId, error);
      }
      return { ok: true, kind: row.targetKind };
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
