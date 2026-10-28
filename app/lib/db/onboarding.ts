import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { and, asc, eq, sql } from 'drizzle-orm';

/** Transaction handle passed to the onboarding write steps. */
export type OnboardingTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type InviteKind = 'player' | 'manager';

export type PlayerInviteRow = typeof schema.playerInvites.$inferSelect;
export type ManagerInviteRow = typeof schema.managerInvites.$inferSelect;

/**
 * Looks an invite up by token hash for validation. Manager invites live in
 * their own table and carry no game, so they are only consulted when the hash
 * is not a player invite.
 */
export async function findInviteForValidation(tokenHash: string) {
  const [playerRow] = await db
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

  if (playerRow) {
    return { isManager: false, ...playerRow };
  }

  const [managerRow] = await db
    .select({
      invite: schema.managerInvites,
      schoolId: schema.schools.id,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
    })
    .from(schema.managerInvites)
    .innerJoin(schema.schools, eq(schema.managerInvites.schoolId, schema.schools.id))
    .where(eq(schema.managerInvites.tokenHash, tokenHash))
    .limit(1);

  if (!managerRow) return undefined;
  return { isManager: true, ...managerRow, gameId: null, gameName: null, gameSlug: null };
}

/** Looks an invite up by token hash (player table first, then manager table). */
export async function findInviteByTokenHash(
  tokenHash: string
): Promise<{ kind: InviteKind; invite: PlayerInviteRow | ManagerInviteRow } | undefined> {
  const [playerInvite] = await db
    .select()
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.tokenHash, tokenHash))
    .limit(1);

  if (playerInvite) return { kind: 'player', invite: playerInvite };

  const [managerInvite] = await db
    .select()
    .from(schema.managerInvites)
    .where(eq(schema.managerInvites.tokenHash, tokenHash))
    .limit(1);

  return managerInvite ? { kind: 'manager', invite: managerInvite } : undefined;
}

/**
 * Looks an invite up by token hash for submission. Player invites also return
 * their game slug; manager invites carry no game.
 */
export async function findInviteForSubmission(tokenHash: string): Promise<
  | { isManager: false; invite: PlayerInviteRow; gameSlug: string | null }
  | { isManager: true; invite: ManagerInviteRow; gameSlug: null }
  | undefined
> {
  const [playerRow] = await db
    .select({
      invite: schema.playerInvites,
      gameSlug: schema.games.slug,
    })
    .from(schema.playerInvites)
    .leftJoin(schema.games, eq(schema.playerInvites.gameId, schema.games.id))
    .where(eq(schema.playerInvites.tokenHash, tokenHash))
    .limit(1);

  if (playerRow) {
    return { isManager: false, invite: playerRow.invite, gameSlug: playerRow.gameSlug ?? null };
  }

  const [managerInvite] = await db
    .select()
    .from(schema.managerInvites)
    .where(eq(schema.managerInvites.tokenHash, tokenHash))
    .limit(1);

  return managerInvite ? { isManager: true, invite: managerInvite, gameSlug: null } : undefined;
}

/** Overwrites the in-progress wizard draft on a player or manager invite. */
export async function updateInviteDraft(
  kind: InviteKind,
  inviteId: string,
  submissionDraft: Record<string, any> | null
): Promise<void> {
  const inviteTable = kind === 'player' ? schema.playerInvites : schema.managerInvites;
  await db
    .update(inviteTable)
    .set({ submissionDraft })
    .where(eq(inviteTable.id, inviteId));
}

/** Runs the onboarding submission writes atomically. */
export function runOnboardingTransaction<T>(fn: (tx: OnboardingTx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/** Upserts the student/manager record in the members table, returning its id. */
export async function upsertMemberRecord(
  tx: OnboardingTx,
  params: {
    email: string;
    legalFirstName: string;
    legalLastName: string;
    discordUsername: string;
    gradYear: number;
    schoolId: string;
  }
): Promise<string> {
  const { email, legalFirstName, legalLastName, discordUsername, gradYear, schoolId } = params;

  const [existingMember] = await tx
    .select()
    .from(schema.members)
    .where(eq(schema.members.email, email))
    .limit(1);

  if (existingMember) {
    await tx
      .update(schema.members)
      .set({
        firstName: legalFirstName,
        lastName: legalLastName,
        discord: discordUsername,
        graduationYear: gradYear,
        schoolId,
        updatedAt: new Date(),
      })
      .where(eq(schema.members.id, existingMember.id));
    return existingMember.id;
  }

  const [newMember] = await tx
    .insert(schema.members)
    .values({
      firstName: legalFirstName,
      lastName: legalLastName,
      email,
      discord: discordUsername,
      graduationYear: gradYear,
      schoolId,
    })
    .returning();

  return newMember.id;
}

/**
 * Member id that already owns this Discord account, if any. One Discord account maps to one
 * member; the unique (provider, provider_user_id) index backs this, but checking first lets the
 * wizard show a readable error instead of a constraint violation.
 */
export async function findDiscordIdentityOwner(
  tx: OnboardingTx,
  discordUserId: string
): Promise<string | undefined> {
  const [row] = await tx
    .select({ memberId: schema.playerIdentities.memberId })
    .from(schema.playerIdentities)
    .where(
      and(
        eq(schema.playerIdentities.provider, 'discord'),
        eq(schema.playerIdentities.providerUserId, discordUserId)
      )
    )
    .limit(1);
  return row?.memberId;
}

/** Upserts the Riot and Discord identities for a member. */
export async function upsertPlayerIdentities(
  tx: OnboardingTx,
  memberId: string,
  params: {
    riotIdentifier: string;
    discordUserId: string;
    discordUsername: string;
    inGuild: boolean;
  }
): Promise<void> {
  const { riotIdentifier, discordUserId, discordUsername, inGuild } = params;

  // 1. Riot Identity
  const [existingRiot] = await tx
    .select()
    .from(schema.playerIdentities)
    .where(
      and(
        eq(schema.playerIdentities.provider, 'riot'),
        eq(schema.playerIdentities.memberId, memberId)
      )
    )
    .limit(1);

  if (existingRiot) {
    await tx
      .update(schema.playerIdentities)
      .set({
        providerUserId: riotIdentifier,
        providerUsername: riotIdentifier,
        lastVerifiedAt: new Date(),
      })
      .where(eq(schema.playerIdentities.id, existingRiot.id));
  } else {
    await tx.insert(schema.playerIdentities).values({
      memberId,
      provider: 'riot',
      providerUserId: riotIdentifier,
      providerUsername: riotIdentifier,
      inGuild: false,
      lastVerifiedAt: new Date(),
    });
  }

  // 2. Discord Identity
  const [existingDiscord] = await tx
    .select()
    .from(schema.playerIdentities)
    .where(
      and(
        eq(schema.playerIdentities.provider, 'discord'),
        eq(schema.playerIdentities.memberId, memberId)
      )
    )
    .limit(1);

  if (existingDiscord) {
    await tx
      .update(schema.playerIdentities)
      .set({
        providerUserId: discordUserId,
        providerUsername: discordUsername,
        inGuild,
        lastVerifiedAt: new Date(),
      })
      .where(eq(schema.playerIdentities.id, existingDiscord.id));
  } else {
    await tx.insert(schema.playerIdentities).values({
      memberId,
      provider: 'discord',
      providerUserId: discordUserId,
      providerUsername: discordUsername,
      inGuild,
      lastVerifiedAt: new Date(),
    });
  }
}

/** Upserts the sensitive demographic survey in the FERPA / NY § 2-D vault. */
export async function upsertStudentDemographics(
  tx: OnboardingTx,
  memberId: string,
  values: Omit<typeof schema.studentDemographics.$inferInsert, 'memberId'>
): Promise<void> {
  const [existingDemo] = await tx
    .select()
    .from(schema.studentDemographics)
    .where(eq(schema.studentDemographics.memberId, memberId))
    .limit(1);

  if (existingDemo) {
    await tx
      .update(schema.studentDemographics)
      .set(values)
      .where(eq(schema.studentDemographics.id, existingDemo.id));
  } else {
    await tx.insert(schema.studentDemographics).values({
      memberId,
      ...values,
    });
  }
}

/** Auth user id of the staff member with this email (case-insensitive), if any. */
export async function findStaffUserIdByEmail(
  tx: OnboardingTx | typeof db,
  email: string
): Promise<string | undefined> {
  const [staff] = await tx
    .select({ userId: schema.staffMembers.userId })
    .from(schema.staffMembers)
    .where(sql`lower(${schema.staffMembers.email}) = ${email}`)
    .limit(1);

  return staff?.userId;
}

/** Upserts the school_managers row linking a user to a school for a season. */
export async function upsertSchoolManager(
  tx: OnboardingTx,
  params: {
    schoolId: string;
    userId: string;
    memberId: string;
    academicYear: string;
    managedGames: any;
    isPrimaryContact: boolean;
  }
): Promise<void> {
  const { schoolId, userId, memberId, academicYear, managedGames, isPrimaryContact } = params;

  const [existingManager] = await tx
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

  if (existingManager) {
    await tx
      .update(schema.schoolManagers)
      .set({
        isActive: true,
        memberId,
        managedGames: managedGames ?? existingManager.managedGames,
        isPrimaryContact: isPrimaryContact ?? existingManager.isPrimaryContact,
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolManagers.id, existingManager.id));
  } else {
    await tx.insert(schema.schoolManagers).values({
      schoolId,
      userId,
      memberId,
      managedGames,
      academicYear,
      isPrimaryContact,
      isActive: true,
    });
  }
}

/** Marks a manager invite accepted and links the created member. */
export async function markManagerInviteAccepted(
  tx: OnboardingTx,
  inviteId: string,
  memberId: string
): Promise<void> {
  await tx
    .update(schema.managerInvites)
    .set({
      memberId,
      status: 'accepted',
      submittedAt: new Date(),
      reviewedAt: new Date(),
    })
    .where(eq(schema.managerInvites.id, inviteId));
}

/** Marks a player invite submitted (awaiting manager review) and links the created member. */
export async function markPlayerInviteSubmitted(
  tx: OnboardingTx,
  inviteId: string,
  memberId: string
): Promise<void> {
  await tx
    .update(schema.playerInvites)
    .set({
      memberId,
      status: 'submitted',
      submittedAt: new Date(),
    })
    .where(eq(schema.playerInvites.id, inviteId));
}

/** Appends the signed consent record for an onboarding submission. */
export async function insertOnboardingConsent(
  tx: OnboardingTx,
  values: typeof schema.onboardingConsents.$inferInsert
): Promise<void> {
  await tx.insert(schema.onboardingConsents).values(values);
}

export interface OnboardingGameOption {
  id: string;
  slug: string;
  displayName: string;
}

/**
 * Games a school manager can say they also play, in display-name order. Only games with at least one
 * season are offered: rosters, and so player applications, only exist for those.
 */
export async function listOnboardingGames(): Promise<OnboardingGameOption[]> {
  return db
    .select({
      id: schema.games.id,
      slug: schema.games.slug,
      displayName: schema.games.displayName,
    })
    .from(schema.games)
    .where(sql`exists (select 1 from seasons where seasons.game_id = ${schema.games.id})`)
    .orderBy(asc(schema.games.displayName));
}

/**
 * Records that a member plays a game at a school as a `submitted` `player_invites` row, exactly what
 * a player's own wizard submission leaves behind. It therefore waits in the manager review queue and
 * goes through `reviewPlayerInvite` (season scope, roster lock, one tier per game, roster limits) like
 * any other student. A member who already has a live (not rejected or expired) row for that school
 * and game is left alone, so re-onboarding never duplicates it. Returns true when a row was created.
 */
export async function ensurePlayerSubmission(
  tx: OnboardingTx,
  params: {
    memberId: string;
    schoolId: string;
    gameId: string;
    invitedByUserId: string;
    intendedFirstName: string;
    intendedLastName: string;
    tokenHash: string;
  }
): Promise<boolean> {
  const existing = await tx
    .select({ id: schema.playerInvites.id, status: schema.playerInvites.status })
    .from(schema.playerInvites)
    .where(
      and(
        eq(schema.playerInvites.memberId, params.memberId),
        eq(schema.playerInvites.schoolId, params.schoolId),
        eq(schema.playerInvites.gameId, params.gameId)
      )
    )
    .limit(1);
  if (existing.some((row) => row.status !== 'rejected' && row.status !== 'expired')) return false;

  const now = new Date();
  await tx.insert(schema.playerInvites).values({
    schoolId: params.schoolId,
    gameId: params.gameId,
    tokenHash: params.tokenHash,
    intendedFirstName: params.intendedFirstName,
    intendedLastName: params.intendedLastName,
    invitedByUserId: params.invitedByUserId,
    status: 'submitted',
    expiresAt: now,
    submittedAt: now,
    memberId: params.memberId,
    submissionDraft: { source: 'manager_also_plays' },
  });
  return true;
}
