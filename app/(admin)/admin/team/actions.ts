'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { countAdminUsers } from '@/app/lib/db/queries';
import { createServiceClient } from '@/app/lib/supabase/service';
import { isValidEmail, sanitizeDbError } from '@/app/lib/text-utils';
import { rateLimit } from '@/app/lib/rate-limit';
import { generateInviteToken, hashInviteToken } from '@/app/lib/invite-token';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const INVITE_RATE_LIMIT = 10; // invites per inviter per minute
const INVITE_RATE_WINDOW_MS = 60_000;

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
  const admin = await requireAdmin();

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
  if (requestedRole === 'super_admin' && admin.role !== 'super_admin') {
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
    // live token per address (re-inviting silently rotates the link).
    await db
      .delete(schema.adminInvites)
      .where(and(eq(schema.adminInvites.email, email), isNull(schema.adminInvites.acceptedAt)));

    await db.insert(schema.adminInvites).values({
      email,
      tokenHash,
      role: requestedRole,
      invitedBy: admin.id,
      expiresAt,
    });
  } catch (error) {
    console.error('Failed to create admin invite', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidatePath('/admin/team');
  return { success: true, token, email };
}

/** Cancel a pending (unaccepted) invite. */
export async function revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await db.delete(schema.adminInvites).where(eq(schema.adminInvites.id, inviteId));
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
 * Guards against self-removal and last-admin lockout.
 */
export async function revokeAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return { success: false, error: 'You cannot remove your own admin access.' };
  }

  const total = await countAdminUsers();
  if (total <= 1) {
    return { success: false, error: 'Cannot remove the last remaining admin.' };
  }

  try {
    await db.delete(schema.adminUsers).where(eq(schema.adminUsers.userId, userId));
  } catch (error) {
    console.error('Failed to remove admin row', error);
    return { success: false, error: 'Could not remove admin. Please try again.' };
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
