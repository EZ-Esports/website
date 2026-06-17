'use server';

import { redirect } from 'next/navigation';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import { hashInviteToken } from '@/app/lib/invite-token';
import { sanitizeDbError } from '@/app/lib/text-utils';

const MIN_PASSWORD_LENGTH = 8;

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
      id: schema.adminInvites.id,
      email: schema.adminInvites.email,
      role: schema.adminInvites.role,
      invitedBy: schema.adminInvites.invitedBy,
      expiresAt: schema.adminInvites.expiresAt,
    })
    .from(schema.adminInvites)
    .where(
      and(
        eq(schema.adminInvites.tokenHash, tokenHash),
        isNull(schema.adminInvites.acceptedAt),
        gt(schema.adminInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ?? null;
}

/**
 * Consume an invite: create the Supabase Auth account, add the allowlist row,
 * and mark the invite accepted. Signups are disabled project-wide, so the
 * account is created with the service role here — this endpoint is the only
 * sanctioned path to a new admin account.
 */
export async function acceptInvite(formData: FormData): Promise<{ error: string }> {
  const token = (formData.get('token') as string) ?? '';
  const password = (formData.get('password') as string) ?? '';

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const invite = await findValidInvite(token);
  if (!invite) {
    return { error: 'This invite link is invalid or has expired. Ask an admin for a new one.' };
  }

  const supabase = createServiceClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.error('Failed to create admin auth user', createError);
    // Most common cause: an account already exists for this email.
    return { error: 'Could not create your account. An account may already exist for this email — contact an admin.' };
  }

  try {
    // Both writes happen in one transaction so partial failure can't orphan an
    // admin_users row or wedge the invite. The UPDATE uses AND accepted_at IS NULL
    // to atomically claim the invite — if another request already consumed it the
    // returning array will be empty and we abort.
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(schema.adminInvites)
        .set({ acceptedAt: sql`now()` })
        .where(
          and(
            eq(schema.adminInvites.id, invite.id),
            isNull(schema.adminInvites.acceptedAt),
            gt(schema.adminInvites.expiresAt, sql`now()`),
          ),
        )
        .returning({ id: schema.adminInvites.id });

      if (claimed.length === 0) {
        throw new Error('INVITE_UNAVAILABLE');
      }

      await tx.insert(schema.adminUsers).values({
        userId: created.user.id,
        email: invite.email,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });
    });
  } catch (error) {
    console.error('Failed to finalize admin invite; rolling back auth user', error);
    // Undo the auth account so the invite can be retried cleanly.
    await supabase.auth.admin
      .deleteUser(created.user.id)
      .catch((e) => console.error('ORPHANED AUTH USER — manual cleanup required:', created.user.id, e));
    if ((error as Error).message === 'INVITE_UNAVAILABLE') {
      return { error: 'This invite link has already been used or has expired. Ask an admin for a new one.' };
    }
    return { error: sanitizeDbError(error) };
  }

  redirect('/login?message=account-created');
}
