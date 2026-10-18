'use server';

import crypto from 'node:crypto';
import {
  findInviteByTokenHash,
  findInviteForValidation,
  updateInviteDraft,
} from '@/app/lib/db/onboarding';
import type { GameIdentityPort, CommunityPlatformPort } from './ports';
import { processOnboardingSubmission } from './wizard/submission-pipeline';

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

const SENSITIVE_DEMOGRAPHIC_KEYS = new Set([
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
]);

/**
 * Sanitizes in-progress onboarding drafts to strictly exclude sensitive FERPA / PII
 * demographics from being read via invite tokens or persisted in unauthenticated draft slots.
 */
function sanitizeDraftData(
  draft: Record<string, any> | null
): Record<string, any> | null {
  if (!draft || typeof draft !== 'object') return null;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (!SENSITIVE_DEMOGRAPHIC_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
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

  await updateInviteDraft(found.kind, invite.id, sanitizeDraftData(draftData));

  return {
    success: true,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Server Action: Validates and atomically processes a player onboarding submission.
 * Delegates execution to the modular submission pipeline.
 */
export async function submitPlayerOnboarding(
  params: SubmitPlayerOnboardingParams
): Promise<SubmitPlayerOnboardingResult> {
  return processOnboardingSubmission(params);
}
