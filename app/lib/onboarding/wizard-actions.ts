'use server';

import crypto from 'node:crypto';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ManualRiotIdAdapter } from './adapters/riot-manual';
import type { GameIdentityPort, CommunityPlatformPort } from './ports';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';

export interface ValidateInviteTokenParams {
  schoolSlug?: string;
  gameSlug?: string;
  token: string;
}

export type ValidateInviteTokenResult =
  | {
      valid: true;
      status: 'pending';
      inviteId: string;
      role: 'player' | 'manager';
      intendedFirstName: string;
      intendedLastName: string;
      schoolId: string;
      schoolName: string;
      schoolSlug: string;
      gameId: string | null;
      gameName: string;
      gameSlug: string;
      submissionDraft: Record<string, any> | null;
      expiresAt: Date;
    }
  | {
      valid: false;
      status: 'invalid';
      message: string;
    }
  | {
      valid: false;
      status: 'expired';
      expiresAt?: Date;
      message: string;
    }
  | {
      valid: false;
      status: 'accepted';
      message: string;
    }
  | {
      valid: false;
      status: 'rejected';
      rejectionReason?: string | null;
      message: string;
    }
  | {
      valid: false;
      status: 'submitted';
      message: string;
    };

/**
 * Validates a player invite token against school and game parameters.
 * Computes the SHA-256 hash of the token and checks status and expiration.
 */
export async function validateInviteToken(
  params: ValidateInviteTokenParams
): Promise<ValidateInviteTokenResult> {
  const { schoolSlug, gameSlug, token } = params;

  if (!token || !token.trim()) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Invalid or non-existent invite link.',
    };
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

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
    return {
      valid: false,
      status: 'invalid',
      message: 'Invalid or non-existent invite link.',
    };
  }

  const isManager = row.invite.role === 'manager';
  const resolvedGameId = row.gameId ?? null;
  const resolvedGameSlug = row.gameSlug || (isManager ? 'manager' : 'all');
  const resolvedGameName = row.gameName || (isManager ? 'School Manager' : 'All Games');

  if (schoolSlug && row.schoolSlug.toLowerCase() !== schoolSlug.toLowerCase()) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Invite link does not match the requested school.',
    };
  }

  if (gameSlug) {
    const slugLower = gameSlug.toLowerCase();
    const matchesGame = resolvedGameSlug.toLowerCase() === slugLower;
    const matchesManager = isManager && slugLower === 'manager';
    if (!matchesGame && !matchesManager) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Invite link does not match the requested game or role.',
      };
    }
  }

  const invite = row.invite;

  if (invite.status === 'accepted') {
    return {
      valid: false,
      status: 'accepted',
      message: 'Invite already accepted.',
    };
  }

  if (invite.status === 'rejected') {
    return {
      valid: false,
      status: 'rejected',
      rejectionReason: invite.rejectionReason,
      message: 'Invite was rejected.',
    };
  }

  if (invite.status === 'submitted') {
    return {
      valid: false,
      status: 'submitted',
      message: 'Application already submitted and awaiting manager review.',
    };
  }

  if (invite.status === 'expired' || (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())) {
    return {
      valid: false,
      status: 'expired',
      expiresAt: invite.expiresAt,
      message: 'Invite link has expired.',
    };
  }

  if (invite.status === 'pending') {
    return {
      valid: true,
      status: 'pending',
      inviteId: invite.id,
      role: (row.invite.role as 'player' | 'manager') || 'player',
      intendedFirstName: invite.intendedFirstName,
      intendedLastName: invite.intendedLastName,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      schoolSlug: row.schoolSlug,
      gameId: resolvedGameId,
      gameName: resolvedGameName,
      gameSlug: resolvedGameSlug,
      submissionDraft: (invite.submissionDraft as Record<string, any> | null) ?? null,
      expiresAt: invite.expiresAt,
    };
  }

  return {
    valid: false,
    status: 'invalid',
    message: 'Invalid invite status.',
  };
}

export interface SaveOnboardingDraftParams {
  token: string;
  draftData: Record<string, any>;
}

/**
 * Saves in-progress wizard draft data to the player invite record.
 * Allows the student to resume onboarding across browser refreshes using the same token.
 */
export async function saveOnboardingDraft(
  params: SaveOnboardingDraftParams
): Promise<{ success: boolean; savedAt: string }> {
  const { token, draftData } = params;

  if (!token?.trim()) {
    throw new Error('Token is required to save draft');
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const [invite] = await db
    .select()
    .from(schema.playerInvites)
    .where(eq(schema.playerInvites.tokenHash, tokenHash))
    .limit(1);

  if (!invite) {
    throw new Error('Invalid or non-existent invite token');
  }

  if (invite.status !== 'pending') {
    throw new Error(`Cannot save draft: invite status is ${invite.status}`);
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('Cannot save draft: invite link has expired');
  }

  await db
    .update(schema.playerInvites)
    .set({
      submissionDraft: draftData,
    })
    .where(eq(schema.playerInvites.id, invite.id));

  return {
    success: true,
    savedAt: new Date().toISOString(),
  };
}

export interface PlayerOnboardingSubmission {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  graduationYear: number;
  password?: string;
  riotId: string;
  discordUsername: string;
  discordUserId?: string;
  inGuild?: boolean;
  birthDate: string | Date;
  gender?: string;
  race?: string[];
  ethnicity?: string[];
  countryOfBirth?: string;
  primaryLanguageAtHome?: string;
  isFreeOrReducedLunch?: boolean;
  isFirstGenCollege?: boolean;
  doePetitionConsent?: boolean;
  surveyDetails?: {
    ping?: string | number;
    hoursPerWeek?: string | number;
    internetReliability?: string;
    careerInterests?: string[];
    feedback?: string;
    [key: string]: any;
  };
  codeOfConductAccepted: boolean;
}

export interface SubmitPlayerOnboardingOptions {
  riotAdapter?: GameIdentityPort;
  discordAdapter?: CommunityPlatformPort;
}

export interface SubmitPlayerOnboardingParams {
  token: string;
  submission: PlayerOnboardingSubmission;
  options?: SubmitPlayerOnboardingOptions;
}

export interface SubmitPlayerOnboardingResult {
  success: boolean;
  inviteId: string;
  memberId: string;
  status: 'submitted' | 'accepted';
  role?: 'player' | 'manager';
}

/**
 * Validates and atomically processes a player onboarding submission.
 * - Upserts the student member in the members table.
 * - Stores game & community platform identities (Riot & Discord).
 * - Stores sensitive demographic and equity responses in the isolated student_demographics vault.
 * - Transitions the invite status from 'pending' to 'submitted'.
 */
export async function submitPlayerOnboarding(
  params: SubmitPlayerOnboardingParams
): Promise<SubmitPlayerOnboardingResult> {
  const { token, submission, options } = params;

  if (!token?.trim()) {
    throw new Error('Invite token is required.');
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const [inviteRow] = await db
    .select({
      invite: schema.playerInvites,
      gameSlug: schema.games.slug,
      schoolId: schema.playerInvites.schoolId,
    })
    .from(schema.playerInvites)
    .leftJoin(schema.games, eq(schema.playerInvites.gameId, schema.games.id))
    .where(eq(schema.playerInvites.tokenHash, tokenHash))
    .limit(1);

  if (!inviteRow) {
    throw new Error('Invalid or non-existent invite link.');
  }

  const invite = inviteRow.invite;
  const isManager = invite.role === 'manager';

  if (invite.status !== 'pending') {
    throw new Error(`Cannot submit application: invite is already ${invite.status}.`);
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('Invite link has expired.');
  }

  // 1. Input validations
  const email = (submission.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.');
  }

  const legalFirstName = (submission.legalFirstName || '').trim();
  const legalLastName = (submission.legalLastName || '').trim();
  if (!legalFirstName || !legalLastName) {
    throw new Error('Legal first and last names are required.');
  }

  const gradYear = Number(submission.graduationYear);
  if (!Number.isInteger(gradYear) || gradYear < 2020 || gradYear > 2040) {
    throw new Error('A valid graduation year (e.g. 2026) is required.');
  }

  if (!submission.codeOfConductAccepted) {
    throw new Error('You must accept the EZ Esports code of conduct and rules to complete onboarding.');
  }

  const birthDateObj = new Date(submission.birthDate);
  if (isNaN(birthDateObj.getTime())) {
    throw new Error('A valid date of birth is required.');
  }

  // 2. Validate Riot ID using GameIdentityPort adapter
  const effectiveGameSlug = inviteRow.gameSlug || (isManager ? 'valorant' : 'valorant');
  const riotAdapter = options?.riotAdapter ?? new ManualRiotIdAdapter({ isVerified: true });
  const resolvedRiot = await riotAdapter.resolveIdentity(effectiveGameSlug, submission.riotId);

  // 3. Validate Discord handle (honor system: trusted that they provided handle and joined server)
  const discordUsername = (submission.discordUsername || '').trim();
  if (!discordUsername) {
    throw new Error('Discord username or handle is required.');
  }

  const discordUserId = submission.discordUserId?.trim() || discordUsername;
  // Trust that player provided their Discord handle and joined the server
  const inGuild = true;

  let createdOrUpdatedMemberId = '';

  // 4. Atomic database transaction
  await db.transaction(async (tx) => {
    // 4a. Upsert members row for student
    const [existingMember] = await tx
      .select()
      .from(schema.members)
      .where(eq(schema.members.email, email))
      .limit(1);

    if (existingMember) {
      createdOrUpdatedMemberId = existingMember.id;
      await tx
        .update(schema.members)
        .set({
          firstName: legalFirstName,
          lastName: legalLastName,
          discord: discordUsername,
          graduationYear: gradYear,
          schoolId: invite.schoolId,
          updatedAt: new Date(),
        })
        .where(eq(schema.members.id, createdOrUpdatedMemberId));
    } else {
      const [newMember] = await tx
        .insert(schema.members)
        .values({
          firstName: legalFirstName,
          lastName: legalLastName,
          email,
          discord: discordUsername,
          graduationYear: gradYear,
          schoolId: invite.schoolId,
        })
        .returning();
      createdOrUpdatedMemberId = newMember.id;
    }

    // 4b. Upsert Riot identity
    const [existingRiot] = await tx
      .select()
      .from(schema.playerIdentities)
      .where(
        and(
          eq(schema.playerIdentities.provider, 'riot'),
          eq(schema.playerIdentities.memberId, createdOrUpdatedMemberId)
        )
      )
      .limit(1);

    if (existingRiot) {
      await tx
        .update(schema.playerIdentities)
        .set({
          providerUserId: resolvedRiot.rawIdentifier,
          providerUsername: resolvedRiot.rawIdentifier,
          lastVerifiedAt: new Date(),
        })
        .where(eq(schema.playerIdentities.id, existingRiot.id));
    } else {
      await tx
        .insert(schema.playerIdentities)
        .values({
          memberId: createdOrUpdatedMemberId,
          provider: 'riot',
          providerUserId: resolvedRiot.rawIdentifier,
          providerUsername: resolvedRiot.rawIdentifier,
          inGuild: false,
          lastVerifiedAt: new Date(),
        });
    }

    // 4c. Upsert Discord identity
    const [existingDiscord] = await tx
      .select()
      .from(schema.playerIdentities)
      .where(
        and(
          eq(schema.playerIdentities.provider, 'discord'),
          eq(schema.playerIdentities.memberId, createdOrUpdatedMemberId)
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
      await tx
        .insert(schema.playerIdentities)
        .values({
          memberId: createdOrUpdatedMemberId,
          provider: 'discord',
          providerUserId: discordUserId,
          providerUsername: discordUsername,
          inGuild,
          lastVerifiedAt: new Date(),
        });
    }

    // 4d. Upsert studentDemographics vault (Strict Zero-PII RLS)
    const [existingDemo] = await tx
      .select()
      .from(schema.studentDemographics)
      .where(eq(schema.studentDemographics.memberId, createdOrUpdatedMemberId))
      .limit(1);

    const demoValues = {
      legalFirstName,
      legalLastName,
      birthDate: birthDateObj,
      gender: submission.gender || null,
      race: submission.race || null,
      ethnicity: submission.ethnicity || null,
      countryOfBirth: submission.countryOfBirth || null,
      primaryLanguageAtHome: submission.primaryLanguageAtHome || null,
      isFreeOrReducedLunch: submission.isFreeOrReducedLunch ?? null,
      isFirstGenCollege: submission.isFirstGenCollege ?? null,
      doePetitionConsent: Boolean(submission.doePetitionConsent),
      surveyDetails: submission.surveyDetails || null,
    };

    if (existingDemo) {
      await tx
        .update(schema.studentDemographics)
        .set(demoValues)
        .where(eq(schema.studentDemographics.id, existingDemo.id));
    } else {
      await tx
        .insert(schema.studentDemographics)
        .values({
          memberId: createdOrUpdatedMemberId,
          ...demoValues,
        });
    }

    // 4e. Handle role-specific finalization
    if (isManager) {
      // Resolve or link userId
      let resolvedUserId: string | null = null;
      const [staff] = await tx
        .select({ userId: schema.staffMembers.userId })
        .from(schema.staffMembers)
        .where(sql`lower(${schema.staffMembers.email}) = ${email}`)
        .limit(1);

      if (staff) {
        resolvedUserId = staff.userId;
      } else {
        try {
          if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const { createServiceClient } = await import('@/app/lib/supabase/service');
            const supabase = createServiceClient();
            const { data: created, error: createError } = await supabase.auth.admin.createUser({
              email,
              password: submission.password || crypto.randomBytes(16).toString('hex'),
              email_confirm: true,
            });
            if (created?.user) {
              resolvedUserId = created.user.id;
            } else if (createError) {
              const { data: list } = await supabase.auth.admin.listUsers();
              const existingAuthUser = list?.users?.find((u) => u.email?.toLowerCase() === email);
              if (existingAuthUser) {
                resolvedUserId = existingAuthUser.id;
              }
            }
          }
        } catch (authErr) {
          console.warn('Could not provision Supabase Auth user for manager:', authErr);
        }
      }

      if (!resolvedUserId) {
        resolvedUserId = crypto.randomUUID();
      }

      const draft = (invite.submissionDraft as Record<string, any>) || {};
      const academicYear = draft.academicYear || '2025-2026';
      const managedGames = draft.managedGames ?? null;
      const isPrimaryContact = Boolean(draft.isPrimaryContact);

      // Upsert school_managers row
      const [existingManager] = await tx
        .select()
        .from(schema.schoolManagers)
        .where(
          and(
            eq(schema.schoolManagers.schoolId, invite.schoolId),
            eq(schema.schoolManagers.userId, resolvedUserId),
            eq(schema.schoolManagers.academicYear, academicYear)
          )
        )
        .limit(1);

      if (existingManager) {
        await tx
          .update(schema.schoolManagers)
          .set({
            isActive: true,
            memberId: createdOrUpdatedMemberId,
            managedGames: managedGames ?? existingManager.managedGames,
            isPrimaryContact: isPrimaryContact ?? existingManager.isPrimaryContact,
            updatedAt: new Date(),
          })
          .where(eq(schema.schoolManagers.id, existingManager.id));
      } else {
        await tx.insert(schema.schoolManagers).values({
          schoolId: invite.schoolId,
          userId: resolvedUserId,
          memberId: createdOrUpdatedMemberId,
          managedGames,
          academicYear,
          isPrimaryContact,
          isActive: true,
        });
      }

      // Transition manager invite to accepted
      await tx
        .update(schema.playerInvites)
        .set({
          memberId: createdOrUpdatedMemberId,
          status: 'accepted',
          submittedAt: new Date(),
          reviewedAt: new Date(),
        })
        .where(eq(schema.playerInvites.id, invite.id));
    } else {
      // 4e. Update playerInvites to submitted
      await tx
        .update(schema.playerInvites)
        .set({
          memberId: createdOrUpdatedMemberId,
          status: 'submitted',
          submittedAt: new Date(),
        })
        .where(eq(schema.playerInvites.id, invite.id));
    }
  });

  if (isManager) {
    updateCacheTags(CACHE_TAGS.PLAYERS, CACHE_TAGS.MEMBERS, CACHE_TAGS.SCHOOLS);
    return {
      success: true,
      inviteId: invite.id,
      memberId: createdOrUpdatedMemberId,
      status: 'accepted',
      role: 'manager',
    };
  }

  updateCacheTags(CACHE_TAGS.PLAYERS, CACHE_TAGS.MEMBERS);

  return {
    success: true,
    inviteId: invite.id,
    memberId: createdOrUpdatedMemberId,
    status: 'submitted',
    role: 'player',
  };
}
