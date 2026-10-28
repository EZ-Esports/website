import crypto from 'node:crypto';
import {
  ensurePlayerSubmission,
  findDiscordIdentityOwner,
  listOnboardingGames,
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
import { db } from '@/app/lib/db';
import { insertContentFlag } from '@/app/lib/db/content-flags';
import {
  CONTENT_FLAGGED_MESSAGE,
  FIELD_TOO_LONG_MESSAGE,
  collectContentValues,
  evaluateContent,
  findTooLongFields,
} from '../content-check';
import { ManualRiotIdAdapter } from '../adapters/riot-manual';
import { updateCacheTags, CACHE_TAGS } from '@/app/lib/cache';
import {
  calculateAge,
  isPlausibleBirthDate,
  validateConsent,
  type NormalizedConsent,
} from '../consent';
import { isValidSeasonName, DEFAULT_MANAGER_SEASON } from '@/app/lib/season-name';
import { OnboardingRejection, isDiscordIdentityUniqueViolation } from '../rejection';
import type { VerifiedDiscord } from '../discord-verification';
import { filterGamesByManaged, sanitizeGameIds } from '../play-games';
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
  if (!isPlausibleBirthDate(birthDateObj, now)) {
    throw new Error('A valid date of birth is required.');
  }

  // Consent is enforced here, server-side, so it cannot be skipped by calling the action directly.
  // Age comes from the stored date of birth, never from a client-supplied age.
  const consent = validateConsent(submission.consent, {
    age: calculateAge(birthDateObj, now),
    fallbackParticipantName: `${legalFirstName} ${legalLastName}`,
  });

  return {
    email,
    legalFirstName,
    legalLastName,
    gradYear,
    birthDateObj,
    consent,
  };
}

export const MANAGER_PASSWORD_MIN_LENGTH = 8;

const MANAGER_PASSWORD_MESSAGE =
  'Please re-enter a password of at least 8 characters for the School Manager Portal. It is not kept while you connect Discord.';

function hasUsablePassword(password: string | undefined): password is string {
  return typeof password === 'string' && password.length >= MANAGER_PASSWORD_MIN_LENGTH;
}

/**
 * Existing Supabase Auth user for this email, if the service client is configured and finds one.
 * Such a manager keeps their current credentials, so no new password is needed.
 */
async function findExistingAuthUserId(email: string): Promise<string | null> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const { createServiceClient } = await import('@/app/lib/supabase/service');
    const { data: list } = await createServiceClient().auth.admin.listUsers();
    return list?.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  } catch (err) {
    console.warn('Could not look up existing Supabase Auth user for manager:', err);
    return null;
  }
}

const DISCORD_ALREADY_LINKED_MESSAGE =
  'This Discord account is already linked to another EZ Esports member. Please reconnect with a different Discord account, or contact EZ Esports if you think this is a mistake.';

export interface ResolvedDiscordIdentity {
  discordUserId: string;
  discordUsername: string;
  inGuild: boolean;
}

/**
 * Decides which Discord identity is persisted. Everyone (players and school managers) must have
 * completed Discord OAuth: the identity comes only from the signed server-side verification, bound
 * to this invite. The submission payload carries no Discord fields, so the browser cannot assert one.
 */
export function resolveDiscordIdentity(params: {
  verifiedDiscord: VerifiedDiscord | null | undefined;
}): ResolvedDiscordIdentity {
  const { verifiedDiscord } = params;

  if (!verifiedDiscord) {
    throw new OnboardingRejection(
      'discord_required',
      'Your Discord connection is missing or has expired. Please reconnect your Discord account.'
    );
  }
  if (!verifiedDiscord.inGuild) {
    throw new OnboardingRejection(
      'discord_not_in_guild',
      'We could not confirm you are in the EZ Esports Discord server. Please reconnect your Discord account.'
    );
  }
  return {
    discordUserId: verifiedDiscord.discordUserId,
    discordUsername: verifiedDiscord.discordUsername,
    inGuild: true,
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
 * The season a manager is affiliated with: the one picked in the wizard, else the invite's seeded
 * one, else the default. Also names the season a manager's own player application belongs to.
 */
export function resolveManagerAcademicYear(
  submitted: string | undefined,
  draft: Record<string, any> | null
): string {
  const submittedSeason = submitted?.trim();
  if (submittedSeason && !isValidSeasonName(submittedSeason)) {
    throw new Error('A valid season (e.g. 2026-27) is required.');
  }
  return (
    submittedSeason ||
    (isValidSeasonName(draft?.academicYear) ? draft!.academicYear : DEFAULT_MANAGER_SEASON)
  );
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
    // A manager who already has an auth account keeps it. Only a brand-new account needs the password
    // the manager chose; there is deliberately no generated fallback, because a random password would
    // lock the manager out of the portal they just signed up for.
    resolvedUserId = await findExistingAuthUserId(email);
    if (!resolvedUserId) {
      if (!hasUsablePassword(password)) {
        throw new OnboardingRejection('manager_password_required', MANAGER_PASSWORD_MESSAGE);
      }
      try {
        if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const { createServiceClient } = await import('@/app/lib/supabase/service');
          const supabase = createServiceClient();
          const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (created?.user) {
            resolvedUserId = created.user.id;
          } else if (createError) {
            resolvedUserId = await findExistingAuthUserId(email);
          }
        }
      } catch (authErr) {
        console.warn('Could not provision Supabase Auth user for manager:', authErr);
      }
    }
  }

  if (!resolvedUserId) {
    resolvedUserId = crypto.randomUUID();
  }

  const draft = submissionDraft || {};
  const academicYear = resolveManagerAcademicYear(params.academicYear, draft);
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
  params: SubmitPlayerOnboardingParams & {
    /** Read from the signed cookie by the server action; never from the client payload. */
    verifiedDiscord?: VerifiedDiscord | null;
  }
): Promise<SubmitPlayerOnboardingResult> {
  const { token, submission, options, verifiedDiscord } = params;

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
  const discord = resolveDiscordIdentity({
    verifiedDiscord:
      verifiedDiscord && verifiedDiscord.inviteHash === tokenHash ? verifiedDiscord : null,
  });

  // Offensive-content screen. The server recomputes what is flagged from the submitted values and
  // honors an override only for a field that is flagged, so the browser cannot skip the check.
  // Nothing has been written yet, so a block here leaves no trace.
  const contentValues = collectContentValues(
    // The normalized consent, not the raw one: an adult's leftover guardian fields are dropped there.
    { ...submission, consent: validated.consent },
    discord.discordUsername
  );
  const tooLong = findTooLongFields(contentValues);
  if (tooLong.length > 0) {
    throw new OnboardingRejection('field_too_long', FIELD_TOO_LONG_MESSAGE, tooLong);
  }
  const contentCheck = evaluateContent(contentValues, submission.contentOverrides);
  if (contentCheck.blocked.length > 0) {
    throw new OnboardingRejection(
      'content_flagged',
      CONTENT_FLAGGED_MESSAGE,
      contentCheck.blocked.map((f) => f.field)
    );
  }

  // A new manager account needs the password they chose. Checked before anything is written or any
  // auth user is created; staff and existing auth users keep their current credentials.
  if (isManager && !hasUsablePassword(submission.password)) {
    const hasAccount =
      Boolean(await findStaffUserIdByEmail(db, validated.email)) ||
      Boolean(await findExistingAuthUserId(validated.email));
    if (!hasAccount) {
      throw new OnboardingRejection('manager_password_required', MANAGER_PASSWORD_MESSAGE);
    }
  }

  // A manager who also plays names the games they play. Resolved against the games table before
  // anything is written, so an unknown or browser-invented id can never create a record. Only games
  // the invite lets this manager manage are accepted: otherwise they could not see or approve their
  // own application in the portal (getAuthorizedGameScopes uses the same managedGames rule).
  let playGames: Array<{ id: string; slug: string; displayName: string }> = [];
  let applicationsCreated = 0;
  if (isManager && submission.alsoPlays === true) {
    const requested = sanitizeGameIds(submission.playGameIds);
    const offered = filterGamesByManaged(
      await listOnboardingGames(),
      (invite.submissionDraft as Record<string, any> | null)?.managedGames
    );
    playGames = offered.filter((g) => requested.includes(g.id));
    if (requested.length === 0 || playGames.length !== requested.length) {
      throw new OnboardingRejection(
        'play_games_required',
        'Please choose at least one game you will play, from the games you manage.'
      );
    }
  }

  // Step 2: Resolve external Riot identity
  const effectiveGameSlug = gameSlug || playGames[0]?.slug || 'valorant';
  const riotAdapter = options?.riotAdapter ?? new ManualRiotIdAdapter({ isVerified: true });
  const resolvedRiot = await riotAdapter.resolveIdentity(effectiveGameSlug, submission.riotId);

  let createdOrUpdatedMemberId = '';

  // Step 3: Atomic database transaction
  try {
    await runOnboardingTransaction(async (tx) => {
      // 3a. Member
      createdOrUpdatedMemberId = await upsertMemberRecord(tx, {
        email: validated.email,
        legalFirstName: validated.legalFirstName,
        legalLastName: validated.legalLastName,
        discordUsername: discord.discordUsername,
        gradYear: validated.gradYear,
        schoolId: invite.schoolId,
      });

      // 3b. Identities (Riot + Discord). One Discord account may belong to only one member.
      const discordOwner = await findDiscordIdentityOwner(tx, discord.discordUserId);
      if (discordOwner && discordOwner !== createdOrUpdatedMemberId) {
        throw new OnboardingRejection('discord_already_linked', DISCORD_ALREADY_LINKED_MESSAGE);
      }
      await upsertPlayerIdentities(tx, createdOrUpdatedMemberId, {
        riotIdentifier: resolvedRiot.rawIdentifier,
        discordUserId: discord.discordUserId,
        discordUsername: discord.discordUsername,
        inGuild: discord.inGuild,
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

      // 3e. Staff review record for any warning the person overrode. A missing table (migration not
      // applied yet) skips only this record; it never fails the onboarding.
      if (contentCheck.overridden.length > 0) {
        await insertContentFlag(tx, {
          memberId: createdOrUpdatedMemberId,
          schoolId: invite.schoolId,
          inviteKind: isManager ? 'manager' : 'player',
          inviteId: invite.id,
          fields: contentCheck.overridden,
        });
      }

      // 3f. Role-specific finalization
      if (isManager) {
        await provisionManagerAccount(tx, {
          email: validated.email,
          memberId: createdOrUpdatedMemberId,
          schoolId: invite.schoolId,
          password: submission.password,
          academicYear: submission.academicYear,
          submissionDraft: invite.submissionDraft as Record<string, any> | null,
        });

        // 3g. Manager who also plays: the SAME member (matched by email above, one Discord identity)
        // also gets a submitted player application per chosen game (reviewed like any student's), so they never need a second invite.
        for (const game of playGames) {
          const created = await ensurePlayerSubmission(tx, {
            memberId: createdOrUpdatedMemberId,
            schoolId: invite.schoolId,
            gameId: game.id,
            invitedByUserId: invite.invitedByUserId,
            intendedFirstName: validated.legalFirstName,
            intendedLastName: validated.legalLastName,
            tokenHash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
          });
          if (created) applicationsCreated += 1;
        }

        await markManagerInviteAccepted(tx, invite.id, createdOrUpdatedMemberId);
      } else {
        await markPlayerInviteSubmitted(tx, invite.id, createdOrUpdatedMemberId);
      }
    });
  } catch (err) {
    // Two submissions racing for the same Discord id: the unique index decides. Never reveal the owner.
    if (isDiscordIdentityUniqueViolation(err)) {
      throw new OnboardingRejection('discord_already_linked', DISCORD_ALREADY_LINKED_MESSAGE);
    }
    throw err;
  }

  // Step 4: Invalidate cache tags
  if (isManager) {
    updateCacheTags(CACHE_TAGS.PLAYERS, CACHE_TAGS.MEMBERS, CACHE_TAGS.SCHOOLS);
    return {
      success: true,
      inviteId: invite.id,
      memberId: createdOrUpdatedMemberId,
      status: 'accepted',
      role: 'manager',
      ...(playGames.length > 0
        ? {
            playerApplicationsCreated: applicationsCreated,
            playerApplicationsExisting: playGames.length - applicationsCreated,
          }
        : {}),
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
