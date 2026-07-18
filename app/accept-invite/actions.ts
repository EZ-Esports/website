'use server';

import { redirect } from 'next/navigation';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import { hashInviteToken } from '@/app/lib/invite-token';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { ActionError } from '@/app/lib/errors';
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

  const supabase = createServiceClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: invite.email,
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
        email: invite.email,
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
