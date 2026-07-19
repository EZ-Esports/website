'use server';

import { redirect } from 'next/navigation';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import { hashInviteToken } from '@/app/lib/invite-token';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { ActionError } from '@/app/lib/errors';
import { STAFF_REVOCATION_LOCK_KEY } from '@/app/lib/staff-revocation';
import { MIN_PASSWORD_LENGTH } from './constants';

/**
 * Look up a live (unaccepted, unexpired) invite by its raw token. Returns the
 * row or null. Shared by the accept page (to render the form) and the accept
 * action (to re-validate before consuming).
 */
export async function findValidInvite(token: string) {
  if (!token) return null;
  const tokenHash = hashInviteToken(token);
  // Project only the columns callers need — never return tokenHash from this
  // 'use server' endpoint (least privilege; the hash has no use to a client).
  const [invite] = await db
    .select({
      id: schema.staffInvites.id,
      email: schema.staffInvites.email,
      invitedBy: schema.staffInvites.invitedBy,
      expiresAt: schema.staffInvites.expiresAt,
    })
    .from(schema.staffInvites)
    .where(
      and(
        eq(schema.staffInvites.tokenHash, tokenHash),
        isNull(schema.staffInvites.acceptedAt),
        gt(schema.staffInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ?? null;
}

/**
 * Consume an invite: create the Supabase Auth account, add staff membership,
 * and mark the invite accepted. Signups are disabled project-wide, so the
 * account is created with the service role here — this endpoint is the only
 * sanctioned path to a new staff account. Initial roles are optional.
 */
export async function acceptInvite(formData: FormData): Promise<{ error: string }> {
  const token = (formData.get('token') as string) ?? '';
  const password = (formData.get('password') as string) ?? '';

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const invite = await findValidInvite(token);
  if (!invite) {
    return { error: 'This invite link is invalid or has expired. Ask a staff manager for a new one.' };
  }
  const inviteEmail = invite.email.trim().toLowerCase();

  const supabase = createServiceClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: inviteEmail,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.error('Failed to create staff auth user', createError);
    // Most common cause: an account already exists for this email.
    return { error: 'Could not create your account. An account may already exist for this email — contact a staff manager.' };
  }

  try {
    // Both writes happen in one transaction so partial failure can't orphan an
    // staff_members row or wedge the invite. The UPDATE uses AND accepted_at IS NULL
    // to atomically claim the invite — if another request already consumed it the
    // returning array will be empty and we abort.
    await db.transaction(async (tx) => {
      // Serialize invite acceptance with revocation and restoration. A
      // tombstoned email must never regain membership through an invite that
      // was issued (or remained live) before access was revoked.
      await tx.execute(sql`select pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})`);

      const [revokedIdentity] = await tx
        .select({ userId: schema.staffRevocations.userId })
        .from(schema.staffRevocations)
        .where(
          or(
            eq(schema.staffRevocations.userId, created.user.id),
            sql`lower(${schema.staffRevocations.email}) = ${inviteEmail}`,
          ),
        )
        .limit(1);

      if (revokedIdentity) {
        throw new ActionError(
          'STAFF_REVOKED',
          'This staff identity has been revoked. Ask an Owner to restore it before accepting an invite.',
        );
      }

      const claimed = await tx
        .update(schema.staffInvites)
        .set({ acceptedAt: sql`now()` })
        .where(
          and(
            eq(schema.staffInvites.id, invite.id),
            isNull(schema.staffInvites.acceptedAt),
            gt(schema.staffInvites.expiresAt, sql`now()`),
          ),
        )
        .returning({ id: schema.staffInvites.id });

      if (claimed.length === 0) {
        throw new ActionError('INVITE_UNAVAILABLE', 'This invite link has already been used or has expired. Ask a staff manager for a new one.');
      }

      const inviteRoles = await tx
        .select({ roleId: schema.staffInviteRoles.roleId })
        .from(schema.staffInviteRoles)
        .where(eq(schema.staffInviteRoles.inviteId, invite.id));

      await tx.insert(schema.staffMembers).values({
        userId: created.user.id,
        email: inviteEmail,
        invitedBy: invite.invitedBy,
      });

      if (inviteRoles.length > 0) {
        await tx.insert(schema.userRoles).values(
          inviteRoles.map((ir) => ({
            userId: created.user.id,
            roleId: ir.roleId,
          }))
        );
      }
    });
  } catch (error) {
    console.error('Failed to finalize staff invite; rolling back auth user', error);
    // Undo the auth account so the invite can be retried cleanly.
    await supabase.auth.admin
      .deleteUser(created.user.id)
      .catch((e) => console.error('ORPHANED AUTH USER — manual cleanup required:', created.user.id, e));
    if (error instanceof ActionError) {
      return { error: error.message };
    }
    return { error: sanitizeDbError(error) };
  }

  redirect('/login?message=account-created');
}
