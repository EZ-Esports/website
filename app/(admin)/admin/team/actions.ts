'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireSuperAdmin, canActOnRole } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import { isValidEmail, sanitizeDbError } from '@/app/lib/text-utils';
import { ActionError } from '@/app/lib/errors';
import { rateLimit } from '@/app/lib/rate-limit';
import { generateInviteToken, hashInviteToken } from '@/app/lib/invite-token';
import { INVITE_TTL_DAYS } from './constants';

const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
const INVITE_RATE_LIMIT = 10; // invites per inviter per minute
const INVITE_RATE_WINDOW_MS = 60_000;
// app-scoped pg_advisory_xact_lock key; must not collide with other advisory locks
const ADMIN_REVOKE_LOCK_KEY = 8765001;

/**
 * Create a single-use admin invite. Returns the raw token ONCE so the caller can
 * build a shareable accept link — it is never stored or shown again. Because the
 * site has no SMTP, delivery is manual: the inviting admin copies the link and
 * sends it through their own channel.
 */
export async function inviteAdmin(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  token?: string;
  email?: string;
}> {
  const admin = await requireSuperAdmin();

  const rl = rateLimit(`admin-invite:${admin.id}`, INVITE_RATE_LIMIT, INVITE_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return { success: false, error: 'Too many invites. Please slow down and try again shortly.' };
  }

  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase();
  const requestedRole = (formData.get('role') as string) === 'super_admin' ? 'super_admin' : 'admin';

  if (!isValidEmail(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // Only super-admins may mint other super-admins.
  if (!canActOnRole(admin.role, requestedRole)) {
    return { success: false, error: 'Only super-admins can grant the super-admin role.' };
  }

  // Already an admin? Nothing to invite.
  const [existingAdmin] = await db
    .select({ userId: schema.adminUsers.userId })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, email))
    .limit(1);
  if (existingAdmin) {
    return { success: false, error: 'That email already belongs to an admin.' };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    // Supersede any outstanding invite for this email so there is at most one
    // live token per address (re-inviting silently rotates the link). Both
    // writes are in one transaction so concurrent invites for the same email
    // can't both create live rows.
    await db.transaction(async (tx) => {
      const superseded = await tx
        .delete(schema.adminInvites)
        .where(and(eq(schema.adminInvites.email, email), isNull(schema.adminInvites.acceptedAt)))
        .returning({ role: schema.adminInvites.role });

      // A plain admin must not be able to silently overwrite a pending super_admin invite.
      if (superseded.some((r) => !canActOnRole(admin.role, r.role))) {
        throw new ActionError('SUPERSEDE_FORBIDDEN', 'Only super-admins can replace a pending super-admin invite.');
      }

      // Re-check inside the transaction: if the email was accepted and provisioned
      // as an admin between the pre-check above and now, abort to avoid a dangling invite.
      const [nowAdmin] = await tx
        .select({ userId: schema.adminUsers.userId })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, email))
        .limit(1);
      if (nowAdmin) {
        throw new ActionError('ALREADY_ADMIN', 'That email already belongs to an admin.');
      }

      await tx.insert(schema.adminInvites).values({
        email,
        tokenHash,
        role: requestedRole,
        invitedBy: admin.id,
        expiresAt,
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message };
    }
    console.error('Failed to create admin invite', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidatePath('/admin/team');
  return { success: true, token, email };
}

/** Cancel a pending (unaccepted) invite. */
export async function revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireSuperAdmin();

  // Fetch the invite first so we can check role before deleting.
  const [invite] = await db
    .select({ role: schema.adminInvites.role })
    .from(schema.adminInvites)
    .where(eq(schema.adminInvites.id, inviteId))
    .limit(1);

  if (!invite) {
    return { success: false, error: 'Invite not found or already accepted.' };
  }

  if (!canActOnRole(admin.role, invite.role)) {
    return { success: false, error: 'Only super-admins can revoke a super-admin invite.' };
  }

  try {
    const deleted = await db
      .delete(schema.adminInvites)
      .where(and(eq(schema.adminInvites.id, inviteId), isNull(schema.adminInvites.acceptedAt)))
      .returning({ id: schema.adminInvites.id });
    if (deleted.length === 0) {
      return { success: false, error: 'Invite not found or already accepted.' };
    }
  } catch (error) {
    console.error('Failed to revoke admin invite', error);
    return { success: false, error: 'Could not revoke invite. Please try again.' };
  }
  revalidatePath('/admin/team');
  return { success: true };
}

/**
 * Remove an admin: delete the allowlist row and the underlying Supabase Auth
 * user (which also revokes their active sessions, so access is cut immediately).
 * Guards against self-removal, last-admin lockout, and unauthorized super-admin removal.
 */
export async function revokeAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireSuperAdmin();

  if (userId === admin.id) {
    return { success: false, error: 'You cannot remove your own admin access.' };
  }

  // Verify the target IS an admin and fetch their role before acting.
  const [target] = await db
    .select({ role: schema.adminUsers.role })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.userId, userId))
    .limit(1);

  if (!target) {
    return { success: false, error: 'That user is not an admin.' };
  }

  if (!canActOnRole(admin.role, target.role)) {
    return { success: false, error: 'Only super-admins can remove a super-admin.' };
  }

  // Serialize admin-removal via a transaction-scoped advisory lock so two
  // concurrent revokes of different admins can't both see count=2 and both
  // proceed, zeroing the allowlist.
  let deleted: { userId: string }[] = [];
  let wasLastAdmin = false;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_REVOKE_LOCK_KEY})`);
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(schema.adminUsers);
      if (c <= 1) { wasLastAdmin = true; return; }
      deleted = await tx
        .delete(schema.adminUsers)
        .where(eq(schema.adminUsers.userId, userId))
        .returning({ userId: schema.adminUsers.userId });
    });
  } catch (error) {
    console.error('Failed to remove admin row', error);
    return { success: false, error: 'Could not remove admin. Please try again.' };
  }

  if (deleted.length === 0) {
    if (wasLastAdmin) {
      return { success: false, error: 'Cannot remove the last remaining admin.' };
    }
    // Row was already gone (e.g. concurrent revoke) — treat as success; nothing to delete.
    revalidatePath('/admin/team');
    return { success: true };
  }

  // Best-effort: delete the auth account so the session is invalidated. The
  // allowlist row is already gone, so even if this fails the user is locked out.
  try {
    const supabase = createServiceClient();
    await supabase.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error('Removed admin allowlist row but failed to delete auth user', userId, error);
  }

  revalidatePath('/admin/team');
  return { success: true };
}
