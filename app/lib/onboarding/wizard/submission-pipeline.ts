import crypto from 'node:crypto';
import {
  findInviteForSubmission,
  findStaffUserIdByEmail,
  insertOnboardingConsent,
  markManagerInviteAccepted,
  markPlayerInviteSubmitted,
  runOnboardingTransaction,
  upsertMemberRecord,
  upsertPlayerIdentities,
  upsertSchoolManager,
  upsertStudentDemographics,
  type OnboardingTx,
} from '@/app/lib/db/onboarding';
import { ManualRiotIdAdapter } from '../adapters/riot-manual';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';
import {
  calculateAge,
  validateConsent,
  type NormalizedConsent,
} from '../consent';
import { isValidSeasonName, DEFAULT_MANAGER_SEASON } from '@/app/lib/season-name';
import type {
  PlayerOnboardingSubmission,
  SubmitPlayerOnboardingParams,
  SubmitPlayerOnboardingResult,
} from '../wizard-actions';

/**
 * Validates player/manager onboarding submission inputs before database persistence.
 */
export function validateSubmissionInputs(
  submission: PlayerOnboardingSubmission,
  now: Date = new Date()
): {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  gradYear: number;
  birthDateObj: Date;
  discordUsername: string;
  discordUserId: string;
  consent: NormalizedConsent;
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

  if (birthDateObj.getTime() > now.getTime()) {
    throw new Error('A valid date of birth is required.');
  }

  // Consent is enforced here, server-side, so it cannot be skipped by calling the action directly.
  // Age comes from the stored date of birth, never from a client-supplied age.
  const consent = validateConsent(submission.consent, {
    age: calculateAge(birthDateObj, now),
    fallbackParticipantName: `${legalFirstName} ${legalLastName}`,
  });

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
    consent,
  };
}

/**
 * Pipeline step: Upserts sensitive demographic survey in the FERPA / NY § 2-D encrypted vault.
 */
export async function upsertDemographicsVault(
  tx: OnboardingTx,
  memberId: string,
  params: {
    legalFirstName: string;
    legalLastName: string;
    birthDateObj: Date;
    submission: PlayerOnboardingSubmission;
  }
): Promise<void> {
  const { legalFirstName, legalLastName, birthDateObj, submission } = params;

  await upsertStudentDemographics(tx, memberId, {
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
  });
}

/**
 * Pipeline step: Provisions School Manager account, linking Supabase Auth and tenancy.
 */
export async function provisionManagerAccount(
  tx: OnboardingTx,
  params: {
    email: string;
    memberId: string;
    schoolId: string;
    password?: string;
    /** Season the manager picked in the wizard; takes precedence over the invite's seeded season. */
    academicYear?: string;
    submissionDraft: Record<string, any> | null;
  }
): Promise<string> {
  const { email, memberId, schoolId, password, submissionDraft } = params;

  let resolvedUserId: string | null = null;
  const staffUserId = await findStaffUserIdByEmail(tx, email);

  if (staffUserId) {
    resolvedUserId = staffUserId;
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
  const submittedSeason = params.academicYear?.trim();
  if (submittedSeason) {
    if (!isValidSeasonName(submittedSeason)) {
      throw new Error('A valid season (e.g. 2026-27) is required.');
    }
  }
  const academicYear =
    submittedSeason ||
    (isValidSeasonName(draft.academicYear) ? draft.academicYear : DEFAULT_MANAGER_SEASON);
  const managedGames = draft.managedGames ?? null;
  const isPrimaryContact = Boolean(draft.isPrimaryContact);

  await upsertSchoolManager(tx, {
    schoolId,
    userId: resolvedUserId,
    memberId,
    academicYear,
    managedGames,
    isPrimaryContact,
  });

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

  const found = await findInviteForSubmission(tokenHash);
  if (!found) {
    throw new Error('Invalid or non-existent invite link.');
  }

  const { invite, isManager, gameSlug } = found;

  if (invite.status !== 'pending') {
    throw new Error(`Cannot submit application: invite is already ${invite.status}.`);
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('Invite link has expired.');
  }

  // Step 1: Validate inputs
  const validated = validateSubmissionInputs(submission);

  // Step 2: Resolve external Riot identity
  const effectiveGameSlug = gameSlug || 'valorant';
  const riotAdapter = options?.riotAdapter ?? new ManualRiotIdAdapter({ isVerified: true });
  const resolvedRiot = await riotAdapter.resolveIdentity(effectiveGameSlug, submission.riotId);

  let createdOrUpdatedMemberId = '';

  // Step 3: Atomic database transaction
  await runOnboardingTransaction(async (tx) => {
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

    // 3d. Consent record (ToS acknowledgment + guardian authorization for under-18s).
    // signedAt is stamped here on the server, never accepted from the client.
    await insertOnboardingConsent(tx, {
      memberId: createdOrUpdatedMemberId,
      schoolId: invite.schoolId,
      inviteKind: isManager ? 'manager' : 'player',
      inviteId: invite.id,
      ...validated.consent,
      signedAt: new Date(),
    });

    // 3e. Role-specific finalization
    if (isManager) {
      await provisionManagerAccount(tx, {
        email: validated.email,
        memberId: createdOrUpdatedMemberId,
        schoolId: invite.schoolId,
        password: submission.password,
        academicYear: submission.academicYear,
        submissionDraft: invite.submissionDraft as Record<string, any> | null,
      });

      await markManagerInviteAccepted(tx, invite.id, createdOrUpdatedMemberId);
    } else {
      await markPlayerInviteSubmitted(tx, invite.id, createdOrUpdatedMemberId);
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
