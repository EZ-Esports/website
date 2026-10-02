'use server';

import crypto from 'node:crypto';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { assertManagerForSchool, assertManagerForRoster } from './manager-auth';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';

export interface CreatePlayerInviteParams {
  schoolId: string;
  gameId: string;
  intendedFirstName: string;
  intendedLastName: string;
  expiresInDays?: number;
}

export interface CreatePlayerInviteResult {
  inviteId: string;
  token: string;
  inviteUrl: string;
  intendedFirstName: string;
  intendedLastName: string;
  expiresAt: Date;
}

/**
 * Utility to generate a cryptographic single-use invite token and its SHA-256 hash.
 */
export async function generateInviteToken(): Promise<{ token: string; tokenHash: string }> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/**
 * Generates a personalized, single-use player invite link for a school and game.
 * Asserts manager authorization and stores the token SHA-256 hash.
 */
export async function createPlayerInvite(
  params: CreatePlayerInviteParams
): Promise<CreatePlayerInviteResult> {
  const { schoolId, gameId, intendedFirstName, intendedLastName, expiresInDays } = params;

  if (!schoolId || !gameId) {
    throw new Error('School ID and Game ID are required');
  }
  if (!intendedFirstName?.trim() || !intendedLastName?.trim()) {
    throw new Error('Student first and last names are required');
  }

  const context = await assertManagerForSchool(schoolId, gameId);

  const { token, tokenHash } = await generateInviteToken();
  const days = expiresInDays && expiresInDays > 0 ? expiresInDays : 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const [inserted] = await db
    .insert(schema.playerInvites)
    .values({
      schoolId,
      gameId,
      tokenHash,
      intendedFirstName: intendedFirstName.trim(),
      intendedLastName: intendedLastName.trim(),
      invitedByUserId: context.userId,
      expiresAt,
      status: 'pending',
    })
    .returning();

  // Resolve school and game slugs for the clean join URL
  const [school] = await db
    .select({ slug: schema.schools.slug })
    .from(schema.schools)
    .where(eq(schema.schools.id, schoolId))
    .limit(1);

  const [game] = await db
    .select({ slug: schema.games.slug })
    .from(schema.games)
    .where(eq(schema.games.id, gameId))
    .limit(1);

  const schoolSlug = school?.slug ?? schoolId;
  const gameSlug = game?.slug ?? gameId;
  const inviteUrl = `/join/${schoolSlug}/${gameSlug}?token=${token}`;

  return {
    inviteId: inserted.id,
    token,
    inviteUrl,
    intendedFirstName: inserted.intendedFirstName,
    intendedLastName: inserted.intendedLastName,
    expiresAt: inserted.expiresAt,
  };
}

export interface SchoolInviteItem {
  id: string;
  schoolId: string;
  gameId: string | null;
  intendedFirstName: string;
  intendedLastName: string;
  status: string;
  expiresAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  schoolSlug: string;
  gameSlug: string;
  gameName: string;
}

/**
 * Retrieves all player invites created for a school (and optional game).
 */
export async function getSchoolInvites(
  schoolId: string,
  gameId?: string
): Promise<SchoolInviteItem[]> {
  await assertManagerForSchool(schoolId, gameId);

  const whereConditions = [eq(schema.playerInvites.schoolId, schoolId)];
  if (gameId) {
    whereConditions.push(eq(schema.playerInvites.gameId, gameId));
  }

  const invites = await db
    .select({
      id: schema.playerInvites.id,
      schoolId: schema.playerInvites.schoolId,
      gameId: schema.playerInvites.gameId,
      intendedFirstName: schema.playerInvites.intendedFirstName,
      intendedLastName: schema.playerInvites.intendedLastName,
      status: schema.playerInvites.status,
      expiresAt: schema.playerInvites.expiresAt,
      submittedAt: schema.playerInvites.submittedAt,
      reviewedAt: schema.playerInvites.reviewedAt,
      rejectionReason: schema.playerInvites.rejectionReason,
      createdAt: schema.playerInvites.createdAt,
      schoolSlug: schema.schools.slug,
      gameSlug: schema.games.slug,
      gameName: schema.games.displayName,
    })
    .from(schema.playerInvites)
    .innerJoin(schema.schools, eq(schema.playerInvites.schoolId, schema.schools.id))
    .innerJoin(schema.games, eq(schema.playerInvites.gameId, schema.games.id))
    .where(and(...whereConditions))
    .orderBy(desc(schema.playerInvites.createdAt));

  return invites;
}

export interface PendingSubmission {
  id: string;
  schoolId: string;
  gameId: string | null;
  gameName: string;
  gameSlug: string;
  intendedFirstName: string;
  intendedLastName: string;
  playerName: string;
  ign: string;
  discord: string;
  grade: string;
  submittedAt: Date | null;
  memberId: string | null;
  status: string;
}

/**
 * Returns submitted player applications waiting for manager approval.
 * Guarantees Zero-PII Invariant: does NOT select any sensitive demographic data
 * (birthdate, race, ethnicity, free lunch status, family background).
 */
export async function getPendingSubmissions(
  schoolId: string,
  gameId?: string
): Promise<PendingSubmission[]> {
  await assertManagerForSchool(schoolId, gameId);

  const whereConditions = [
    eq(schema.playerInvites.schoolId, schoolId),
    eq(schema.playerInvites.status, 'submitted'),
  ];
  if (gameId) {
    whereConditions.push(eq(schema.playerInvites.gameId, gameId));
  }

  const submittedInvites = await db
    .select({
      id: schema.playerInvites.id,
      schoolId: schema.playerInvites.schoolId,
      gameId: schema.playerInvites.gameId,
      intendedFirstName: schema.playerInvites.intendedFirstName,
      intendedLastName: schema.playerInvites.intendedLastName,
      memberId: schema.playerInvites.memberId,
      submissionDraft: schema.playerInvites.submissionDraft,
      submittedAt: schema.playerInvites.submittedAt,
      status: schema.playerInvites.status,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.playerInvites)
    .innerJoin(schema.games, eq(schema.playerInvites.gameId, schema.games.id))
    .where(and(...whereConditions))
    .orderBy(desc(schema.playerInvites.submittedAt));

  const memberIds = submittedInvites
    .map((inv) => inv.memberId)
    .filter((id): id is string => !!id);

  const membersMap: Record<string, { graduationYear: number | null; discord: string | null }> = {};
  const identitiesMap: Record<
    string,
    Array<{ provider: string; providerUserId: string; providerUsername: string; inGuild: boolean }>
  > = {};

  if (memberIds.length > 0) {
    const memberRows = await db
      .select({
        id: schema.members.id,
        graduationYear: schema.members.graduationYear,
        discord: schema.members.discord,
      })
      .from(schema.members)
      .where(inArray(schema.members.id, memberIds));

    for (const m of memberRows) {
      membersMap[m.id] = { graduationYear: m.graduationYear, discord: m.discord };
    }

    const identityRows = await db
      .select({
        memberId: schema.playerIdentities.memberId,
        provider: schema.playerIdentities.provider,
        providerUserId: schema.playerIdentities.providerUserId,
        providerUsername: schema.playerIdentities.providerUsername,
        inGuild: schema.playerIdentities.inGuild,
      })
      .from(schema.playerIdentities)
      .where(inArray(schema.playerIdentities.memberId, memberIds));

    for (const ident of identityRows) {
      if (!identitiesMap[ident.memberId]) {
        identitiesMap[ident.memberId] = [];
      }
      identitiesMap[ident.memberId].push(ident);
    }
  }

  return submittedInvites.map((invite) => {
    const draft = (invite.submissionDraft as Record<string, any> | null) ?? {};
    const memberInfo = invite.memberId ? membersMap[invite.memberId] : undefined;
    const memberIdentities = invite.memberId ? identitiesMap[invite.memberId] ?? [] : [];

    const riotIdent = memberIdentities.find((i) => i.provider === 'riot');
    const discordIdent = memberIdentities.find((i) => i.provider === 'discord');

    const ign = riotIdent?.providerUserId ?? riotIdent?.providerUsername ?? draft.ign ?? 'Pending';
    const discord = discordIdent?.providerUsername ?? memberInfo?.discord ?? draft.discord ?? 'Pending';
    const grade =
      draft.grade ??
      (memberInfo?.graduationYear ? `${memberInfo.graduationYear}th Grade` : 'N/A');

    return {
      id: invite.id,
      schoolId: invite.schoolId,
      gameId: invite.gameId,
      gameName: invite.gameName,
      gameSlug: invite.gameSlug,
      intendedFirstName: invite.intendedFirstName,
      intendedLastName: invite.intendedLastName,
      playerName: `${invite.intendedFirstName} ${invite.intendedLastName}`,
      ign,
      discord,
      grade,
      submittedAt: invite.submittedAt,
      memberId: invite.memberId,
      status: invite.status,
    };
  });
}

export interface ReviewPlayerInviteParams {
  inviteId: string;
  action: 'approve' | 'reject';
  rosterId?: string;
  role?: 'player' | 'sub' | 'captain';
  rejectionReason?: string;
}

export interface ReviewPlayerInviteResult {
  success: boolean;
  status: 'accepted' | 'rejected';
  inviteId: string;
  rejectionReason?: string;
  enrolledPlayer?: SchoolRosterPlayer;
  targetRosterId?: string;
}

/**
 * Reviews a submitted player application (approve or reject).
 * If approved: sets status to 'accepted' and assigns player to roster.
 * If rejected: sets status to 'rejected' with reason.
 * Revalidates ROSTERS, PLAYERS, TEAMS cache tags.
 */
export async function reviewPlayerInvite(
  params: ReviewPlayerInviteParams
): Promise<ReviewPlayerInviteResult> {
  const { inviteId, action, rosterId, role = 'player', rejectionReason } = params;

  if (!inviteId) {
    throw new Error('Invite ID is required');
  }

  const [invite] = await db
    .select()
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.id, inviteId))
    .limit(1);

  if (!invite) {
    throw new Error(`Invite ${inviteId} not found`);
  }

  await assertManagerForSchool(invite.schoolId, invite.gameId ?? undefined);

  if (action === 'approve') {
    await db
      .update(schema.playerInvites)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
      })
      .where(eq(schema.playerInvites.id, inviteId));

    let enrolledPlayer: SchoolRosterPlayer | undefined = undefined;
    let targetRosterId = rosterId;

    if (invite.memberId) {
      if (!targetRosterId && invite.gameId) {
        // Find existing team & roster for this school and game
        const [team] = await db
          .select({ id: schema.teams.id })
          .from(schema.teams)
          .where(
            and(
              eq(schema.teams.schoolId, invite.schoolId),
              eq(schema.teams.gameId, invite.gameId)
            )
          )
          .limit(1);

        if (team) {
          const [firstRoster] = await db
            .select({ id: schema.rosters.id })
            .from(schema.rosters)
            .where(eq(schema.rosters.teamId, team.id))
            .limit(1);
          targetRosterId = firstRoster?.id;
        }
      }

      if (targetRosterId) {
        const isCaptain = role === 'captain';

        // Check if existing player on this roster
        const [existingPlayer] = await db
          .select()
          .from(schema.players)
          .where(
            and(
              eq(schema.players.rosterId, targetRosterId),
              eq(schema.players.memberId, invite.memberId)
            )
          )
          .limit(1);

        const [riotIdentity] = await db
          .select({ providerUserId: schema.playerIdentities.providerUserId })
          .from(schema.playerIdentities)
          .where(
            and(
              eq(schema.playerIdentities.memberId, invite.memberId),
              eq(schema.playerIdentities.provider, 'riot')
            )
          )
          .limit(1);

        const draft = invite.submissionDraft as Record<string, any> | null;
        const ign = riotIdentity?.providerUserId ?? draft?.ign ?? null;

        let playerId: string;

        await db.transaction(async (tx) => {
          if (isCaptain) {
            // Demote any existing captain on this roster
            const otherCaptains = await tx
              .select()
              .from(schema.players)
              .where(
                and(
                  eq(schema.players.rosterId, targetRosterId!),
                  eq(schema.players.isCaptain, true)
                )
              );

            for (const cap of otherCaptains) {
              if (cap.memberId !== invite.memberId) {
                await tx
                  .update(schema.players)
                  .set({
                    role: 'player',
                    isCaptain: false,
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.players.id, cap.id));
              }
            }
          }

          if (!existingPlayer) {
            const [inserted] = await tx
              .insert(schema.players)
              .values({
                rosterId: targetRosterId!,
                memberId: invite.memberId!,
                role,
                ign,
                isCaptain,
              })
              .returning();
            playerId = inserted.id;
          } else {
            playerId = existingPlayer.id;
            await tx
              .update(schema.players)
              .set({
                role,
                isCaptain,
                ign: ign ?? existingPlayer.ign,
                updatedAt: new Date(),
              })
              .where(eq(schema.players.id, existingPlayer.id));
          }
        });

        const [member] = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, invite.memberId))
          .limit(1);

        const identities = await db
          .select()
          .from(schema.playerIdentities)
          .where(eq(schema.playerIdentities.memberId, invite.memberId));

        const discord = identities.find((i) => i.provider === 'discord');

        enrolledPlayer = {
          id: playerId!,
          memberId: invite.memberId,
          playerName: member ? `${member.firstName} ${member.lastName}` : `${invite.intendedFirstName} ${invite.intendedLastName}`,
          ign: ign || 'Unlinked',
          role,
          isCaptain,
          discordUsername: discord?.providerUsername || member?.discord || 'Unlinked',
          inGuild: discord?.inGuild ?? false,
          riotVerified: !!riotIdentity,
        };
      }
    }

    updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);
    return {
      success: true,
      status: 'accepted',
      inviteId,
      enrolledPlayer,
      targetRosterId: targetRosterId ?? undefined,
    };
  }

  if (action === 'reject') {
    const reason = rejectionReason?.trim() || 'Application declined by school manager';
    await db
      .update(schema.playerInvites)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(schema.playerInvites.id, inviteId));

    return {
      success: true,
      status: 'rejected',
      inviteId,
      rejectionReason: reason,
    };
  }

  throw new Error(`Invalid review action: ${action}`);
}

export interface RosterEligibilityResult {
  eligible: boolean;
  reasons: string[];
  gateChecks: {
    minSize: boolean;
    singleCaptain: boolean;
    riotLinked: boolean;
    discordLinked: boolean;
    inGuild: boolean;
  };
  stats: {
    totalPlayers: number;
    startersCount: number;
    subsCount: number;
    captainsCount: number;
    riotLinkedCount: number;
    discordLinkedCount: number;
    inGuildCount: number;
  };
  roster: {
    id: string;
    name: string;
    division: string;
  };
}

/**
 * Evaluates the 5-Point Validation Gate for tournament registration:
 * 1. Roster size meets game minimum (>= 5 starters, >= 1 sub, total >= 6).
 * 2. Exactly 1 team captain.
 * 3. 100% of players have linked Riot ID.
 * 4. 100% of players have linked Discord account.
 * 5. 100% of players have inGuild: true (present in official Discord server).
 */
export async function getRosterEligibility(params: {
  rosterId: string;
}): Promise<RosterEligibilityResult> {
  const { rosterId } = params;
  if (!rosterId) {
    throw new Error('Roster ID is required');
  }

  const { roster } = await assertManagerForRoster(rosterId);

  const rosterPlayers = await db
    .select({
      id: schema.players.id,
      rosterId: schema.players.rosterId,
      memberId: schema.players.memberId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
      ign: schema.players.ign,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
    })
    .from(schema.players)
    .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
    .where(eq(schema.players.rosterId, rosterId));

  const totalPlayers = rosterPlayers.length;
  const starters = rosterPlayers.filter(
    (p) => p.role === 'player' || p.role === 'captain' || p.isCaptain
  );
  const subs = rosterPlayers.filter((p) => p.role === 'sub');
  const captains = rosterPlayers.filter((p) => p.isCaptain || p.role === 'captain');

  const memberIds = rosterPlayers.map((p) => p.memberId);
  const identities =
    memberIds.length > 0
      ? await db
          .select()
          .from(schema.playerIdentities)
          .where(inArray(schema.playerIdentities.memberId, memberIds))
      : [];

  const riotLinkedCount = rosterPlayers.filter((p) =>
    identities.some((i) => i.memberId === p.memberId && i.provider === 'riot')
  ).length;

  const discordLinkedCount = rosterPlayers.filter((p) =>
    identities.some((i) => i.memberId === p.memberId && i.provider === 'discord')
  ).length;

  const inGuildCount = rosterPlayers.filter((p) =>
    identities.some((i) => i.memberId === p.memberId && i.provider === 'discord' && i.inGuild)
  ).length;

  const reasons: string[] = [];

  // Gate 1: Roster size (5 starters + >= 1 sub = min 6)
  const minSizePass = totalPlayers >= 6 && starters.length >= 5 && subs.length >= 1;
  if (!minSizePass) {
    if (totalPlayers < 6) {
      reasons.push(`Roster size must be at least 6 players (currently ${totalPlayers})`);
    } else if (starters.length < 5) {
      reasons.push(`Roster must have at least 5 starters (currently ${starters.length})`);
    } else if (subs.length < 1) {
      reasons.push('Roster must have at least 1 substitute player');
    }
  }

  // Gate 2: Exactly 1 captain
  const singleCaptainPass = captains.length === 1;
  if (!singleCaptainPass) {
    if (captains.length === 0) {
      reasons.push('Roster must have exactly 1 designated captain (currently 0)');
    } else {
      reasons.push(`Roster must have exactly 1 designated captain (currently ${captains.length})`);
    }
  }

  // Gate 3: 100% Riot ID verified
  const riotPass = totalPlayers > 0 && riotLinkedCount === totalPlayers;
  if (!riotPass) {
    const missing = totalPlayers - riotLinkedCount;
    reasons.push(`100% of players must have a linked Riot ID (${missing} unlinked)`);
  }

  // Gate 4: 100% Discord linked
  const discordPass = totalPlayers > 0 && discordLinkedCount === totalPlayers;
  if (!discordPass) {
    const missing = totalPlayers - discordLinkedCount;
    reasons.push(`100% of players must have a linked Discord account (${missing} unlinked)`);
  }

  // Gate 5: 100% In-Guild
  const inGuildPass = totalPlayers > 0 && inGuildCount === totalPlayers;
  if (!inGuildPass) {
    const missing = totalPlayers - inGuildCount;
    reasons.push(
      `100% of players must be present in the official Discord server (${missing} not in server)`
    );
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    reasons,
    gateChecks: {
      minSize: minSizePass,
      singleCaptain: singleCaptainPass,
      riotLinked: riotPass,
      discordLinked: discordPass,
      inGuild: inGuildPass,
    },
    stats: {
      totalPlayers,
      startersCount: starters.length,
      subsCount: subs.length,
      captainsCount: captains.length,
      riotLinkedCount,
      discordLinkedCount,
      inGuildCount,
    },
    roster: {
      id: roster.id,
      name: roster.name,
      division: roster.division,
    },
  };
}

export interface EmergencySwapSubParams {
  rosterId: string;
  outPlayerId: string;
  inPlayerId: string;
}

export interface EmergencySwapSubResult {
  success: boolean;
  swapped: {
    outPlayerId: string;
    inPlayerId: string;
  };
}

/**
 * Performs a match-day emergency substitution between a starter/captain and a bench sub.
 * Validates player roles, performs an atomic role swap in DB, and invalidates cache tags.
 */
export async function emergencySwapSub(
  params: EmergencySwapSubParams
): Promise<EmergencySwapSubResult> {
  const { rosterId, outPlayerId, inPlayerId } = params;

  if (!rosterId || !outPlayerId || !inPlayerId) {
    throw new Error('rosterId, outPlayerId, and inPlayerId are required');
  }

  if (outPlayerId === inPlayerId) {
    throw new Error('Cannot swap a player with themselves');
  }

  await assertManagerForRoster(rosterId);

  const [outPlayer] = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.id, outPlayerId), eq(schema.players.rosterId, rosterId)))
    .limit(1);

  const [inPlayer] = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.id, inPlayerId), eq(schema.players.rosterId, rosterId)))
    .limit(1);

  if (!outPlayer || !inPlayer) {
    throw new Error('Both players must exist on the specified roster');
  }

  const isOutStarter =
    outPlayer.role === 'player' || outPlayer.role === 'captain' || outPlayer.isCaptain;
  if (!isOutStarter || outPlayer.role === 'sub') {
    throw new Error('Player to swap out must be an active starter or captain, not a sub');
  }

  if (inPlayer.role !== 'sub') {
    throw new Error('Player to swap in must be an active substitute');
  }

  await db.transaction(async (tx) => {
    const prevOutRole = outPlayer.role;
    const prevOutCaptain = outPlayer.isCaptain;

    // Demote starter to sub first to avoid uniqueIndex('players_roster_one_captain_idx') collision
    await tx
      .update(schema.players)
      .set({
        role: 'sub',
        isCaptain: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, outPlayerId));

    // Promote sub to previous starter's role
    await tx
      .update(schema.players)
      .set({
        role: prevOutRole === 'captain' ? 'captain' : 'player',
        isCaptain: prevOutCaptain,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, inPlayerId));
  });

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);

  return {
    success: true,
    swapped: {
      outPlayerId,
      inPlayerId,
    },
  };
}

export interface SchoolRosterPlayer {
  id: string;
  memberId: string;
  playerName: string;
  ign: string;
  role: string;
  isCaptain: boolean;
  discordUsername: string;
  inGuild: boolean;
  riotVerified: boolean;
}

export interface SchoolRosterDetails {
  id: string;
  teamId: string;
  name: string;
  division: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  players: SchoolRosterPlayer[];
}

/**
 * Fetches all rosters with detailed player status for a school and optional game.
 */
export async function getSchoolRosters(
  schoolId: string,
  gameId?: string
): Promise<SchoolRosterDetails[]> {
  await assertManagerForSchool(schoolId, gameId);

  const whereConditions = [eq(schema.teams.schoolId, schoolId)];
  if (gameId) {
    whereConditions.push(eq(schema.teams.gameId, gameId));
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

  if (schoolTeams.length === 0) {
    return [];
  }

  const teamIds = schoolTeams.map((t) => t.id);
  const teamRosters = await db
    .select()
    .from(schema.rosters)
    .where(inArray(schema.rosters.teamId, teamIds));

  if (teamRosters.length === 0) {
    return [];
  }

  const rosterIds = teamRosters.map((r) => r.id);
  const playersList = await db
    .select({
      id: schema.players.id,
      rosterId: schema.players.rosterId,
      memberId: schema.players.memberId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
      ign: schema.players.ign,
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
    const rPlayers: SchoolRosterPlayer[] = playersList
      .filter((p) => p.rosterId === roster.id)
      .map((p) => {
        const riot = identities.find((i) => i.memberId === p.memberId && i.provider === 'riot');
        const discord = identities.find(
          (i) => i.memberId === p.memberId && i.provider === 'discord'
        );
        return {
          id: p.id,
          memberId: p.memberId,
          playerName: `${p.firstName} ${p.lastName}`,
          ign: p.ign || riot?.providerUserId || 'Unlinked',
          role: p.role,
          isCaptain: p.isCaptain,
          discordUsername: discord?.providerUsername || p.discord || 'Unlinked',
          inGuild: discord?.inGuild ?? false,
          riotVerified: !!riot,
        };
      });

    return {
      id: roster.id,
      teamId: roster.teamId,
      name: roster.name,
      division: roster.division,
      gameId: team?.gameId ?? '',
      gameName: team?.gameName ?? '',
      gameSlug: team?.gameSlug ?? '',
      players: rPlayers,
    };
  });
}

export interface SchoolPoolPlayer {
  memberId: string;
  firstName: string;
  lastName: string;
  playerName: string;
  ign: string;
  discordUsername: string;
  inGuild: boolean;
  riotVerified: boolean;
  graduationYear: number | null;
  enrolledRosters: Array<{
    rosterId: string;
    rosterName: string;
    gameName: string;
    role: string;
    isCaptain: boolean;
  }>;
}

/**
 * Returns the pool of all verified/onboarded players belonging to the school.
 * Maintains Zero-PII Invariant: does NOT expose any sensitive demographics.
 */
export async function getSchoolPlayerPool(
  schoolId: string,
  gameId?: string
): Promise<SchoolPoolPlayer[]> {
  await assertManagerForSchool(schoolId, gameId);

  const schoolMembers = await db
    .select({
      id: schema.members.id,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      discord: schema.members.discord,
      graduationYear: schema.members.graduationYear,
    })
    .from(schema.members)
    .where(eq(schema.members.schoolId, schoolId))
    .orderBy(desc(schema.members.createdAt));

  if (schoolMembers.length === 0) {
    return [];
  }

  const memberIds = schoolMembers.map((m) => m.id);

  const identities = await db
    .select()
    .from(schema.playerIdentities)
    .where(inArray(schema.playerIdentities.memberId, memberIds));

  // Query roster enrollments
  const playerRows = await db
    .select({
      memberId: schema.players.memberId,
      rosterId: schema.players.rosterId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
      rosterName: schema.rosters.name,
      gameName: schema.games.displayName,
    })
    .from(schema.players)
    .innerJoin(schema.rosters, eq(schema.players.rosterId, schema.rosters.id))
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(inArray(schema.players.memberId, memberIds));

  // Fetch invite drafts for fallback IGNs
  const invites = await db
    .select({
      memberId: schema.playerInvites.memberId,
      draft: schema.playerInvites.submissionDraft,
    })
    .from(schema.playerInvites)
    .where(
      and(
        eq(schema.playerInvites.schoolId, schoolId),
        inArray(schema.playerInvites.memberId, memberIds)
      )
    );

  const invitesDraftMap = new Map<string, any>();
  for (const inv of invites) {
    if (inv.memberId && inv.draft) {
      invitesDraftMap.set(inv.memberId, inv.draft);
    }
  }

  return schoolMembers.map((m) => {
    const memberIdentities = identities.filter((i) => i.memberId === m.id);
    const riot = memberIdentities.find((i) => i.provider === 'riot');
    const discord = memberIdentities.find((i) => i.provider === 'discord');
    const draft = invitesDraftMap.get(m.id);

    const ign = riot?.providerUserId || riot?.providerUsername || draft?.ign || 'Unlinked';
    const discordUsername = discord?.providerUsername || m.discord || draft?.discord || 'Unlinked';

    const memberRosters = playerRows
      .filter((p) => p.memberId === m.id)
      .map((p) => ({
        rosterId: p.rosterId,
        rosterName: p.rosterName,
        gameName: p.gameName,
        role: p.role,
        isCaptain: p.isCaptain,
      }));

    return {
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      playerName: `${m.firstName} ${m.lastName}`,
      ign,
      discordUsername,
      inGuild: discord?.inGuild ?? false,
      riotVerified: !!riot,
      graduationYear: m.graduationYear,
      enrolledRosters: memberRosters,
    };
  });
}

export interface EnrollPlayerToRosterParams {
  rosterId: string;
  memberId: string;
  role?: 'player' | 'sub' | 'captain';
  ign?: string;
}

export interface EnrollPlayerToRosterResult {
  success: boolean;
  player: SchoolRosterPlayer;
  message?: string;
}

/**
 * Enrolls an existing school player/member directly onto a specific team roster.
 * Enforces manager authorization, school tenancy, role assignment, and captain uniqueness.
 */
export async function enrollPlayerToRoster(
  params: EnrollPlayerToRosterParams
): Promise<EnrollPlayerToRosterResult> {
  const { rosterId, memberId, ign: customIgn } = params;
  const role = params.role || 'player';

  if (!rosterId || !memberId) {
    throw new Error('rosterId and memberId are required');
  }

  // 1. Manager authorization check
  const { roster, team } = await assertManagerForRoster(rosterId);

  // 2. Tenancy check: Verify member belongs to this school
  const [member] = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .limit(1);

  if (!member) {
    throw new Error(`Member ${memberId} not found`);
  }

  if (member.schoolId !== team.schoolId) {
    throw new Error('Member does not belong to the school managing this roster');
  }

  // 3. Resolve IGN from Riot identity or draft if not passed
  let ign = customIgn?.trim();
  if (!ign) {
    const [riotIdentity] = await db
      .select({ providerUserId: schema.playerIdentities.providerUserId })
      .from(schema.playerIdentities)
      .where(
        and(
          eq(schema.playerIdentities.memberId, memberId),
          eq(schema.playerIdentities.provider, 'riot')
        )
      )
      .limit(1);

    if (riotIdentity?.providerUserId) {
      ign = riotIdentity.providerUserId;
    } else {
      // Check playerInvites submissionDraft
      const [invite] = await db
        .select({ draft: schema.playerInvites.submissionDraft })
        .from(schema.playerInvites)
        .where(eq(schema.playerInvites.memberId, memberId))
        .orderBy(desc(schema.playerInvites.createdAt))
        .limit(1);

      const draft = invite?.draft as Record<string, any> | null;
      ign = draft?.ign ?? `${member.firstName} ${member.lastName}`;
    }
  }

  const isCaptain = role === 'captain';

  // 4. Handle Captain constraint or role conflicts
  const [existingPlayer] = await db
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

  await db.transaction(async (tx) => {
    if (isCaptain) {
      // Demote existing captain on this roster (if another player was captain)
      const otherCaptains = await tx
        .select()
        .from(schema.players)
        .where(
          and(
            eq(schema.players.rosterId, rosterId),
            eq(schema.players.isCaptain, true)
          )
        );

      for (const cap of otherCaptains) {
        if (cap.memberId !== memberId) {
          await tx
            .update(schema.players)
            .set({
              role: 'player',
              isCaptain: false,
              updatedAt: new Date(),
            })
            .where(eq(schema.players.id, cap.id));
        }
      }
    }

    if (existingPlayer) {
      playerId = existingPlayer.id;
      await tx
        .update(schema.players)
        .set({
          role,
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
          role,
          ign: ign || null,
          isCaptain,
        })
        .returning();
      playerId = inserted.id;
    }
  });

  // 5. Build SchoolRosterPlayer return object
  const identities = await db
    .select()
    .from(schema.playerIdentities)
    .where(eq(schema.playerIdentities.memberId, memberId));

  const riot = identities.find((i) => i.provider === 'riot');
  const discord = identities.find((i) => i.provider === 'discord');

  const rosterPlayer: SchoolRosterPlayer = {
    id: playerId!,
    memberId: member.id,
    playerName: `${member.firstName} ${member.lastName}`,
    ign: ign || riot?.providerUserId || 'Unlinked',
    role,
    isCaptain,
    discordUsername: discord?.providerUsername || member.discord || 'Unlinked',
    inGuild: discord?.inGuild ?? false,
    riotVerified: !!riot,
  };

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);

  return {
    success: true,
    player: rosterPlayer,
    message: `${member.firstName} ${member.lastName} enrolled to ${roster.name} as ${
      role === 'captain' ? 'Captain' : role === 'sub' ? 'Substitute' : 'Starter'
    }`,
  };
}

export interface RemovePlayerFromRosterParams {
  rosterId: string;
  playerId: string;
}

/**
 * Removes a player from a roster.
 */
export async function removePlayerFromRoster(
  params: RemovePlayerFromRosterParams
): Promise<{ success: boolean; playerId: string }> {
  const { rosterId, playerId } = params;

  if (!rosterId || !playerId) {
    throw new Error('rosterId and playerId are required');
  }

  await assertManagerForRoster(rosterId);

  await db
    .delete(schema.players)
    .where(
      and(
        eq(schema.players.id, playerId),
        eq(schema.players.rosterId, rosterId)
      )
    );

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);

  return { success: true, playerId };
}

export interface UpdateRosterPlayerRoleParams {
  rosterId: string;
  playerId: string;
  role: 'player' | 'sub' | 'captain';
}

/**
 * Updates a player's role on a roster (Starter, Sub, or Captain).
 * Safely handles single-captain constraint with automatic promotion/demotion.
 */
export async function updateRosterPlayerRole(
  params: UpdateRosterPlayerRoleParams
): Promise<{ success: boolean; playerId: string; role: string; isCaptain: boolean }> {
  const { rosterId, playerId, role } = params;

  if (!rosterId || !playerId || !role) {
    throw new Error('rosterId, playerId, and role are required');
  }

  await assertManagerForRoster(rosterId);

  const [targetPlayer] = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.id, playerId), eq(schema.players.rosterId, rosterId)))
    .limit(1);

  if (!targetPlayer) {
    throw new Error(`Player ${playerId} not found on roster`);
  }

  const isCaptain = role === 'captain';

  await db.transaction(async (tx) => {
    if (isCaptain) {
      // Demote any existing captain on this roster
      const currentCaptains = await tx
        .select()
        .from(schema.players)
        .where(
          and(
            eq(schema.players.rosterId, rosterId),
            eq(schema.players.isCaptain, true)
          )
        );

      for (const cap of currentCaptains) {
        if (cap.id !== playerId) {
          await tx
            .update(schema.players)
            .set({
              role: 'player',
              isCaptain: false,
              updatedAt: new Date(),
            })
            .where(eq(schema.players.id, cap.id));
        }
      }
    }

    await tx
      .update(schema.players)
      .set({
        role,
        isCaptain,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, playerId));
  });

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);

  return {
    success: true,
    playerId,
    role,
    isCaptain,
  };
}
