'use server';

import crypto from 'node:crypto';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, or, desc, inArray, type SQL } from 'drizzle-orm';
import {
  assertManagerForSchool,
  assertManagerForSchoolGame,
  assertManagerForRoster,
  assertSeasonRostersUnlocked,
  getAuthorizedGameScopes,
  getActiveSeasonForGame,
  NO_ACTIVE_SEASON_ERROR,
  type AuthorizedGameScope,
} from './manager-auth';
import { isEligibleForSeason, notEligibleForSeasonError } from '@/app/lib/season-name';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';
import { DEFAULT_INVITE_EXPIRY_DAYS, INVITE_EXPIRY_DAYS, isInviteExpiryDays } from './invite-expiry';
import { lockRoster, lockRosterMember, rosterPlayerRoles, siblingEnrollment } from '@/app/lib/db/roster-scope';
import { occupancyOf, rosterCapacityError } from './roster-limits';
import { notifyRosterMembershipChanged } from './roster-membership-events';
import { removalCacheTags, removalNotice, removePlayerFromRosterTx } from '@/app/lib/db/roster-removal';
import { getSchoolMatchRows } from '@/app/lib/db/matches';
import { getOutcomesPublicSeasonIds } from '@/app/lib/db/standings';
import {
  getLatestRescheduleRequests,
  getRescheduledFrom,
  getSeasonsWithRescheduleAllowanceUsed,
} from '@/app/lib/db/reschedules';
import { getGameCounts, getPendingSubmissions as getPendingMatchResults, type PendingSubmissionItem } from '@/app/lib/db/match-results';
import type { RescheduleRequestItem } from '@/app/lib/reschedule-rules';
import { redactHiddenMatches } from '@/app/lib/season-outcomes';
import { toSchoolMatchItem, type SchoolMatchItem } from '@/app/lib/school-matches';

/**
 * Tells the roster-membership seam about members whose roster changed. Call it only AFTER the
 * transaction has committed; the change is already durable, so a failing consumer must never
 * turn a successful action into an error.
 */
async function notifyMembershipChanged(memberIds: string[]): Promise<void> {
  try {
    await notifyRosterMembershipChanged(memberIds);
  } catch (error) {
    console.error(
      'notifyRosterMembershipChanged failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
  }
}

/**
 * A known, user-facing rejection of a roster action. Returned instead of thrown because Next.js
 * omits the message of an error thrown from a server action in production, so a thrown rejection
 * reaches the manager as a generic failure. Unexpected errors still throw.
 */
export interface RosterActionRejection {
  success: false;
  error: string;
}

function reject(error: string): RosterActionRejection {
  return { success: false, error };
}

/** The league rule (one tier per game) as shown to a manager. */
function siblingConflictMessage(playerName: string, onRoster: string, targetRoster: string): string {
  return `${playerName} is already on ${onRoster}. Use Move to put them on ${targetRoster}.`;
}

/** Name of the season a team plays in; the caller's already-resolved season is the fallback. */
async function seasonNameOf(seasonId: string, known: { id: string; name: string } | null): Promise<string | null> {
  if (known?.id === seasonId) return known.name;
  const [season] = await db
    .select({ name: schema.seasons.name })
    .from(schema.seasons)
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);
  return season?.name ?? null;
}

/**
 * Season-eligibility refusal for enrolling a member into a roster of the named season (spec-046),
 * or null when allowed. One rule for every portal enrollment path; see `isEligibleForSeason`.
 */
function seasonIneligibility(
  member: { graduationYear: number | null },
  playerName: string,
  seasonName: string | null
): string | null {
  if (!seasonName || member.graduationYear == null) return null;
  if (isEligibleForSeason(member.graduationYear, seasonName)) return null;
  return notEligibleForSeasonError(playerName, member.graduationYear, seasonName);
}

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
 * Asserts school (and optional game) authorization and resolves which games' seasons (the
 * manager's own, matched by name; spec-026) the caller may read. `scopes` is null for a staff admin (unrestricted, all seasons).
 */
async function resolveManagerScope(
  schoolId: string,
  gameId?: string
): Promise<{ scopes: AuthorizedGameScope[] | null }> {
  // Reads: an inactive (view-only) season stays readable (spec-028).
  const context = await assertManagerForSchool(schoolId, gameId, { allowInactive: true });
  const scopes = await getAuthorizedGameScopes(context, schoolId);
  return { scopes };
}

/**
 * Restricts invite queries to the manager's own season of each game (spec-046): an invite is
 * visible only when its `season_id` is the manager's resolved season for its game. Legacy invites
 * with no season never match, so they stay hidden from managers. Staff admins (scopes === null)
 * get no condition.
 */
function inviteSeasonCondition(scopes: AuthorizedGameScope[] | null): SQL | undefined {
  if (!scopes) return undefined;
  return or(
    ...scopes.map((s) =>
      and(eq(schema.playerInvites.gameId, s.gameId), eq(schema.playerInvites.seasonId, s.seasonId))
    )
  );
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

  if (expiresInDays !== undefined && !isInviteExpiryDays(expiresInDays)) {
    throw new Error(`Invite duration must be one of ${INVITE_EXPIRY_DAYS.join(', ')} days`);
  }

  // Mutation: refused on an inactive (view-only) season by default (spec-028).
  const { context, season: managerSeason } = await assertManagerForSchoolGame(schoolId, gameId);
  // The invite is stamped with the season it is issued for: a manager's own (necessarily active)
  // season, or for a staff admin the game's active season. Without one the invite could never be
  // shown to or approved by a manager, so creation is refused.
  const inviteSeason = managerSeason ?? (await getActiveSeasonForGame(gameId));
  if (!inviteSeason) throw new Error(NO_ACTIVE_SEASON_ERROR);

  const { token, tokenHash } = await generateInviteToken();
  const days = expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const [inserted] = await db
    .insert(schema.playerInvites)
    .values({
      schoolId,
      gameId,
      seasonId: inviteSeason.id,
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
  const { scopes } = await resolveManagerScope(schoolId, gameId);
  if (scopes && scopes.length === 0) return [];

  const whereConditions = [eq(schema.playerInvites.schoolId, schoolId)];
  if (gameId) {
    whereConditions.push(eq(schema.playerInvites.gameId, gameId));
  }
  // A manager sees only invites of their own season of each game (spec-046); staff see all.
  const seasonCondition = inviteSeasonCondition(scopes);
  if (seasonCondition) whereConditions.push(seasonCondition);

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

/** Invites are limited to the pending state: later states carry a review trail or a student record. */
const INVITE_NOT_PENDING_ERROR = 'Only pending invites can be changed. This invite has already been submitted or reviewed.';

/**
 * An expected refusal, returned (not thrown) because Next redacts thrown messages in production.
 * `status` is the invite's current state when it still exists and `null` when it is gone, so the
 * portal can correct its stale row.
 */
export interface InviteActionRejection {
  success: false;
  error: string;
  status: string | null;
}

function inviteRejection(error: string, status: string | null): InviteActionRejection {
  return { success: false, error, status };
}

/**
 * Loads an invite and authorizes the caller as a manager of its school and game (mutation guard:
 * refuses an inactive season, spec-028). The invite's own school and game are authoritative, never
 * values supplied by the client, so an id from another school is refused as Forbidden.
 */
async function authorizeInviteMutation(inviteId: string) {
  if (!inviteId) return inviteRejection('inviteId is required', null);
  const [invite] = await db
    .select({
      id: schema.playerInvites.id,
      schoolId: schema.playerInvites.schoolId,
      gameId: schema.playerInvites.gameId,
      status: schema.playerInvites.status,
    })
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.id, inviteId))
    .limit(1);
  if (!invite) return inviteRejection('Invite not found. It may have been deleted already.', null);
  try {
    await assertManagerForSchool(invite.schoolId, invite.gameId);
  } catch (err) {
    // Authorization refusals are expected outcomes; the status is withheld from a caller who may
    // not act on this invite at all.
    return inviteRejection(err instanceof Error ? err.message : 'Not authorized', 'forbidden');
  }
  if (invite.status !== 'pending') return inviteRejection(INVITE_NOT_PENDING_ERROR, invite.status);
  return invite;
}

/** Re-reads the status after a conditional write matched nothing (a concurrent change won). */
async function rejectLostRace(inviteId: string): Promise<InviteActionRejection> {
  const [current] = await db
    .select({ status: schema.playerInvites.status })
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.id, inviteId))
    .limit(1);
  return inviteRejection(
    current ? INVITE_NOT_PENDING_ERROR : 'Invite not found. It may have been deleted already.',
    current?.status ?? null
  );
}

export interface RegeneratePlayerInviteLinkSuccess {
  success: true;
  inviteId: string;
  inviteUrl: string;
  expiresAt: Date;
}

/**
 * Issues a fresh link for a pending invite. Only the token hash is stored, so the original link
 * cannot be recovered; instead the old token is replaced (and so stops working) and the new one is
 * returned once for the caller to copy. The new link lives the maximum allowed time
 * (DEFAULT_INVITE_EXPIRY_DAYS), which also renews an invite whose time had run out. The update is
 * conditional on the invite still being pending, so a concurrent submission cannot be clobbered.
 * Invites are read uncached, so no cache tag is involved.
 */
export async function regeneratePlayerInviteLink(
  inviteId: string
): Promise<RegeneratePlayerInviteLinkSuccess | InviteActionRejection> {
  const invite = await authorizeInviteMutation(inviteId);
  if ('success' in invite) return invite;

  const { token, tokenHash } = await generateInviteToken();
  const expiresAt = new Date(Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(schema.playerInvites)
    .set({ tokenHash, expiresAt })
    .where(
      and(
        eq(schema.playerInvites.id, invite.id),
        eq(schema.playerInvites.schoolId, invite.schoolId),
        eq(schema.playerInvites.status, 'pending')
      )
    )
    .returning({ id: schema.playerInvites.id });
  if (!updated) return rejectLostRace(invite.id);

  const [school] = await db
    .select({ slug: schema.schools.slug })
    .from(schema.schools)
    .where(eq(schema.schools.id, invite.schoolId))
    .limit(1);
  const [game] = await db
    .select({ slug: schema.games.slug })
    .from(schema.games)
    .where(eq(schema.games.id, invite.gameId))
    .limit(1);

  return {
    success: true,
    inviteId: invite.id,
    inviteUrl: `/join/${school?.slug ?? invite.schoolId}/${game?.slug ?? invite.gameId}?token=${token}`,
    expiresAt,
  };
}

/**
 * Deletes a pending invite, which invalidates its link. Submitted, accepted and rejected invites
 * are kept: they are the audit trail of a student's onboarding. Conditional on the pending status
 * so a submission that lands first wins.
 */
export async function deletePlayerInvite(
  inviteId: string
): Promise<{ success: true; inviteId: string } | InviteActionRejection> {
  const invite = await authorizeInviteMutation(inviteId);
  if ('success' in invite) return invite;

  const deleted = await db
    .delete(schema.playerInvites)
    .where(
      and(
        eq(schema.playerInvites.id, invite.id),
        eq(schema.playerInvites.schoolId, invite.schoolId),
        eq(schema.playerInvites.status, 'pending')
      )
    )
    .returning({ id: schema.playerInvites.id });
  if (deleted.length === 0) return rejectLostRace(invite.id);

  return { success: true, inviteId: invite.id };
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
  const { scopes } = await resolveManagerScope(schoolId, gameId);
  if (scopes && scopes.length === 0) return [];

  const whereConditions = [
    eq(schema.playerInvites.schoolId, schoolId),
    eq(schema.playerInvites.status, 'submitted'),
  ];
  if (gameId) {
    whereConditions.push(eq(schema.playerInvites.gameId, gameId));
  }
  const seasonCondition = inviteSeasonCondition(scopes);
  if (seasonCondition) whereConditions.push(seasonCondition);

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
      (memberInfo?.graduationYear ? `Class of ${memberInfo.graduationYear}` : 'N/A');

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

const NOT_REVIEWABLE_MESSAGE = 'This application was already reviewed or has not been submitted yet. Refresh the page.';

export interface ReviewPlayerInviteParams {
  inviteId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export interface ReviewPlayerInviteSuccess {
  success: true;
  status: 'accepted' | 'rejected';
  inviteId: string;
  rejectionReason?: string;
}

export type ReviewPlayerInviteResult = ReviewPlayerInviteSuccess | RosterActionRejection;

/**
 * Reviews a submitted player application (approve or reject).
 * Approve only ACCEPTS the student: it never picks or defaults a roster. An accepted student is
 * then enrolled onto any roster of the game and season through `enrollPlayerToRoster`, which
 * applies the roster lock, size caps, one-tier-per-game and season-eligibility rules.
 * Reject sets status 'rejected' with a reason.
 *
 * A manager may review only invites of their own season (spec-046) and, being a mutation, not on an
 * inactive season (spec-028). Staff admins may review any invite. Because nothing is put on a
 * roster, the season roster lock does not apply to reviewing.
 */
export async function reviewPlayerInvite(
  params: ReviewPlayerInviteParams
): Promise<ReviewPlayerInviteResult> {
  const { inviteId, action, rejectionReason } = params;

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

  const { context: reviewContext, season: managerSeason } = invite.gameId
    ? await assertManagerForSchoolGame(invite.schoolId, invite.gameId)
    : { context: await assertManagerForSchool(invite.schoolId), season: null };
  // Without a game there is no season to match, so only staff admins may review it.
  if (!invite.gameId && !reviewContext.isStaffAdmin) {
    throw new Error('Forbidden: This invite is not tied to a game in your season');
  }

  // A manager reviews only invites of their own season (spec-046); a legacy invite with no season
  // never matches. Staff admins review any invite.
  if (!reviewContext.isStaffAdmin && (!managerSeason || invite.seasonId !== managerSeason.id)) {
    throw new Error('Forbidden: This invite belongs to a different season than your manager affiliation and cannot be reviewed from the portal');
  }

  // Only a submitted application can be reviewed, and exactly once: the status is part of the
  // UPDATE's WHERE, so two clicks (or two managers) cannot both succeed or flip a decided invite.
  const onlySubmitted = and(
    eq(schema.playerInvites.id, inviteId),
    eq(schema.playerInvites.status, 'submitted')
  );

  if (action === 'approve') {
    if (!invite.memberId) return reject(NOT_REVIEWABLE_MESSAGE);
    const updated = await db
      .update(schema.playerInvites)
      .set({ status: 'accepted', reviewedAt: new Date() })
      .where(onlySubmitted)
      .returning({ id: schema.playerInvites.id });
    if (updated.length === 0) return reject(NOT_REVIEWABLE_MESSAGE);

    updateCacheTags(CACHE_TAGS.PLAYERS);
    return { success: true, status: 'accepted', inviteId };
  }

  if (action === 'reject') {
    const reason = rejectionReason?.trim() || 'Application declined by school manager';
    const updated = await db
      .update(schema.playerInvites)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(onlySubmitted)
      .returning({ id: schema.playerInvites.id });
    if (updated.length === 0) return reject(NOT_REVIEWABLE_MESSAGE);

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

  const { roster } = await assertManagerForRoster(rosterId, { allowLocked: true, allowInactive: true });

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
  await notifyMembershipChanged([outPlayer.memberId, inPlayer.memberId]);

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
  seasonId: string;
  seasonName: string;
  name: string;
  division: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  players: SchoolRosterPlayer[];
}

/**
 * A school's matches (either side) for the portal's Matches section. A manager sees only each
 * managed game's resolved season (matched by name; spec-026), including a view-only one
 * (spec-028), and never a score or forfeit flag from a season staff have not published
 * (spec-022); a staff admin sees every season, unredacted.
 */
export async function getSchoolMatches(
  schoolId: string,
  gameId?: string
): Promise<SchoolMatchItem[]> {
  const { scopes } = await resolveManagerScope(schoolId, gameId);
  if (scopes && scopes.length === 0) return [];

  const rows = await getSchoolMatchRows({
    schoolId,
    gameId,
    seasonIds: scopes ? scopes.map((s) => s.seasonId) : undefined,
  });
  const visible = scopes
    ? redactHiddenMatches(rows, await getOutcomesPublicSeasonIds())
    : rows;
  // Fail soft: the schedule must still show if the reschedule lookups fail.
  const ids = visible.map((row) => row.id);
  const [requests, movedFrom, allowanceUsed, gameCounts, pendingResults] = await Promise.all([
    getLatestRescheduleRequests(ids).catch((error) => {
      console.error('Failed to load reschedule requests', error);
      return new Map<string, RescheduleRequestItem>();
    }),
    getRescheduledFrom(ids).catch((error) => {
      console.error('Failed to load rescheduled matches', error);
      return new Map<string, string>();
    }),
    getSeasonsWithRescheduleAllowanceUsed(schoolId, [...new Set(visible.map((row) => row.seasonId))]).catch(
      (error) => {
        console.error('Failed to load reschedule allowances', error);
        return new Set<string>();
      }
    ),
    getGameCounts(ids).catch((error) => {
      console.error('Failed to load match game counts', error);
      return new Map<string, number>();
    }),
    getPendingMatchResults(ids).catch((error) => {
      console.error('Failed to load pending match results', error);
      return new Map<string, PendingSubmissionItem>();
    }),
  ]);
  return visible.map((row) => {
    const pending = pendingResults.get(row.id);
    const item = toSchoolMatchItem(row, schoolId, requests.get(row.id) ?? null, movedFrom.get(row.id) ?? null, {
      gameCount: gameCounts.get(row.id) ?? 0,
      pending: pending
        ? { retryAfter: pending.retryAfter, message: pending.message, gameCount: pending.storedCount }
        : null,
    });
    return { ...item, rescheduleAllowanceUsed: allowanceUsed.has(row.seasonId) };
  });
}

/**
 * Fetches all rosters with detailed player status for a school and optional game.
 */
export async function getSchoolRosters(
  schoolId: string,
  gameId?: string
): Promise<SchoolRosterDetails[]> {
  const { scopes } = await resolveManagerScope(schoolId, gameId);
  if (scopes && scopes.length === 0) return [];

  const whereConditions = [eq(schema.teams.schoolId, schoolId)];
  if (gameId) {
    whereConditions.push(eq(schema.teams.gameId, gameId));
  }
  // A manager sees only the rosters of each managed game's resolved season (matched by name); staff admins see all.
  if (scopes) {
    whereConditions.push(inArray(schema.teams.seasonId, scopes.map((g) => g.seasonId)));
  }

  const schoolTeams = await db
    .select({
      id: schema.teams.id,
      schoolId: schema.teams.schoolId,
      gameId: schema.teams.gameId,
      seasonId: schema.teams.seasonId,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.teams)
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(and(...whereConditions));

  if (schoolTeams.length === 0) {
    return [];
  }

  const seasonIds = [...new Set(schoolTeams.map((t) => t.seasonId))];
  const seasonRows = await db
    .select({ id: schema.seasons.id, name: schema.seasons.name })
    .from(schema.seasons)
    .where(inArray(schema.seasons.id, seasonIds));
  const seasonNames = new Map(seasonRows.map((r) => [r.id, r.name]));

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
      seasonId: team?.seasonId ?? '',
      seasonName: (team && seasonNames.get(team.seasonId)) ?? '',
      name: roster.name,
      division: roster.division,
      gameId: team?.gameId ?? '',
      gameName: team?.gameName ?? '',
      gameSlug: team?.gameSlug ?? '',
      players: rPlayers,
    };
  });
}

export interface CreateSchoolRosterParams {
  schoolId: string;
  gameId: string;
  name: string;
  division?: string;
}

export interface CreateSchoolRosterResult {
  success: boolean;
  roster: SchoolRosterDetails;
  message?: string;
}

/**
 * Creates a new competition roster for a school and game directly from the School Manager Portal.
 * A manager creates in their resolved season for the game (matched by name; it may be inactive but
 * must exist, never auto-created); a staff admin creates in the game's active season. The season's
 * team record is found or created on demand.
 */
export async function createSchoolRoster(
  params: CreateSchoolRosterParams
): Promise<CreateSchoolRosterResult> {
  const { schoolId, gameId } = params;
  const name = (params.name || '').trim();
  const division = (params.division || 'A').trim();

  if (!schoolId || !gameId) {
    throw new Error('School ID and Game ID are required');
  }

  if (!name) {
    throw new Error('Roster name is required (e.g. "Varsity")');
  }

  if (name.length > 50) {
    throw new Error('Roster name must be 50 characters or less');
  }

  // 1. Manager authorization and tenancy check
  const { context: createContext, season: managerSeason } = await assertManagerForSchoolGame(
    schoolId,
    gameId
  );

  // 2. Fetch game details
  const [game] = await db
    .select({
      id: schema.games.id,
      displayName: schema.games.displayName,
      slug: schema.games.slug,
    })
    .from(schema.games)
    .where(eq(schema.games.id, gameId))
    .limit(1);

  if (!game) {
    throw new Error(`Game ${gameId} not found`);
  }

  // 3. A manager creates in their resolved season (matched by name, active or not; it must
  // already exist). A staff admin creates in the game's active season. No fallback or
  // auto-creation either way.
  const season = managerSeason ?? (await getActiveSeasonForGame(gameId));
  if (!season) {
    throw new Error(`${NO_ACTIVE_SEASON_ERROR}.`);
  }
  assertSeasonRostersUnlocked(createContext, season);

  // 4. Find or create the Team for (schoolId, gameId, season.id)
  let [team] = await db
    .select()
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.schoolId, schoolId),
        eq(schema.teams.gameId, gameId),
        eq(schema.teams.seasonId, season.id)
      )
    )
    .limit(1);

  if (!team) {
    const [newTeam] = await db
      .insert(schema.teams)
      .values({
        schoolId,
        gameId,
        seasonId: season.id,
      })
      .returning();
    team = newTeam;
  }

  // 5. Create Roster
  const [roster] = await db
    .insert(schema.rosters)
    .values({
      teamId: team.id,
      name,
      division,
    })
    .returning();

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.TEAMS);

  const rosterDetails: SchoolRosterDetails = {
    id: roster.id,
    teamId: team.id,
    seasonId: season.id,
    seasonName: season.name,
    name: roster.name,
    division: roster.division,
    gameId: game.id,
    gameName: game.displayName,
    gameSlug: game.slug,
    players: [],
  };

  return {
    success: true,
    roster: rosterDetails,
    message: `Roster "${roster.name}" created for ${game.displayName}.`,
  };
}

/**
 * Deletes an empty competition roster.
 */
export async function deleteSchoolRoster(
  rosterId: string
): Promise<{ success: boolean; rosterId: string }> {
  if (!rosterId) {
    throw new Error('rosterId is required');
  }

  await assertManagerForRoster(rosterId);

  const playerRows = await db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(eq(schema.players.rosterId, rosterId))
    .limit(1);

  if (playerRows.length > 0) {
    throw new Error('Cannot delete a roster with enrolled players. Remove all players first.');
  }

  await db.delete(schema.rosters).where(eq(schema.rosters.id, rosterId));

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.TEAMS);

  return { success: true, rosterId };
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
  const { scopes } = await resolveManagerScope(schoolId, gameId);
  if (scopes && scopes.length === 0) return [];

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
    .where(
      scopes
        ? and(
            inArray(schema.players.memberId, memberIds),
            inArray(schema.teams.seasonId, scopes.map((g) => g.seasonId))
          )
        : inArray(schema.players.memberId, memberIds)
    );

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

export interface EnrollPlayerToRosterSuccess {
  success: true;
  player: SchoolRosterPlayer;
  message?: string;
}

export type EnrollPlayerToRosterResult = EnrollPlayerToRosterSuccess | RosterActionRejection;

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

  // Season scope: the student must be eligible for the season this roster plays in.
  const ineligible = seasonIneligibility(
    member,
    `${member.firstName} ${member.lastName}`,
    await seasonNameOf(team.seasonId, null)
  );
  if (ineligible) return reject(ineligible);

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

  // 4. Handle captain constraint, role edits and the one-tier-per-game rule
  let playerId = '';
  const conflict = await db.transaction(async (tx) => {
    // Serialize enrolls and moves of this member within the team so the sibling check below
    // cannot race another write.
    await lockRosterMember(tx, team.id, memberId);
    // Then the roster lock (always in this order) so the size count below cannot race another add.
    await lockRoster(tx, rosterId);

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

    // League rule: one tier per game. A member already on a sibling roster is moved, not
    // double-enrolled. A row already on THIS roster is a role/IGN edit and stays allowed.
    if (!existingPlayer) {
      const sibling = await siblingEnrollment(team.id, memberId, rosterId, tx);
      if (sibling) {
        return siblingConflictMessage(`${member.firstName} ${member.lastName}`, sibling.rosterName, roster.name);
      }
    }

    // Roster size limits: a new row needs room; any change to sub needs a free substitute slot.
    const capacity = rosterCapacityError({
      rosterName: roster.name,
      occupancy: occupancyOf(await rosterPlayerRoles(tx, rosterId), existingPlayer?.id),
      role,
      joining: !existingPlayer,
    });
    if (capacity) return capacity;

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
    return null;
  });
  if (conflict) return reject(conflict);

  // 5. Build SchoolRosterPlayer return object
  const identities = await db
    .select()
    .from(schema.playerIdentities)
    .where(eq(schema.playerIdentities.memberId, memberId));

  const riot = identities.find((i) => i.provider === 'riot');
  const discord = identities.find((i) => i.provider === 'discord');

  const rosterPlayer: SchoolRosterPlayer = {
    id: playerId,
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
  await notifyMembershipChanged([memberId]);

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

export interface RemovePlayerFromRosterResult {
  success: boolean;
  playerId: string;
  /** 'deleted': the student's onboarding record went too; 'kept': it stays (see message); 'unchanged': the row was already gone. */
  studentRecord: 'deleted' | 'kept' | 'unchanged';
  /** One sentence for the roster notice. */
  message: string;
}

/**
 * Removes a player from a roster. In the same transaction the student's own record and onboarding
 * leftovers are deleted when nothing else needs them (no other roster, not staff or a manager, no
 * match history); otherwise the record is kept and `message` says why. See roster-removal.ts.
 */
export async function removePlayerFromRoster(
  params: RemovePlayerFromRosterParams
): Promise<RemovePlayerFromRosterResult> {
  const { rosterId, playerId } = params;

  if (!rosterId || !playerId) {
    throw new Error('rosterId and playerId are required');
  }

  await assertManagerForRoster(rosterId);

  const removal = await db.transaction((tx) => removePlayerFromRosterTx(tx, { playerId, rosterId }));

  updateCacheTags(...removalCacheTags(removal), CACHE_TAGS.TEAMS);
  if (removal.removed) await notifyMembershipChanged([removal.memberId]);

  return {
    success: true,
    playerId,
    studentRecord: removal.removed ? removal.studentRecord : 'unchanged',
    message: removalNotice(removal),
  };
}

export interface MovePlayerToRosterParams {
  /** The roster the player is on now. */
  fromRosterId: string;
  /** The sibling roster to move them to. */
  toRosterId: string;
  /** Identify the player row by its id, or by the member when the caller only has that. */
  playerId?: string;
  memberId?: string;
}

export interface MovePlayerToRosterSuccess {
  success: true;
  playerId: string;
  memberId: string;
  playerName: string;
  fromRosterId: string;
  fromRosterName: string;
  toRosterId: string;
  toRosterName: string;
  /** The role the player has on the target roster (a moved captain becomes a starter). */
  role: string;
  isCaptain: boolean;
  /** True when the player was captain of the source roster and was demoted by the move. */
  wasCaptain: boolean;
}

export type MovePlayerToRosterResult = MovePlayerToRosterSuccess | RosterActionRejection;

const MOVE_RACE_MESSAGE =
  'This player was just moved or removed by someone else. Refresh the page and try again.';

/**
 * Moves a player to a sibling roster of the same team (for example Varsity to JV) in one
 * transaction. The existing players row is updated in place, so its id, in-game name and bio
 * survive. Both rosters are authorized and lock-checked through `assertManagerForRoster`, and
 * must share a team: a move never crosses games, seasons or schools. A captain arrives as a
 * regular starter because captaincy is per roster; a sub stays a sub. The target roster must have
 * room under the size limits in roster-limits.ts (7 players, 2 subs).
 *
 * Expected rejections (wrong team, already on the target, full target, a stale row) are RETURNED as
 * `{ success: false, error }` because Next.js hides thrown messages in production. Authorization,
 * lock and view-only failures from `assertManagerForRoster` and malformed input still throw: the
 * portal disables the controls in those states.
 */
export async function movePlayerToRoster(
  params: MovePlayerToRosterParams
): Promise<MovePlayerToRosterResult> {
  const { fromRosterId, toRosterId, playerId, memberId } = params;

  if (!fromRosterId || !toRosterId || (!playerId && !memberId)) {
    throw new Error('fromRosterId, toRosterId, and a playerId or memberId are required');
  }
  if (fromRosterId === toRosterId) {
    return reject('Pick a different roster to move the player to.');
  }

  // Both ends must be this manager's to change (auth, season scope, inactive and lock checks).
  const from = await assertManagerForRoster(fromRosterId);
  const to = await assertManagerForRoster(toRosterId);

  if (from.team.id !== to.team.id) {
    return reject(
      'Players can only be moved between rosters of the same team (same school, game and season).'
    );
  }

  // The lock below is keyed on (team, member), so resolve the member first.
  let lockMemberId = memberId;
  if (!lockMemberId) {
    const [row] = await db
      .select({ memberId: schema.players.memberId })
      .from(schema.players)
      .where(and(eq(schema.players.id, playerId!), eq(schema.players.rosterId, fromRosterId)))
      .limit(1);
    if (!row) return reject(`That player is not on ${from.roster.name}.`);
    lockMemberId = row.memberId;
  }

  const outcome = await db.transaction(async (tx) => {
    await lockRosterMember(tx, from.team.id, lockMemberId!);
    // Count the TARGET roster under its own lock (after the member lock, same order as enroll).
    await lockRoster(tx, toRosterId);

    const [player] = await tx
      .select()
      .from(schema.players)
      .where(
        and(
          playerId ? eq(schema.players.id, playerId) : eq(schema.players.memberId, memberId!),
          eq(schema.players.rosterId, fromRosterId)
        )
      )
      .limit(1);
    if (!player) {
      return { kind: 'rejected' as const, error: `That player is not on ${from.roster.name}.` };
    }

    const [member] = await tx
      .select({ firstName: schema.members.firstName, lastName: schema.members.lastName })
      .from(schema.members)
      .where(eq(schema.members.id, player.memberId))
      .limit(1);
    const playerName = member ? `${member.firstName} ${member.lastName}` : 'That player';

    const [alreadyThere] = await tx
      .select({ id: schema.players.id })
      .from(schema.players)
      .where(and(eq(schema.players.rosterId, toRosterId), eq(schema.players.memberId, player.memberId)))
      .limit(1);
    if (alreadyThere) {
      return { kind: 'rejected' as const, error: `${playerName} is already on ${to.roster.name}.` };
    }

    const wasCaptain = player.isCaptain || player.role === 'captain';
    // players_captain_role_check ties role='captain' to is_captain, so demote both together.
    const role = wasCaptain ? 'player' : player.role;

    // Moving OUT of a full roster is fine; moving INTO one is not, and a sub needs a free sub slot.
    const capacity = rosterCapacityError({
      rosterName: to.roster.name,
      occupancy: occupancyOf(await rosterPlayerRoles(tx, toRosterId)),
      role,
      joining: true,
    });
    if (capacity) return { kind: 'rejected' as const, error: capacity };

    // Guarded by the roster we read the player on: if someone else moved or removed the row
    // since, nothing matches and we report it instead of overwriting their change.
    const updated = await tx
      .update(schema.players)
      .set({ rosterId: toRosterId, role, isCaptain: false, updatedAt: new Date() })
      .where(and(eq(schema.players.id, player.id), eq(schema.players.rosterId, fromRosterId)))
      .returning({ id: schema.players.id });
    if (updated.length === 0) {
      return { kind: 'rejected' as const, error: MOVE_RACE_MESSAGE };
    }

    return { kind: 'moved' as const, player, playerName, role, wasCaptain };
  });

  if (outcome.kind === 'rejected') return reject(outcome.error);

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);
  await notifyMembershipChanged([outcome.player.memberId]);

  return {
    success: true,
    playerId: outcome.player.id,
    memberId: outcome.player.memberId,
    playerName: outcome.playerName,
    fromRosterId,
    fromRosterName: from.roster.name,
    toRosterId,
    toRosterName: to.roster.name,
    role: outcome.role,
    isCaptain: false,
    wasCaptain: outcome.wasCaptain,
  };
}

export interface UpdateRosterPlayerRoleParams {
  rosterId: string;
  playerId: string;
  role: 'player' | 'sub' | 'captain';
}

/**
 * Updates a player's role on a roster (Starter, Sub, or Captain).
 * Safely handles single-captain constraint with automatic promotion/demotion. Changing someone to
 * sub is refused when the roster already has the maximum number of OTHER subs (they may keep being
 * one); the player-count cap does not apply because nobody joins. The refusal is returned, not
 * thrown, so the message survives in production.
 */
export async function updateRosterPlayerRole(
  params: UpdateRosterPlayerRoleParams
): Promise<
  { success: true; playerId: string; role: string; isCaptain: boolean } | RosterActionRejection
> {
  const { rosterId, playerId, role } = params;

  if (!rosterId || !playerId || !role) {
    throw new Error('rosterId, playerId, and role are required');
  }

  const { roster } = await assertManagerForRoster(rosterId);

  const [targetPlayer] = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.id, playerId), eq(schema.players.rosterId, rosterId)))
    .limit(1);

  if (!targetPlayer) {
    throw new Error(`Player ${playerId} not found on roster`);
  }

  const isCaptain = role === 'captain';

  const rejection = await db.transaction(async (tx) => {
    // Count the roster's substitutes under the roster lock so two role changes cannot both take
    // the last slot.
    await lockRoster(tx, rosterId);
    const capacity = rosterCapacityError({
      rosterName: roster.name,
      occupancy: occupancyOf(await rosterPlayerRoles(tx, rosterId), playerId),
      role,
      joining: false,
    });
    if (capacity) return capacity;

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
    return null;
  });
  if (rejection) return reject(rejection);

  updateCacheTags(CACHE_TAGS.ROSTERS, CACHE_TAGS.PLAYERS, CACHE_TAGS.TEAMS);
  await notifyMembershipChanged([targetPlayer.memberId]);

  return {
    success: true,
    playerId,
    role,
    isCaptain,
  };
}
