import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  CompetitiveRole,
  PlayerSubmissionDraft,
} from '@/app/lib/onboarding/core/domain/types';

function toDbPlayerRole(role: CompetitiveRole | string): 'player' | 'sub' | 'captain' {
  if (role === 'captain') return 'captain';
  if (role === 'sub') return 'sub';
  return 'player';
}

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
// Roster & player pool reads
// ----------------------------------------------------------------------------

/** Roster joined to its team, or null when the roster does not exist. */
export async function findRosterWithTeam(rosterId: string) {
  const [row] = await db
    .select({
      roster: schema.rosters,
      team: schema.teams,
    })
    .from(schema.rosters)
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .where(eq(schema.rosters.id, rosterId))
    .limit(1);
  return row ?? null;
}

/**
 * Name, active flag and roster-lock state of a season. A missing season is reported with a null
 * name, inactive and unlocked.
 */
export async function getSeasonRosterState(
  seasonId: string
): Promise<{ name: string | null; isActive: boolean; isLocked: boolean }> {
  const [season] = await db
    .select({
      name: schema.seasons.name,
      isActive: schema.seasons.isActive,
      rostersLockedAt: schema.seasons.rostersLockedAt,
    })
    .from(schema.seasons)
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);
  return {
    name: season?.name ?? null,
    isActive: season?.isActive ?? false,
    isLocked: !!season?.rostersLockedAt,
  };
}

/**
 * Whether the game's season with this name has its rosters locked (false when the game has no
 * such season). Active or not: a manager's season is identified by name (spec-026).
 */
export async function isSeasonRostersLockedByName(
  gameId: string,
  seasonName: string
): Promise<boolean> {
  const [season] = await db
    .select({ rostersLockedAt: schema.seasons.rostersLockedAt })
    .from(schema.seasons)
    .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.name, seasonName)))
    .limit(1);
  return !!season?.rostersLockedAt;
}

/**
 * Loads the teams, rosters, players and identities behind a school's rosters.
 * Returns null when the school has no teams or no rosters (or, with
 * `seasonName`, when no season of that name exists).
 */
export async function loadSchoolRosterData(
  schoolId: string,
  gameIds?: string[] | null,
  options?: { seasonName?: string }
) {
  const whereConditions = [eq(schema.teams.schoolId, schoolId)];
  if (gameIds && gameIds.length > 0) {
    whereConditions.push(inArray(schema.teams.gameId, gameIds));
  }
  if (options?.seasonName) {
    // Managers only see seasons matching their affiliation by name (active or not).
    const namedSeasons = await db
      .select({ id: schema.seasons.id })
      .from(schema.seasons)
      .where(eq(schema.seasons.name, options.seasonName));
    if (namedSeasons.length === 0) return null;
    whereConditions.push(
      inArray(
        schema.teams.seasonId,
        namedSeasons.map((s) => s.id)
      )
    );
  }

  const schoolTeams = await db
    .select({
      id: schema.teams.id,
      schoolId: schema.teams.schoolId,
      gameId: schema.teams.gameId,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.teams)
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(and(...whereConditions));

  if (schoolTeams.length === 0) return null;

  const teamIds = schoolTeams.map((t) => t.id);
  const teamRosters = await db
    .select()
    .from(schema.rosters)
    .where(inArray(schema.rosters.teamId, teamIds));

  if (teamRosters.length === 0) return null;

  const rosterIds = teamRosters.map((r) => r.id);
  const playersList = await db
    .select({
      id: schema.players.id,
      rosterId: schema.players.rosterId,
      memberId: schema.players.memberId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
      ign: schema.players.ign,
      createdAt: schema.players.createdAt,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      discord: schema.members.discord,
    })
    .from(schema.players)
    .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
    .where(inArray(schema.players.rosterId, rosterIds));

  const memberIds = [...new Set(playersList.map((p) => p.memberId))];
  const identities =
    memberIds.length > 0
      ? await db
          .select()
          .from(schema.playerIdentities)
          .where(inArray(schema.playerIdentities.memberId, memberIds))
      : [];

  return { schoolTeams, teamRosters, playersList, identities };
}

/**
 * Loads a school's members with their identities and roster enrolments.
 * Returns null when the school has no members.
 */
export async function loadSchoolPlayerPoolData(schoolId: string) {
  const schoolMembers = await db
    .select({
      id: schema.members.id,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      discord: schema.members.discord,
    })
    .from(schema.members)
    .where(eq(schema.members.schoolId, schoolId))
    .orderBy(desc(schema.members.createdAt));

  if (schoolMembers.length === 0) return null;

  const memberIds = schoolMembers.map((m) => m.id);

  const identities = await db
    .select()
    .from(schema.playerIdentities)
    .where(inArray(schema.playerIdentities.memberId, memberIds));

  const playerRows = await db
    .select({
      playerId: schema.players.id,
      memberId: schema.players.memberId,
      rosterId: schema.players.rosterId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
      rosterName: schema.rosters.name,
      gameId: schema.teams.gameId,
      gameName: schema.games.displayName,
    })
    .from(schema.players)
    .innerJoin(schema.rosters, eq(schema.players.rosterId, schema.rosters.id))
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(inArray(schema.players.memberId, memberIds));

  return { schoolMembers, identities, playerRows };
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

export async function findPlayerInviteById(inviteId: string) {
  const [row] = await db
    .select()
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.id, inviteId))
    .limit(1);
  return row ?? null;
}

export async function insertPlayerInvite(params: {
  schoolId: string;
  gameId: string;
  tokenHash: string;
  intendedFirstName: string;
  intendedLastName: string;
  invitedByUserId: string;
  expiresAt: Date;
}) {
  const [inserted] = await db
    .insert(schema.playerInvites)
    .values({
      schoolId: params.schoolId,
      gameId: params.gameId,
      tokenHash: params.tokenHash,
      intendedFirstName: params.intendedFirstName,
      intendedLastName: params.intendedLastName,
      invitedByUserId: params.invitedByUserId,
      status: 'pending',
      expiresAt: params.expiresAt,
    })
    .returning();
  return inserted;
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

export async function listPendingPlayerInvites(schoolId: string, gameId?: string) {
  const conditions = [
    eq(schema.playerInvites.schoolId, schoolId),
    eq(schema.playerInvites.status, 'pending'),
  ];
  if (gameId) {
    conditions.push(eq(schema.playerInvites.gameId, gameId));
  }

  return db
    .select()
    .from(schema.playerInvites)
    .where(and(...conditions))
    .orderBy(desc(schema.playerInvites.createdAt));
}

export async function listSubmittedPlayerInvites(schoolId: string, gameId?: string) {
  const conditions = [
    eq(schema.playerInvites.schoolId, schoolId),
    eq(schema.playerInvites.status, 'submitted'),
  ];
  if (gameId) {
    conditions.push(eq(schema.playerInvites.gameId, gameId));
  }

  return db
    .select()
    .from(schema.playerInvites)
    .where(and(...conditions))
    .orderBy(desc(schema.playerInvites.submittedAt));
}

export async function markPlayerInviteRevoked(inviteId: string): Promise<void> {
  await db
    .update(schema.playerInvites)
    .set({
      status: 'rejected',
      rejectionReason: 'Revoked by school manager',
      reviewedAt: new Date(),
    })
    .where(eq(schema.playerInvites.id, inviteId));
}

// ----------------------------------------------------------------------------
// Approval & roster mutations
// ----------------------------------------------------------------------------

/** Upserts the member, demographics, identities and roster slot for an approved invite, then marks it accepted. */
export async function approveInviteAndEnrollTx(params: {
  inviteId: string;
  schoolId: string;
  gameId: string;
  draft: PlayerSubmissionDraft;
  targetRosterId?: string | null;
  competitiveRole: CompetitiveRole;
}) {
  const { inviteId, schoolId, draft, targetRosterId, competitiveRole } = params;

  return await db.transaction(async (tx) => {
    // 1. Upsert member
    const email = draft.email?.trim().toLowerCase() || `player_${Date.now()}@student.local`;
    const [existingMember] = await tx
      .select()
      .from(schema.members)
      .where(eq(schema.members.email, email))
      .limit(1);

    let memberId: string;
    if (existingMember) {
      memberId = existingMember.id;
      await tx
        .update(schema.members)
        .set({
          firstName: draft.firstName || existingMember.firstName,
          lastName: draft.lastName || existingMember.lastName,
          schoolId,
          updatedAt: new Date(),
        })
        .where(eq(schema.members.id, memberId));
    } else {
      const [insertedMember] = await tx
        .insert(schema.members)
        .values({
          schoolId,
          firstName: draft.firstName || 'Student',
          lastName: draft.lastName || 'Player',
          email,
        })
        .returning();
      memberId = insertedMember.id;
    }

    // 2. Insert demographics if available
    let demographicsId = '';
    if (draft.demographics) {
      const [demo] = await tx
        .insert(schema.studentDemographics)
        .values({
          memberId,
          legalFirstName: draft.demographics.legalFirstName,
          legalLastName: draft.demographics.legalLastName,
          birthDate: new Date(draft.demographics.birthDate),
          gender: draft.demographics.gender,
          race: Array.isArray(draft.demographics.race) ? draft.demographics.race : [draft.demographics.race],
          ethnicity: draft.demographics.ethnicity
            ? (Array.isArray(draft.demographics.ethnicity) ? draft.demographics.ethnicity : [draft.demographics.ethnicity])
            : null,
          countryOfBirth: draft.demographics.countryOfBirth,
          parentsCountryOfBirth: draft.demographics.parentsCountryOfBirth,
          primaryLanguageAtHome: draft.demographics.primaryLanguageAtHome,
          isFreeOrReducedLunch: draft.demographics.isFreeOrReducedLunch,
          isFirstGenCollege: draft.demographics.isFirstGenCollege,
          doePetitionConsent: draft.demographics.doePetitionConsent ?? false,
          surveyDetails: draft.demographics.surveyDetails,
        })
        .returning();
      demographicsId = demo.id;
    }

    // 3. Upsert identities
    let identityId: string | undefined;
    if (draft.identities) {
      for (const ident of Object.values(draft.identities)) {
        const [idRow] = await tx
          .insert(schema.playerIdentities)
          .values({
            memberId,
            provider: ident.provider,
            providerUserId: ident.providerUserId,
            providerUsername: ident.providerUsername,
            inGuild: ident.inGuild ?? false,
          })
          .returning();
        identityId = idRow.id;
      }
    }

    // 4. Enroll on roster if target specified
    let playerId: string | undefined;
    if (targetRosterId) {
      const isCaptain = competitiveRole === 'captain';
      if (isCaptain) {
        // Demote any existing captain on this roster
        await tx
          .update(schema.players)
          .set({ role: 'player', isCaptain: false, updatedAt: new Date() })
          .where(
            and(
              eq(schema.players.rosterId, targetRosterId),
              eq(schema.players.isCaptain, true)
            )
          );
      }

      const [existingP] = await tx
        .select()
        .from(schema.players)
        .where(
          and(
            eq(schema.players.rosterId, targetRosterId),
            eq(schema.players.memberId, memberId)
          )
        )
        .limit(1);

      if (existingP) {
        const [updated] = await tx
          .update(schema.players)
          .set({
            role: toDbPlayerRole(competitiveRole),
            isCaptain,
            updatedAt: new Date(),
          })
          .where(eq(schema.players.id, existingP.id))
          .returning();
        playerId = updated.id;
      } else {
        const [insertedP] = await tx
          .insert(schema.players)
          .values({
            rosterId: targetRosterId,
            memberId,
            role: toDbPlayerRole(competitiveRole),
            isCaptain,
            ign: draft.firstName ? `${draft.firstName} ${draft.lastName}` : null,
          })
          .returning();
        playerId = insertedP.id;
      }
    }

    // 5. Update invite record
    await tx
      .update(schema.playerInvites)
      .set({
        status: 'accepted',
        memberId,
        reviewedAt: new Date(),
      })
      .where(eq(schema.playerInvites.id, inviteId));

    return {
      memberId,
      playerId,
      demographicsId,
      identityId,
    };
  });
}

export async function enrollPlayerToRosterTx(params: {
  rosterId: string;
  memberId: string;
  ign?: string | null;
  role: CompetitiveRole;
}) {
  const { rosterId, memberId, ign, role } = params;
  const isCaptain = role === 'captain';

  return await db.transaction(async (tx) => {
    if (isCaptain) {
      // Demote existing captain on this roster
      await tx
        .update(schema.players)
        .set({ role: 'player', isCaptain: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.players.rosterId, rosterId),
            eq(schema.players.isCaptain, true)
          )
        );
    }

    const [existingPlayer] = await tx
      .select()
      .from(schema.players)
      .where(
        and(
          eq(schema.players.rosterId, rosterId),
          eq(schema.players.memberId, memberId)
        )
      )
      .limit(1);

    let playerId: string;
    if (existingPlayer) {
      playerId = existingPlayer.id;
      await tx
        .update(schema.players)
        .set({
          role: toDbPlayerRole(role),
          isCaptain,
          ign: ign || existingPlayer.ign,
          updatedAt: new Date(),
        })
        .where(eq(schema.players.id, existingPlayer.id));
    } else {
      const [inserted] = await tx
        .insert(schema.players)
        .values({
          rosterId,
          memberId,
          role: toDbPlayerRole(role),
          ign: ign || null,
          isCaptain,
        })
        .returning();
      playerId = inserted.id;
    }

    return {
      playerId,
      rosterId,
      memberId,
      role,
      isCaptain,
    };
  });
}

export async function updateRosterPlayerRoleTx(params: {
  rosterId: string;
  playerId: string;
  role: CompetitiveRole;
}): Promise<void> {
  const { rosterId, playerId, role } = params;
  const isCaptain = role === 'captain';

  await db.transaction(async (tx) => {
    if (isCaptain) {
      // Demote existing captains
      await tx
        .update(schema.players)
        .set({ role: 'player', isCaptain: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.players.rosterId, rosterId),
            eq(schema.players.isCaptain, true)
          )
        );
    }

    await tx
      .update(schema.players)
      .set({
        role: toDbPlayerRole(role),
        isCaptain,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, playerId));
  });
}

export async function deletePlayerFromRoster(params: {
  rosterId: string;
  playerId: string;
}): Promise<void> {
  await db
    .delete(schema.players)
    .where(
      and(
        eq(schema.players.id, params.playerId),
        eq(schema.players.rosterId, params.rosterId)
      )
    );
}

export async function swapStarterAndSubTx(params: {
  rosterId: string;
  currentStarterId: string;
  substitutePlayerId: string;
}): Promise<void> {
  const { rosterId, currentStarterId, substitutePlayerId } = params;

  await db.transaction(async (tx) => {
    const [starter] = await tx
      .select()
      .from(schema.players)
      .where(and(eq(schema.players.id, currentStarterId), eq(schema.players.rosterId, rosterId)))
      .limit(1);

    const [sub] = await tx
      .select()
      .from(schema.players)
      .where(and(eq(schema.players.id, substitutePlayerId), eq(schema.players.rosterId, rosterId)))
      .limit(1);

    if (!starter || !sub) {
      throw new Error('Both starter and substitute players must be present on roster');
    }

    await tx
      .update(schema.players)
      .set({ role: 'sub', isCaptain: false, updatedAt: new Date() })
      .where(eq(schema.players.id, starter.id));

    await tx
      .update(schema.players)
      .set({ role: 'player', isCaptain: starter.isCaptain, updatedAt: new Date() })
      .where(eq(schema.players.id, sub.id));
  });
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
