'use server';

import crypto from 'node:crypto';
import {
  findInviteByTokenHash,
  findInviteForValidation,
  listOnboardingGames,
  updateInviteDraft,
  type OnboardingGameOption,
} from '@/app/lib/db/onboarding';
import type { ConsentSubmission } from './consent';
import { filterGamesByManaged, sanitizeGameIds } from './play-games';
import { parseSavedOverrides } from './content-check';
import type { GameIdentityPort, CommunityPlatformPort } from './ports';
import { processOnboardingSubmission } from './wizard/submission-pipeline';
import { OnboardingRejection, type OnboardingRejectionCode } from './rejection';
import { readVerifiedDiscord } from './discord-session';

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
      isManager: boolean;
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
      /** Manager invites only: games the manager can say they also play. */
      playableGames?: OnboardingGameOption[];
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
      role?: 'player' | 'manager';
      schoolName?: string;
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

export interface SaveOnboardingDraftParams {
  token: string;
  draftData: Record<string, any>;
}

export interface PlayerOnboardingSubmission {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  graduationYear: number;
  /** Manager only: season applied for, e.g. "2026-27". */
  academicYear?: string;
  password?: string;
  /**
   * Manager only: the manager will also play. The server then also records them as a player of
   * `playGameIds` on the same member. Ignored on player invites; absent means "no".
   */
  alsoPlays?: boolean;
  playGameIds?: string[];
  riotId: string;
  /** Validated and used for the guardian-authorization age check, but not stored anywhere. */
  birthDate: string | Date;
  codeOfConductAccepted: boolean;
  /**
   * Fields the person confirmed are genuinely their information after being warned that they look
   * offensive (see content-check.ts). Only honored for fields the server itself flags.
   */
  contentOverrides?: string[];
  /** Terms of Service acknowledgment and, for under-18s, the guardian authorization. Validated server-side. */
  consent: ConsentSubmission;
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
  success: true;
  inviteId: string;
  memberId: string;
  status: 'submitted' | 'accepted';
  role?: 'player' | 'manager';
  /**
   * Manager who also plays: how many chosen games got a new player application, and how many the
   * member already had a live one for, so the success page never claims a duplicate.
   */
  playerApplicationsCreated?: number;
  playerApplicationsExisting?: number;
}

/** Expected rejection returned (not thrown) so its message survives production error masking. */
export interface SubmitPlayerOnboardingFailure {
  success: false;
  code: OnboardingRejectionCode;
  error: string;
  /** Flagged field keys when `code` is `content_flagged`. */
  fields?: string[];
}

export type SubmitPlayerOnboardingOutcome =
  | SubmitPlayerOnboardingResult
  | SubmitPlayerOnboardingFailure;

/**
 * Keys a draft never carries. The survey keys are legacy: drafts saved while the demographics
 * survey existed may still hold them, and they are dropped on read and write rather than trusted.
 */
const NEVER_DRAFTED_KEYS = new Set([
  'gender',
  'race',
  'ethnicity',
  'countryOfBirth',
  'primaryLanguageAtHome',
  'isFreeOrReducedLunch',
  'isFirstGenCollege',
  'doePetitionConsent',
  'surveyDetails',
  'birthDate',
  'password',
  // Guardian PII and signature are collected at final submit only, never persisted in the draft.
  'consent',
  // Discord identity comes only from the signed OAuth cookie. Drafts saved before OAuth existed may
  // still carry a typed handle or "joined" flag; they are dropped, never read back or trusted.
  'discordUsername',
  'discordUserId',
  'inGuild',
  'discordJoinedConfirmed',
  'discordConnected',
]);

/**
 * Sanitizes in-progress onboarding drafts so personal data (date of birth, password, guardian
 * details) is never read back via invite tokens or persisted in unauthenticated draft slots.
 */
function sanitizeDraftData(
  draft: Record<string, any> | null
): Record<string, any> | null {
  if (!draft || typeof draft !== 'object') return null;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (key === 'contentOverrides') {
      // Only known fields with bounded string values are kept; never trusted as an override at submit.
      sanitized[key] = parseSavedOverrides(value);
    } else if (key === 'alsoPlays') {
      sanitized[key] = value === true;
    } else if (key === 'playGameIds') {
      sanitized[key] = sanitizeGameIds(value);
    } else if (!NEVER_DRAFTED_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Draft keys seeded by staff when they create a manager invite. They scope what the manager may do
 * (`managedGames`, `isPrimaryContact`), so the browser can never set them through a draft save and an
 * existing value always survives a save. `academicYear` is seeded by staff but the manager also picks
 * it in step 1, so it is only filled in from the seed when the wizard sent none.
 */
const STAFF_OWNED_DRAFT_KEYS = ['managedGames', 'isPrimaryContact'] as const;

function mergeStaffOwnedDraftKeys(
  existing: Record<string, any> | null,
  incoming: Record<string, any> | null
): Record<string, any> | null {
  const merged: Record<string, any> = { ...(incoming ?? {}) };
  for (const key of STAFF_OWNED_DRAFT_KEYS) {
    if (existing && Object.prototype.hasOwnProperty.call(existing, key)) merged[key] = existing[key];
    else delete merged[key];
  }
  if (merged.academicYear == null && existing?.academicYear != null) {
    merged.academicYear = existing.academicYear;
  }
  return merged;
}

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

  const row = await findInviteForValidation(tokenHash);

  if (!row) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Invalid or non-existent invite link.',
    };
  }

  const isManager = row.isManager;
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
      role: isManager ? 'manager' : 'player',
      schoolName: row.schoolName,
      message: isManager
        ? 'You have successfully signed up! Your School Manager portal account is active.'
        : 'Invite already accepted.',
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
      role: isManager ? 'manager' : 'player',
      isManager,
      intendedFirstName: invite.intendedFirstName,
      intendedLastName: invite.intendedLastName,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      schoolSlug: row.schoolSlug,
      gameId: resolvedGameId,
      gameName: resolvedGameName,
      gameSlug: resolvedGameSlug,
      submissionDraft: sanitizeDraftData(invite.submissionDraft as Record<string, any> | null),
      expiresAt: invite.expiresAt,
      ...(isManager
        ? {
            playableGames: filterGamesByManaged(
              await listOnboardingGames(),
              (invite.submissionDraft as Record<string, any> | null)?.managedGames
            ),
          }
        : {}),
    };
  }

  return {
    valid: false,
    status: 'invalid',
    message: 'Invalid invite status.',
  };
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

  const found = await findInviteByTokenHash(tokenHash);
  if (!found) {
    throw new Error('Invalid or non-existent invite token');
  }
  const { invite } = found;

  if (invite.status !== 'pending') {
    throw new Error(`Cannot save draft: invite status is ${invite.status}`);
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('Cannot save draft: invite link has expired');
  }

  const sanitized = sanitizeDraftData(draftData);
  // "Also plays" only exists on manager invites; a player draft never carries it.
  if (sanitized && found.kind !== 'manager') {
    delete sanitized.alsoPlays;
    delete sanitized.playGameIds;
  }
  await updateInviteDraft(
    found.kind,
    invite.id,
    found.kind === 'manager'
      ? mergeStaffOwnedDraftKeys(invite.submissionDraft as Record<string, any> | null, sanitized)
      : sanitized
  );

  return {
    success: true,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Server Action: the Discord identity currently verified for this invite, read from the signed
 * httpOnly cookie. The wizard calls it after the second tab finishes OAuth; nothing the browser
 * sends (including the cross-tab message) is ever used as the identity.
 */
export async function getVerifiedDiscordForInvite(
  token: string
): Promise<{ username: string; inGuild: boolean } | null> {
  const verified = await readVerifiedDiscord(token);
  return verified ? { username: verified.discordUsername, inGuild: verified.inGuild } : null;
}

/**
 * Server Action: Validates and atomically processes a player onboarding submission.
 * Delegates execution to the modular submission pipeline.
 */
export async function submitPlayerOnboarding(
  params: SubmitPlayerOnboardingParams
): Promise<SubmitPlayerOnboardingOutcome> {
  // Discord identity comes from the signed OAuth cookie, never from the (client-controlled) submission.
  const verifiedDiscord = await readVerifiedDiscord(params.token);
  try {
    return await processOnboardingSubmission({ ...params, verifiedDiscord });
  } catch (err) {
    if (err instanceof OnboardingRejection) {
      return { success: false, code: err.code, error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    }
    throw err;
  }
}
