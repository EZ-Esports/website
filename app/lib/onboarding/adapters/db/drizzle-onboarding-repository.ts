import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  OnboardingRepositoryPort,
  SchoolRecord,
  GameRecord,
  PlayerInviteRecord,
  SchoolManagerRecord,
} from '../../core/ports/repository-port';
import type {
  CompetitiveRole,
  SchoolPlayerPoolItem,
  SchoolRosterWithPlayers,
  PlayerSubmissionDraft,
  RosterPlayerItem,
} from '../../core/domain/types';

export interface RegisteredManagerAccount {
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  schools: string[];
}

function toDbPlayerRole(role: CompetitiveRole | string): 'player' | 'sub' | 'captain' {
  if (role === 'captain') return 'captain';
  if (role === 'sub') return 'sub';
  return 'player';
}

export class DrizzleOnboardingRepository implements OnboardingRepositoryPort {
  // --------------------------------------------------------------------------
  // School & Game Queries
  // --------------------------------------------------------------------------

  async findSchoolById(schoolId: string): Promise<SchoolRecord | null> {
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

  async findSchoolBySlug(slug: string): Promise<SchoolRecord | null> {
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

  async findGameById(gameId: string): Promise<GameRecord | null> {
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

  async findGameBySlug(slug: string): Promise<GameRecord | null> {
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

  // --------------------------------------------------------------------------
  // Roster & Player Pool Queries
  // --------------------------------------------------------------------------

  async findRosterById(rosterId: string) {
    const [row] = await db
      .select({
        roster: schema.rosters,
        team: schema.teams,
      })
      .from(schema.rosters)
      .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
      .where(eq(schema.rosters.id, rosterId))
      .limit(1);

    if (!row) return null;
    return {
      id: row.roster.id,
      schoolId: row.team.schoolId,
      gameId: row.team.gameId,
      name: row.roster.name,
    };
  }

  async findSchoolRosters(
    schoolId: string,
    gameIds?: string[] | null
  ): Promise<SchoolRosterWithPlayers[]> {
    const whereConditions = [eq(schema.teams.schoolId, schoolId)];
    if (gameIds && gameIds.length > 0) {
      whereConditions.push(inArray(schema.teams.gameId, gameIds));
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

    if (schoolTeams.length === 0) return [];

    const teamIds = schoolTeams.map((t) => t.id);
    const teamRosters = await db
      .select()
      .from(schema.rosters)
      .where(inArray(schema.rosters.teamId, teamIds));

    if (teamRosters.length === 0) return [];

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

    return teamRosters.map((roster) => {
      const team = schoolTeams.find((t) => t.id === roster.teamId);
      const rPlayers: RosterPlayerItem[] = playersList
        .filter((p) => p.rosterId === roster.id)
        .map((p, idx) => {
          const riot = identities.find((i) => i.memberId === p.memberId && i.provider === 'riot');
          const discord = identities.find(
            (i) => i.memberId === p.memberId && i.provider === 'discord'
          );
          return {
            id: p.id,
            memberId: p.memberId,
            role: p.role,
            isCaptain: p.isCaptain,
            order: idx,
            ign: p.ign || riot?.providerUserId || `${p.firstName} ${p.lastName}`,
            discordUsername: discord?.providerUsername || p.discord || 'Unlinked',
            inGuild: discord?.inGuild ?? false,
            trackerUrl: riot ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riot.providerUserId)}/overview` : null,
            isEnrolled: true,
            createdAt: p.createdAt,
          };
        });

      return {
        id: roster.id,
        gameId: team?.gameId ?? '',
        gameName: team?.gameName ?? '',
        name: roster.name,
        status: 'active',
        activePlayerCount: rPlayers.length,
        players: rPlayers,
      };
    });
  }

  async findSchoolPlayerPool(schoolId: string, gameId?: string): Promise<SchoolPlayerPoolItem[]> {
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

    if (schoolMembers.length === 0) return [];

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

    const poolItems: SchoolPlayerPoolItem[] = [];

    for (const m of schoolMembers) {
      const memberIdentities = identities.filter((i) => i.memberId === m.id);
      const riot = memberIdentities.find((i) => i.provider === 'riot');
      const playerRecord = playerRows.find((p) => p.memberId === m.id && (!gameId || p.gameId === gameId));

      const gamerTag = riot?.providerUserId || `${m.firstName} ${m.lastName}`;
      const trackerUrl = riot
        ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riot.providerUserId)}/overview`
        : null;

      poolItems.push({
        playerId: playerRecord?.playerId ?? m.id,
        memberId: m.id,
        gameId: playerRecord?.gameId ?? gameId ?? '',
        gameName: playerRecord?.gameName ?? '',
        gamerTag,
        rawGamerTag: riot?.providerUserId ?? gamerTag,
        trackerUrl,
        currentRosterId: playerRecord?.rosterId ?? null,
        currentRosterName: playerRecord?.rosterName ?? null,
        currentRole: (playerRecord?.role as CompetitiveRole) ?? null,
        isCaptain: playerRecord?.isCaptain ?? false,
        isEnrolled: Boolean(playerRecord),
      });
    }

    return poolItems;
  }

  // --------------------------------------------------------------------------
  // Invite Operations
  // --------------------------------------------------------------------------

  async findInviteByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null> {
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
      return (direct as PlayerInviteRecord) ?? null;
    }

    const inviteRecord = (row.invite || row) as PlayerInviteRecord;
    return inviteRecord;
  }

  async findInviteById(inviteId: string): Promise<PlayerInviteRecord | null> {
    const [row] = await db
      .select()
      .from(schema.playerInvites)
      .where(eq(schema.playerInvites.id, inviteId))
      .limit(1);
    return (row as PlayerInviteRecord) ?? null;
  }

  async createPlayerInvite(params: {
    schoolId: string;
    gameId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
  }): Promise<PlayerInviteRecord> {
    const [inserted] = await db
      .insert(schema.playerInvites)
      .values({
        schoolId: params.schoolId,
        gameId: params.gameId,
        tokenHash: params.tokenHash,
        intendedFirstName: params.intendedFirstName,
        intendedLastName: params.intendedLastName,
        invitedByUserId: params.invitedByUserId,
        role: 'player',
        status: 'pending',
        expiresAt: params.expiresAt,
      })
      .returning();
    return inserted as PlayerInviteRecord;
  }

  async updateInviteDraft(inviteId: string, draft: Partial<PlayerSubmissionDraft>): Promise<void> {
    await db
      .update(schema.playerInvites)
      .set({
        submissionDraft: draft,
      })
      .where(eq(schema.playerInvites.id, inviteId));
  }

  async submitInvite(inviteId: string, finalDraft: PlayerSubmissionDraft): Promise<void> {
    await db
      .update(schema.playerInvites)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        submissionDraft: finalDraft,
      })
      .where(eq(schema.playerInvites.id, inviteId));
  }

  async listSchoolInvites(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]> {
    const conditions = [
      eq(schema.playerInvites.schoolId, schoolId),
      eq(schema.playerInvites.role, 'player'),
      eq(schema.playerInvites.status, 'pending'),
    ];
    if (gameId) {
      conditions.push(eq(schema.playerInvites.gameId, gameId));
    }

    const rows = await db
      .select()
      .from(schema.playerInvites)
      .where(and(...conditions))
      .orderBy(desc(schema.playerInvites.createdAt));

    return rows as PlayerInviteRecord[];
  }

  async listPendingSubmissions(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]> {
    const conditions = [
      eq(schema.playerInvites.schoolId, schoolId),
      eq(schema.playerInvites.role, 'player'),
      eq(schema.playerInvites.status, 'submitted'),
    ];
    if (gameId) {
      conditions.push(eq(schema.playerInvites.gameId, gameId));
    }

    const rows = await db
      .select()
      .from(schema.playerInvites)
      .where(and(...conditions))
      .orderBy(desc(schema.playerInvites.submittedAt));

    return rows as PlayerInviteRecord[];
  }

  async revokePlayerInvite(inviteId: string): Promise<void> {
    await db
      .update(schema.playerInvites)
      .set({
        status: 'rejected',
        rejectionReason: 'Revoked by school manager',
        reviewedAt: new Date(),
      })
      .where(eq(schema.playerInvites.id, inviteId));
  }

  // --------------------------------------------------------------------------
  // Approval & Roster Mutations
  // --------------------------------------------------------------------------

  async approveInviteAndEnroll(params: {
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

  async enrollPlayerToRoster(params: {
    rosterId: string;
    schoolId: string;
    gameId: string;
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

  async updateRosterPlayerRole(params: {
    rosterId: string;
    playerId: string;
    role: CompetitiveRole;
  }): Promise<{ success: boolean }> {
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

    return { success: true };
  }

  async removePlayerFromRoster(params: {
    rosterId: string;
    playerId: string;
  }): Promise<{ success: boolean }> {
    await db
      .delete(schema.players)
      .where(
        and(
          eq(schema.players.id, params.playerId),
          eq(schema.players.rosterId, params.rosterId)
        )
      );
    return { success: true };
  }

  async emergencySwapSub(params: {
    rosterId: string;
    currentStarterId: string;
    substitutePlayerId: string;
  }): Promise<{ success: boolean }> {
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

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // School Manager Provisioning & Tenancy
  // --------------------------------------------------------------------------

  async resolveStaffUserId(email: string): Promise<string | null> {
    const [staff] = await db
      .select({ userId: schema.staffMembers.userId })
      .from(schema.staffMembers)
      .where(sql`lower(${schema.staffMembers.email}) = ${email.toLowerCase().trim()}`)
      .limit(1);
    return staff?.userId ?? null;
  }

  async findSchoolManagers(schoolId: string) {
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

  async findRegisteredManagers(searchQuery?: string): Promise<RegisteredManagerAccount[]> {
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

    const managerMap = new Map<string, RegisteredManagerAccount>();

    for (const row of managerRows) {
      if (!row.email) continue;
      const normalizedEmail = row.email.toLowerCase().trim();
      const existing = managerMap.get(normalizedEmail);
      const schoolName = row.schoolName?.trim();

      if (existing) {
        if (schoolName && !existing.schools.includes(schoolName)) {
          existing.schools.push(schoolName);
        }
        if (!existing.memberId && row.memberId) {
          existing.memberId = row.memberId;
        }
      } else {
        const fn = (row.firstName || '').trim();
        const ln = (row.lastName || '').trim();
        const fullName = `${fn} ${ln}`.trim() || normalizedEmail;
        managerMap.set(normalizedEmail, {
          userId: row.userId,
          memberId: row.memberId ?? null,
          firstName: fn,
          lastName: ln,
          fullName,
          email: row.email,
          schools: schoolName ? [schoolName] : [],
        });
      }
    }

    for (const row of memberRows) {
      if (!row.email) continue;
      const normalizedEmail = row.email.toLowerCase().trim();
      const existing = managerMap.get(normalizedEmail);
      const schoolName = row.schoolName?.trim();

      if (existing) {
        if (schoolName && !existing.schools.includes(schoolName)) {
          existing.schools.push(schoolName);
        }
        if (!existing.memberId && row.memberId) {
          existing.memberId = row.memberId;
        }
      } else {
        const fn = (row.firstName || '').trim();
        const ln = (row.lastName || '').trim();
        const fullName = `${fn} ${ln}`.trim() || normalizedEmail;
        managerMap.set(normalizedEmail, {
          userId: `mem-usr-${row.memberId}`,
          memberId: row.memberId,
          firstName: fn,
          lastName: ln,
          fullName,
          email: row.email,
          schools: schoolName ? [schoolName] : [],
        });
      }
    }

    let results = Array.from(managerMap.values());
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        (a) =>
          a.email.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q) ||
          a.schools.some((s) => s.toLowerCase().includes(q))
      );
    }
    return results;
  }

  async findManagerById(managerId: string): Promise<SchoolManagerRecord | null> {
    const [row] = await db
      .select()
      .from(schema.schoolManagers)
      .where(eq(schema.schoolManagers.id, managerId))
      .limit(1);
    return (row as SchoolManagerRecord) ?? null;
  }

  async createOrUpdateSchoolManager(params: {
    schoolId: string;
    userId: string;
    memberId?: string | null;
    academicYear: string;
    managedGames?: string[] | null;
    isPrimaryContact: boolean;
  }): Promise<SchoolManagerRecord> {
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
      return updated as SchoolManagerRecord;
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
      return inserted as SchoolManagerRecord;
    }
  }

  async removeSchoolManager(managerId: string): Promise<SchoolManagerRecord | null> {
    const [updated] = await db
      .update(schema.schoolManagers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolManagers.id, managerId))
      .returning();
    return (updated as SchoolManagerRecord) ?? null;
  }

  async createManagerInvite(params: {
    schoolId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
    draft?: Record<string, unknown>;
  }): Promise<PlayerInviteRecord> {
    const [inserted] = await db
      .insert(schema.playerInvites)
      .values({
        schoolId: params.schoolId,
        gameId: null,
        role: 'manager',
        tokenHash: params.tokenHash,
        intendedFirstName: params.intendedFirstName,
        intendedLastName: params.intendedLastName,
        invitedByUserId: params.invitedByUserId,
        status: 'pending',
        expiresAt: params.expiresAt,
        submissionDraft: params.draft ?? null,
      })
      .returning();
    return inserted as PlayerInviteRecord;
  }

  async listSchoolManagerInvites(schoolId: string): Promise<PlayerInviteRecord[]> {
    const rows = await db
      .select()
      .from(schema.playerInvites)
      .where(
        and(
          eq(schema.playerInvites.schoolId, schoolId),
          eq(schema.playerInvites.role, 'manager')
        )
      )
      .orderBy(desc(schema.playerInvites.createdAt));
    return rows as PlayerInviteRecord[];
  }

  async revokeManagerInvite(inviteId: string): Promise<void> {
    await db
      .update(schema.playerInvites)
      .set({
        status: 'rejected',
        rejectionReason: 'Revoked by staff administrator',
        reviewedAt: new Date(),
      })
      .where(eq(schema.playerInvites.id, inviteId));
  }

  async writeStaffAuditLog(params: {
    event: string;
    userId: string;
    email: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(schema.staffAuditLogs).values({
        event: params.event,
        userId: params.userId,
        email: params.email,
        details: JSON.stringify(params.details),
      });
    } catch (err) {
      console.error('Failed to write staff audit log', err);
    }
  }
}
