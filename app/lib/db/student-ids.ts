import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import type { InviteKind, OnboardingTx } from './onboarding';

/**
 * Persistence for `student_id_uploads` (spec-056). Object removal happens outside these functions and
 * only after the database change has committed (see `sweepOrphanStudentIds`), so a rollback can never
 * leave a row pointing at a deleted object.
 *
 * Nothing here is cached and nothing returns a URL. The keys never leave the server.
 */

type DbOrTx = typeof db | OnboardingTx;

export interface StudentIdUploadRow {
  id: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}

const uploadColumns = {
  id: schema.studentIdUploads.id,
  storageKey: schema.studentIdUploads.storageKey,
  contentType: schema.studentIdUploads.contentType,
  sizeBytes: schema.studentIdUploads.sizeBytes,
};

/** The invite's upload that has not been attached to a member yet, if any. */
export async function findPendingUpload(
  kind: InviteKind,
  inviteId: string,
  tx: DbOrTx = db
): Promise<StudentIdUploadRow | null> {
  const [row] = await tx
    .select(uploadColumns)
    .from(schema.studentIdUploads)
    .where(
      and(
        eq(schema.studentIdUploads.inviteKind, kind),
        eq(schema.studentIdUploads.inviteId, inviteId),
        isNull(schema.studentIdUploads.memberId)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Records a fresh upload for an invite, replacing any earlier pending one. Returns the replaced
 * object's key (to delete from Storage) or null. One transaction, so two racing uploads for the same
 * invite leave exactly one row and the loser's object is reported for deletion.
 */
export async function replacePendingUpload(
  kind: InviteKind,
  inviteId: string,
  upload: { storageKey: string; contentType: string; sizeBytes: number }
): Promise<{ replacedKey: string | null }> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(schema.studentIdUploads)
      .where(
        and(
          eq(schema.studentIdUploads.inviteKind, kind),
          eq(schema.studentIdUploads.inviteId, inviteId),
          isNull(schema.studentIdUploads.memberId)
        )
      )
      .returning({ storageKey: schema.studentIdUploads.storageKey });
    await tx.insert(schema.studentIdUploads).values({ inviteKind: kind, inviteId, ...upload });
    return { replacedKey: removed[0]?.storageKey ?? null };
  });
}

/** Removes one just-created row (rollback of an upload whose follow-up step failed). */
export async function deleteUploadRowByKey(storageKey: string): Promise<void> {
  await db.delete(schema.studentIdUploads).where(eq(schema.studentIdUploads.storageKey, storageKey));
}

/**
 * Attaches the invite's pending upload to the member inside the submission transaction. A member can
 * hold one ID photo, so an older one (from an earlier invite of the same person) is replaced and its
 * key returned for deletion. Returns null when the invite has no pending upload.
 */
export async function linkUploadToMember(
  tx: OnboardingTx,
  kind: InviteKind,
  inviteId: string,
  memberId: string
): Promise<{ linkedKey: string; replacedKey: string | null } | null> {
  const pending = await findPendingUpload(kind, inviteId, tx);
  if (!pending) return null;
  const replaced = await tx
    .delete(schema.studentIdUploads)
    .where(eq(schema.studentIdUploads.memberId, memberId))
    .returning({ storageKey: schema.studentIdUploads.storageKey });
  const updated = await tx
    .update(schema.studentIdUploads)
    .set({ memberId })
    .where(and(eq(schema.studentIdUploads.id, pending.id), isNull(schema.studentIdUploads.memberId)))
    .returning({ id: schema.studentIdUploads.id });
  if (updated.length !== 1) return null;
  return { linkedKey: pending.storageKey, replacedKey: replaced[0]?.storageKey ?? null };
}

/** The stored key for a member's ID photo. Used only by the staff signed-URL route. */
export async function findStudentIdKeyForMember(memberId: string): Promise<string | null> {
  const [row] = await db
    .select({ storageKey: schema.studentIdUploads.storageKey })
    .from(schema.studentIdUploads)
    .where(eq(schema.studentIdUploads.memberId, memberId))
    .limit(1);
  return row?.storageKey ?? null;
}

/** Which of these members have an ID photo on file. Booleans only, never keys. */
export async function listMembersWithStudentId(memberIds: string[]): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  try {
    const rows = await db
      .select({ memberId: schema.studentIdUploads.memberId })
      .from(schema.studentIdUploads)
      .where(inArray(schema.studentIdUploads.memberId, memberIds));
    return new Set(rows.map((r) => r.memberId).filter((id): id is string => Boolean(id)));
  } catch (err) {
    // Migration 0058 not applied yet: the staff views render without the ID link.
    if ((err as { code?: string })?.code === '42P01') return new Set();
    throw err;
  }
}

/**
 * Orphaned uploads: rows whose member is gone (member_id set null by the FK) or that were never
 * attached and whose invite is no longer pending (deleted, revoked, expired, rejected).
 */
export async function findOrphanUploads(tx: DbOrTx = db): Promise<Array<{ id: string; storageKey: string }>> {
  const rows = await tx.execute(sql`
    select u.id, u.storage_key as "storageKey"
    from student_id_uploads u
    where u.member_id is null
      and not exists (
        select 1 from player_invites i
        where u.invite_kind = 'player' and i.id = u.invite_id
          and i.status = 'pending' and (i.expires_at is null or i.expires_at > now())
      )
      and not exists (
        select 1 from manager_invites i
        where u.invite_kind = 'manager' and i.id = u.invite_id
          and i.status = 'pending' and (i.expires_at is null or i.expires_at > now())
      )
  `);
  // postgres-js returns the rows themselves, PGlite wraps them in `{ rows }`.
  const list = (Array.isArray(rows) ? rows : (rows as unknown as { rows: unknown[] }).rows) as Array<{ id: string; storageKey: string }>;
  return list.map((r) => ({ id: r.id, storageKey: r.storageKey }));
}

export async function deleteUploadRows(ids: string[], tx: DbOrTx = db): Promise<void> {
  if (ids.length === 0) return;
  await tx.delete(schema.studentIdUploads).where(inArray(schema.studentIdUploads.id, ids));
}
