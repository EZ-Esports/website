import * as dal from '@/app/lib/db/onboarding-repository';
import type {
  OnboardingRepositoryPort,
  SchoolRecord,
  GameRecord,
  PlayerInviteRecord,
  ManagerInviteRecord,
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

export class DrizzleOnboardingRepository implements OnboardingRepositoryPort {
  // --------------------------------------------------------------------------
  // School & Game Queries
  // --------------------------------------------------------------------------

  async findSchoolById(schoolId: string): Promise<SchoolRecord | null> {
    return dal.findSchoolRowById(schoolId);
  }

  async findSchoolBySlug(slug: string): Promise<SchoolRecord | null> {
    return dal.findSchoolRowBySlug(slug);
  }

  async findGameById(gameId: string): Promise<GameRecord | null> {
    return dal.findGameRowById(gameId);
  }

  async findGameBySlug(slug: string): Promise<GameRecord | null> {
    return dal.findGameRowBySlug(slug);
  }

  // --------------------------------------------------------------------------
  // Roster & Player Pool Queries
  // --------------------------------------------------------------------------

  async findRosterById(rosterId: string) {
    const row = await dal.findRosterWithTeam(rosterId);
    if (!row) return null;
    const season = await dal.getSeasonRosterState(row.team.seasonId);
    return {
      id: row.roster.id,
      schoolId: row.team.schoolId,
      gameId: row.team.gameId,
      name: row.roster.name,
      seasonName: season.name ?? undefined,
      isSeasonLocked: season.isLocked,
      isSeasonPast: season.isPast,
    };
  }

  async isSeasonLockedByName(gameId: string, seasonName: string): Promise<boolean> {
    return dal.isSeasonRostersLockedByName(gameId, seasonName);
  }

  async isSeasonPastByName(gameId: string, seasonName: string): Promise<boolean> {
    return dal.isSeasonPastByName(gameId, seasonName);
  }

  async findSchoolRosters(
    schoolId: string,
    gameIds?: string[] | null,
    options?: { seasonName?: string }
  ): Promise<SchoolRosterWithPlayers[]> {
    const data = await dal.loadSchoolRosterData(schoolId, gameIds, options);
    if (!data) return [];
    const { schoolTeams, teamRosters, playersList, identities } = data;

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
    const data = await dal.loadSchoolPlayerPoolData(schoolId);
    if (!data) return [];
    const { schoolMembers, identities, playerRows } = data;

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
    return (await dal.findPlayerInviteByTokenHash(tokenHash)) as PlayerInviteRecord | null;
  }

  async findInviteById(inviteId: string): Promise<PlayerInviteRecord | null> {
    return (await dal.findPlayerInviteById(inviteId)) as PlayerInviteRecord | null;
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
    return (await dal.insertPlayerInvite(params)) as PlayerInviteRecord;
  }

  async updateInviteDraft(inviteId: string, draft: Partial<PlayerSubmissionDraft>): Promise<void> {
    await dal.setPlayerInviteDraft(inviteId, draft);
  }

  async submitInvite(inviteId: string, finalDraft: PlayerSubmissionDraft): Promise<void> {
    await dal.markPlayerInviteFinalSubmitted(inviteId, finalDraft);
  }

  async listSchoolInvites(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]> {
    return (await dal.listPendingPlayerInvites(schoolId, gameId)) as PlayerInviteRecord[];
  }

  async listPendingSubmissions(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]> {
    return (await dal.listSubmittedPlayerInvites(schoolId, gameId)) as PlayerInviteRecord[];
  }

  async revokePlayerInvite(inviteId: string): Promise<void> {
    await dal.markPlayerInviteRevoked(inviteId);
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
    return dal.approveInviteAndEnrollTx(params);
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
    return dal.enrollPlayerToRosterTx({ rosterId, memberId, ign, role });
  }

  async updateRosterPlayerRole(params: {
    rosterId: string;
    playerId: string;
    role: CompetitiveRole;
  }): Promise<{ success: boolean }> {
    await dal.updateRosterPlayerRoleTx(params);
    return { success: true };
  }

  async removePlayerFromRoster(params: {
    rosterId: string;
    playerId: string;
  }): Promise<{ success: boolean }> {
    await dal.deletePlayerFromRoster(params);
    return { success: true };
  }

  async emergencySwapSub(params: {
    rosterId: string;
    currentStarterId: string;
    substitutePlayerId: string;
  }): Promise<{ success: boolean }> {
    await dal.swapStarterAndSubTx(params);
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // School Manager Provisioning & Tenancy
  // --------------------------------------------------------------------------

  async resolveStaffUserId(email: string): Promise<string | null> {
    return dal.findStaffUserIdByNormalizedEmail(email);
  }

  async findSchoolManagers(schoolId: string) {
    return dal.listActiveSchoolManagers(schoolId);
  }

  async findRegisteredManagers(searchQuery?: string): Promise<RegisteredManagerAccount[]> {
    const { managerRows, memberRows } = await dal.loadRegisteredManagerSourceRows();

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
    return (await dal.findSchoolManagerRowById(managerId)) as SchoolManagerRecord | null;
  }

  async createOrUpdateSchoolManager(params: {
    schoolId: string;
    userId: string;
    memberId?: string | null;
    academicYear: string;
    managedGames?: string[] | null;
    isPrimaryContact: boolean;
  }): Promise<SchoolManagerRecord> {
    return (await dal.upsertSchoolManagerAssignment(params)) as SchoolManagerRecord;
  }

  async removeSchoolManager(managerId: string): Promise<SchoolManagerRecord | null> {
    return (await dal.deactivateSchoolManager(managerId)) as SchoolManagerRecord | null;
  }

  async createManagerInvite(params: {
    schoolId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
    draft?: Record<string, unknown>;
  }): Promise<ManagerInviteRecord> {
    return (await dal.insertManagerInvite(params)) as ManagerInviteRecord;
  }

  async listSchoolManagerInvites(schoolId: string): Promise<ManagerInviteRecord[]> {
    return (await dal.listManagerInvitesForSchool(schoolId)) as ManagerInviteRecord[];
  }

  async revokeManagerInvite(inviteId: string): Promise<void> {
    await dal.markManagerInviteRevoked(inviteId);
  }

  async writeStaffAuditLog(params: {
    event: string;
    userId: string;
    email: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    try {
      await dal.insertStaffAuditLog(params);
    } catch (err) {
      console.error('Failed to write staff audit log', err);
    }
  }
}
