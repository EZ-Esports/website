import 'server-only';
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import {
  createPasswordResetService,
  type ResetAuthAdmin,
  type ResetLinkRow,
  type ResetStore,
  type ResetTarget,
  type ResetTargetKind,
} from './core';

/** Link columns plus the issuer's staff email (left join: the issuer may since have been removed). */
const linkSelection = {
  id: schema.passwordResetLinks.id,
  userId: schema.passwordResetLinks.userId,
  targetKind: schema.passwordResetLinks.targetKind,
  issuedByUserId: schema.passwordResetLinks.issuedByUserId,
  issuedByEmail: schema.staffMembers.email,
  createdAt: schema.passwordResetLinks.createdAt,
  expiresAt: schema.passwordResetLinks.expiresAt,
  usedAt: schema.passwordResetLinks.usedAt,
  revokedAt: schema.passwordResetLinks.revokedAt,
  revokedBy: schema.passwordResetLinks.revokedBy,
};

function toRow(r: {
  id: string;
  userId: string;
  targetKind: string;
  issuedByUserId: string;
  issuedByEmail: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
}): ResetLinkRow {
  return { ...r, targetKind: r.targetKind as ResetTargetKind };
}

function selectLinks() {
  return db
    .select(linkSelection)
    .from(schema.passwordResetLinks)
    .leftJoin(schema.staffMembers, eq(schema.staffMembers.userId, schema.passwordResetLinks.issuedByUserId));
}

export const drizzleResetStore: ResetStore = {
  async getTarget(userId, kind): Promise<ResetTarget | null> {
    const [staffRow] = await db
      .select({ userId: schema.staffMembers.userId })
      .from(schema.staffMembers)
      .where(eq(schema.staffMembers.userId, userId))
      .limit(1);

    let active: boolean;
    if (kind === 'manager') {
      const [manager] = await db
        .select({ id: schema.schoolManagers.id })
        .from(schema.schoolManagers)
        .where(and(eq(schema.schoolManagers.userId, userId), eq(schema.schoolManagers.isActive, true)))
        .limit(1);
      active = Boolean(manager);
    } else {
      active = Boolean(staffRow);
    }

    // Hierarchy is read from the roles of the staff identity, if the account has one.
    const roleRows = staffRow
      ? await db
          .select({ position: schema.roles.position, isOwner: schema.roles.isOwner })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
          .where(eq(schema.userRoles.userId, userId))
      : [];

    return {
      userId,
      kind,
      active,
      isStaff: Boolean(staffRow),
      isOwner: roleRows.some((r) => r.isOwner),
      highestRolePosition: roleRows.reduce((max, r) => Math.max(max, r.position), 0),
    };
  },

  async replaceOutstanding({ userId, kind, tokenHash, issuedByUserId, expiresAt, now }) {
    return db.transaction(async (tx) => {
      await tx
        .update(schema.passwordResetLinks)
        .set({ revokedAt: now, revokedBy: issuedByUserId })
        .where(
          and(
            eq(schema.passwordResetLinks.userId, userId),
            isNull(schema.passwordResetLinks.usedAt),
            isNull(schema.passwordResetLinks.revokedAt),
          ),
        );
      const [created] = await tx
        .insert(schema.passwordResetLinks)
        .values({ userId, targetKind: kind, tokenHash, issuedByUserId, expiresAt, createdAt: now })
        .returning({ id: schema.passwordResetLinks.id });
      return created;
    });
  },

  async findByHash(tokenHash) {
    const [row] = await selectLinks().where(eq(schema.passwordResetLinks.tokenHash, tokenHash)).limit(1);
    return row ? toRow(row) : null;
  },

  async getById(id) {
    const [row] = await selectLinks().where(eq(schema.passwordResetLinks.id, id)).limit(1);
    return row ? toRow(row) : null;
  },

  async claim(id, now) {
    const claimed = await db
      .update(schema.passwordResetLinks)
      .set({ usedAt: now })
      .where(
        and(
          eq(schema.passwordResetLinks.id, id),
          isNull(schema.passwordResetLinks.usedAt),
          isNull(schema.passwordResetLinks.revokedAt),
          gt(schema.passwordResetLinks.expiresAt, now),
        ),
      )
      .returning({ id: schema.passwordResetLinks.id });
    return claimed.length > 0;
  },

  async release(id) {
    await db
      .update(schema.passwordResetLinks)
      .set({ usedAt: null })
      .where(
        and(
          eq(schema.passwordResetLinks.id, id),
          isNotNull(schema.passwordResetLinks.usedAt),
          isNull(schema.passwordResetLinks.revokedAt),
        ),
      );
  },

  async revoke(id, revokedBy, now) {
    const revoked = await db
      .update(schema.passwordResetLinks)
      .set({ revokedAt: now, revokedBy })
      .where(
        and(
          eq(schema.passwordResetLinks.id, id),
          isNull(schema.passwordResetLinks.usedAt),
          isNull(schema.passwordResetLinks.revokedAt),
          gt(schema.passwordResetLinks.expiresAt, now),
        ),
      )
      .returning({ id: schema.passwordResetLinks.id });
    return revoked.length > 0;
  },

  async listForUser(userId, limit) {
    const rows = await selectLinks()
      .where(eq(schema.passwordResetLinks.userId, userId))
      .orderBy(desc(schema.passwordResetLinks.createdAt))
      .limit(limit);
    return rows.map(toRow);
  },
};

export const supabaseResetAuth: ResetAuthAdmin = {
  async setPassword(userId, password) {
    const { error } = await createServiceClient().auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  },

  async revokeAllSessions(userId) {
    // GoTrue's admin signOut needs the user's own JWT, which a staff-issued reset never has.
    // Deleting the user's auth.sessions rows cascades to their refresh tokens, which is what
    // a global sign-out does. Issued access tokens stay valid until they expire (at most the
    // project's JWT lifetime) but can no longer be refreshed.
    await db.execute(sql`delete from auth.sessions where user_id = ${userId}`);
  },
};

export const passwordResetService = createPasswordResetService({
  store: drizzleResetStore,
  auth: supabaseResetAuth,
  // Staff resets are out of scope for now (spec-063): staff are reset in the Supabase dashboard.
  enabledKinds: ['manager'],
  onSessionRevocationFailed: (userId, error) =>
    console.error('Password reset: could not revoke existing sessions', { userId, error }),
});
