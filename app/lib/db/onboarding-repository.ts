import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PlayerSubmissionDraft } from '@/app/lib/onboarding/core/domain/types';

// ----------------------------------------------------------------------------
// School & game lookups
// ----------------------------------------------------------------------------

export async function findSchoolRowById(schoolId: string) {
  const [row] = await db
    .select({
      id: schema.schools.id,
      name: schema.schools.name,
      slug: schema.schools.slug,
      logoUrl: schema.schools.logoUrl,
    })
    .from(schema.schools)
    .where(and(eq(schema.schools.id, schoolId), isNull(schema.schools.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function findSchoolRowBySlug(slug: string) {
  const [row] = await db
    .select({
      id: schema.schools.id,
      name: schema.schools.name,
      slug: schema.schools.slug,
      logoUrl: schema.schools.logoUrl,
    })
    .from(schema.schools)
    .where(and(sql`lower(${schema.schools.slug}) = ${slug.toLowerCase()}`, isNull(schema.schools.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function findGameRowById(gameId: string) {
  const [row] = await db
    .select({
      id: schema.games.id,
      name: schema.games.displayName,
      slug: schema.games.slug,
    })
    .from(schema.games)
    .where(eq(schema.games.id, gameId))
    .limit(1);
  return row ?? null;
}

export async function findGameRowBySlug(slug: string) {
  const [row] = await db
    .select({
      id: schema.games.id,
      name: schema.games.displayName,
      slug: schema.games.slug,
    })
    .from(schema.games)
    .where(sql`lower(${schema.games.slug}) = ${slug.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

// ----------------------------------------------------------------------------
// Player invite operations
// ----------------------------------------------------------------------------

/** Player invite by token hash; falls back to a bare invite read when the joins match nothing. */
export async function findPlayerInviteByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({
      invite: schema.playerInvites,
      schoolId: schema.schools.id,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
      gameId: schema.games.id,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.playerInvites)
    .innerJoin(schema.schools, eq(schema.playerInvites.schoolId, schema.schools.id))
    .leftJoin(schema.games, eq(schema.playerInvites.gameId, schema.games.id))
    .where(eq(schema.playerInvites.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    // Fallback if not matching join (e.g. without games)
    const [direct] = await db
      .select()
      .from(schema.playerInvites)
      .where(eq(schema.playerInvites.tokenHash, tokenHash))
      .limit(1);
    return direct ?? null;
  }

  return row.invite || row;
}

export async function setPlayerInviteDraft(
  inviteId: string,
  draft: Partial<PlayerSubmissionDraft>
): Promise<void> {
  await db
    .update(schema.playerInvites)
    .set({
      submissionDraft: draft,
    })
    .where(eq(schema.playerInvites.id, inviteId));
}

export async function markPlayerInviteFinalSubmitted(
  inviteId: string,
  finalDraft: PlayerSubmissionDraft
): Promise<void> {
  await db
    .update(schema.playerInvites)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      submissionDraft: finalDraft,
    })
    .where(eq(schema.playerInvites.id, inviteId));
}

// ----------------------------------------------------------------------------
// School manager provisioning & tenancy
// ----------------------------------------------------------------------------

export async function findStaffUserIdByNormalizedEmail(email: string): Promise<string | null> {
  const [staff] = await db
    .select({ userId: schema.staffMembers.userId })
    .from(schema.staffMembers)
    .where(sql`lower(${schema.staffMembers.email}) = ${email.toLowerCase().trim()}`)
    .limit(1);
  return staff?.userId ?? null;
}

export async function listActiveSchoolManagers(schoolId: string) {
  return db
    .select({
      id: schema.schoolManagers.id,
      schoolId: schema.schoolManagers.schoolId,
      userId: schema.schoolManagers.userId,
      memberId: schema.schoolManagers.memberId,
      managedGames: schema.schoolManagers.managedGames,
      academicYear: schema.schoolManagers.academicYear,
      isPrimaryContact: schema.schoolManagers.isPrimaryContact,
      isActive: schema.schoolManagers.isActive,
      createdAt: schema.schoolManagers.createdAt,
      updatedAt: schema.schoolManagers.updatedAt,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      email: sql<string | null>`coalesce(${schema.members.email}, ${schema.staffMembers.email})`,
    })
    .from(schema.schoolManagers)
    .leftJoin(schema.members, eq(schema.schoolManagers.memberId, schema.members.id))
    .leftJoin(schema.staffMembers, eq(schema.schoolManagers.userId, schema.staffMembers.userId))
    .where(
      and(
        eq(schema.schoolManagers.schoolId, schoolId),
        eq(schema.schoolManagers.isActive, true)
      )
    )
    .orderBy(desc(schema.schoolManagers.isPrimaryContact), asc(schema.schoolManagers.createdAt));
}

/** Raw manager and member rows behind the registered-manager account list. */
export async function loadRegisteredManagerSourceRows() {
  const managerRows = await db
    .select({
      userId: schema.schoolManagers.userId,
      memberId: schema.schoolManagers.memberId,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      email: sql<string | null>`coalesce(${schema.members.email}, ${schema.staffMembers.email})`,
      schoolName: schema.schools.name,
    })
    .from(schema.schoolManagers)
    .leftJoin(schema.members, eq(schema.schoolManagers.memberId, schema.members.id))
    .leftJoin(schema.staffMembers, eq(schema.schoolManagers.userId, schema.staffMembers.userId))
    .leftJoin(schema.schools, eq(schema.schoolManagers.schoolId, schema.schools.id));

  const memberRows = await db
    .select({
      memberId: schema.members.id,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      email: schema.members.email,
      schoolName: schema.schools.name,
    })
    .from(schema.members)
    .leftJoin(schema.schools, eq(schema.members.schoolId, schema.schools.id))
    .where(sql`${schema.members.email} IS NOT NULL AND ${schema.members.email} != ''`);

  return { managerRows, memberRows };
}

export async function findSchoolManagerRowById(managerId: string) {
  const [row] = await db
    .select()
    .from(schema.schoolManagers)
    .where(eq(schema.schoolManagers.id, managerId))
    .limit(1);
  return row ?? null;
}

export async function upsertSchoolManagerAssignment(params: {
  schoolId: string;
  userId: string;
  memberId?: string | null;
  academicYear: string;
  managedGames?: string[] | null;
  isPrimaryContact: boolean;
}) {
  const { schoolId, userId, memberId, academicYear, managedGames, isPrimaryContact } = params;

  if (isPrimaryContact) {
    await db
      .update(schema.schoolManagers)
      .set({ isPrimaryContact: false })
      .where(
        and(
          eq(schema.schoolManagers.schoolId, schoolId),
          eq(schema.schoolManagers.academicYear, academicYear)
        )
      );
  }

  const [existing] = await db
    .select()
    .from(schema.schoolManagers)
    .where(
      and(
        eq(schema.schoolManagers.schoolId, schoolId),
        eq(schema.schoolManagers.userId, userId),
        eq(schema.schoolManagers.academicYear, academicYear)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.schoolManagers)
      .set({
        isActive: true,
        memberId: memberId ?? existing.memberId,
        managedGames: managedGames !== undefined ? managedGames : existing.managedGames,
        isPrimaryContact: isPrimaryContact ?? existing.isPrimaryContact,
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolManagers.id, existing.id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(schema.schoolManagers)
      .values({
        schoolId,
        userId,
        memberId: memberId ?? null,
        managedGames: managedGames ?? null,
        academicYear,
        isPrimaryContact: Boolean(isPrimaryContact),
        isActive: true,
      })
      .returning();
    return inserted;
  }
}

export async function deactivateSchoolManager(managerId: string) {
  const [updated] = await db
    .update(schema.schoolManagers)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.schoolManagers.id, managerId))
    .returning();
  return updated ?? null;
}

// ----------------------------------------------------------------------------
// Manager invites & audit log
// ----------------------------------------------------------------------------

export async function insertManagerInvite(params: {
  schoolId: string;
  tokenHash: string;
  intendedFirstName: string;
  intendedLastName: string;
  invitedByUserId: string;
  expiresAt: Date;
  draft?: Record<string, unknown>;
}) {
  const [inserted] = await db
    .insert(schema.managerInvites)
    .values({
      schoolId: params.schoolId,
      tokenHash: params.tokenHash,
      intendedFirstName: params.intendedFirstName,
      intendedLastName: params.intendedLastName,
      invitedByUserId: params.invitedByUserId,
      status: 'pending',
      expiresAt: params.expiresAt,
      submissionDraft: params.draft ?? null,
    })
    .returning();
  return inserted;
}

export async function listManagerInvitesForSchool(schoolId: string) {
  return db
    .select()
    .from(schema.managerInvites)
    .where(eq(schema.managerInvites.schoolId, schoolId))
    .orderBy(desc(schema.managerInvites.createdAt));
}

export async function markManagerInviteRevoked(inviteId: string): Promise<void> {
  await db
    .update(schema.managerInvites)
    .set({
      status: 'rejected',
      rejectionReason: 'Revoked by staff administrator',
      reviewedAt: new Date(),
    })
    .where(eq(schema.managerInvites.id, inviteId));
}

export async function insertStaffAuditLog(params: {
  event: string;
  userId: string;
  email: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await db.insert(schema.staffAuditLogs).values({
    event: params.event,
    userId: params.userId,
    email: params.email,
    details: JSON.stringify(params.details),
  });
}
