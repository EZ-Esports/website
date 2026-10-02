import crypto from 'node:crypto';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ManualRiotIdAdapter } from '../adapters/riot-manual';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';
import type {
  PlayerOnboardingSubmission,
  SubmitPlayerOnboardingParams,
  SubmitPlayerOnboardingResult,
} from '../wizard-actions';

/**
 * Validates player/manager onboarding submission inputs before database persistence.
 */
export function validateSubmissionInputs(submission: PlayerOnboardingSubmission): {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  gradYear: number;
  birthDateObj: Date;
  discordUsername: string;
  discordUserId: string;
} {
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

  const discordUsername = (submission.discordUsername || '').trim();
  if (!discordUsername) {
    throw new Error('Discord username or handle is required.');
  }

  const discordUserId = submission.discordUserId?.trim() || discordUsername;

  return {
    email,
    legalFirstName,
    legalLastName,
    gradYear,
    birthDateObj,
    discordUsername,
    discordUserId,
  };
}

/**
 * Pipeline step: Upserts student/manager record in the members table.
 */
export async function upsertMemberRecord(
  tx: any,
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
 * Pipeline step: Upserts competitive gaming & community identities (Riot ID + Discord).
 */
export async function upsertPlayerIdentities(
  tx: any,
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

/**
 * Pipeline step: Upserts sensitive demographic survey in the FERPA / NY § 2-D encrypted vault.
 */
export async function upsertDemographicsVault(
  tx: any,
  memberId: string,
  params: {
    legalFirstName: string;
    legalLastName: string;
    birthDateObj: Date;
    submission: PlayerOnboardingSubmission;
  }
): Promise<void> {
  const { legalFirstName, legalLastName, birthDateObj, submission } = params;

  const [existingDemo] = await tx
    .select()
    .from(schema.studentDemographics)
    .where(eq(schema.studentDemographics.memberId, memberId))
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
    await tx.insert(schema.studentDemographics).values({
      memberId,
      ...demoValues,
    });
  }
}

/**
 * Pipeline step: Provisions School Manager account, linking Supabase Auth and tenancy.
 */
export async function provisionManagerAccount(
  tx: any,
  params: {
    email: string;
    memberId: string;
    schoolId: string;
    password?: string;
    submissionDraft: Record<string, any> | null;
  }
): Promise<string> {
  const { email, memberId, schoolId, password, submissionDraft } = params;

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
          password: password || crypto.randomBytes(16).toString('hex'),
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

  const draft = submissionDraft || {};
  const academicYear = draft.academicYear || '2025-2026';
  const managedGames = draft.managedGames ?? null;
  const isPrimaryContact = Boolean(draft.isPrimaryContact);

  const [existingManager] = await tx
    .select()
    .from(schema.schoolManagers)
    .where(
      and(
        eq(schema.schoolManagers.schoolId, schoolId),
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
        memberId,
        managedGames: managedGames ?? existingManager.managedGames,
        isPrimaryContact: isPrimaryContact ?? existingManager.isPrimaryContact,
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolManagers.id, existingManager.id));
  } else {
    await tx.insert(schema.schoolManagers).values({
      schoolId,
      userId: resolvedUserId,
      memberId,
      managedGames,
      academicYear,
      isPrimaryContact,
      isActive: true,
    });
  }

  return resolvedUserId;
}

/**
 * Executes the complete wizard onboarding submission pipeline.
 */
export async function processOnboardingSubmission(
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

  // Step 1: Validate inputs
  const validated = validateSubmissionInputs(submission);

  // Step 2: Resolve external Riot identity
  const effectiveGameSlug = inviteRow.gameSlug || (isManager ? 'valorant' : 'valorant');
  const riotAdapter = options?.riotAdapter ?? new ManualRiotIdAdapter({ isVerified: true });
  const resolvedRiot = await riotAdapter.resolveIdentity(effectiveGameSlug, submission.riotId);

  let createdOrUpdatedMemberId = '';

  // Step 3: Atomic database transaction
  await db.transaction(async (tx) => {
    // 3a. Member
    createdOrUpdatedMemberId = await upsertMemberRecord(tx, {
      email: validated.email,
      legalFirstName: validated.legalFirstName,
      legalLastName: validated.legalLastName,
      discordUsername: validated.discordUsername,
      gradYear: validated.gradYear,
      schoolId: invite.schoolId,
    });

    // 3b. Identities (Riot + Discord)
    await upsertPlayerIdentities(tx, createdOrUpdatedMemberId, {
      riotIdentifier: resolvedRiot.rawIdentifier,
      discordUserId: validated.discordUserId,
      discordUsername: validated.discordUsername,
      inGuild: true,
    });

    // 3c. Demographics Vault (FERPA / NY § 2-D)
    await upsertDemographicsVault(tx, createdOrUpdatedMemberId, {
      legalFirstName: validated.legalFirstName,
      legalLastName: validated.legalLastName,
      birthDateObj: validated.birthDateObj,
      submission,
    });

    // 3d. Role-specific finalization
    if (isManager) {
      await provisionManagerAccount(tx, {
        email: validated.email,
        memberId: createdOrUpdatedMemberId,
        schoolId: invite.schoolId,
        password: submission.password,
        submissionDraft: invite.submissionDraft as Record<string, any> | null,
      });

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

  // Step 4: Invalidate cache tags
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
