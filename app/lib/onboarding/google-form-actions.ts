'use server';

import crypto from 'node:crypto';
import { findInviteByTokenHash, type InviteKind } from '@/app/lib/db/onboarding';
import { hasFormCompletion } from '@/app/lib/db/onboarding-form';
import { getOnboardingFormConfig } from './google-form/config';
import { buildPrefillUrl } from './google-form/settings';
import { signFormToken } from './google-form/token';
import { rateLimit } from '@/app/lib/rate-limit';

/**
 * Server actions behind the wizard's "Onboarding form" step (spec-051). The browser only ever
 * holds its invite token; it never sees the signing key, and completion is read from the
 * database, never taken from anything the browser reports.
 */

export interface OnboardingFormState {
  /** False when staff have not configured the form: the wizard then has no such step. */
  enabled: boolean;
  completed: boolean;
}

/** Shared by the join page (server render) and the polling action. */
export async function resolveOnboardingFormState(kind: InviteKind, inviteId: string): Promise<OnboardingFormState> {
  const config = await getOnboardingFormConfig();
  if (!config.enabled) return { enabled: false, completed: false };
  return { enabled: true, completed: await hasFormCompletion(kind, inviteId) };
}

async function findLivePendingInvite(token: string) {
  if (!token?.trim()) return null;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const found = await findInviteByTokenHash(tokenHash);
  if (!found || found.invite.status !== 'pending') return null;
  if (found.invite.expiresAt && new Date(found.invite.expiresAt).getTime() < Date.now()) return null;
  return { kind: found.kind, inviteId: found.invite.id };
}

/** Whether the form is required for this invite and whether the webhook has confirmed it. */
export async function getOnboardingFormState(token: string): Promise<OnboardingFormState> {
  const invite = await findLivePendingInvite(token);
  if (!invite) return { enabled: false, completed: false };
  if (!rateLimit(`gform-state:${invite.inviteId}`, 400, 10 * 60_000).allowed) {
    // Treated as "unknown, keep waiting" by the wizard; never as completed.
    return { enabled: true, completed: false };
  }
  return resolveOnboardingFormState(invite.kind, invite.inviteId);
}

export type OnboardingFormLinkResult =
  | { ok: true; url: string; /** Epoch milliseconds after which the code in the link stops working. */ expiresAt: number }
  | { ok: false; error: string };

/**
 * A fresh form link with a short-lived verification code prefilled for this invite. Each call
 * issues a new code, so "Open the form again" always works after a code has expired.
 */
export async function issueOnboardingFormLink(token: string): Promise<OnboardingFormLinkResult> {
  const invite = await findLivePendingInvite(token);
  if (!invite) return { ok: false, error: 'This invite link is no longer valid. Ask your coach for a new one.' };
  if (!rateLimit(`gform-link:${invite.inviteId}`, 30, 10 * 60_000).allowed) {
    return { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' };
  }
  const config = await getOnboardingFormConfig();
  if (!config.enabled || !config.formUrl || !config.entryId) {
    return { ok: false, error: 'The onboarding form is not available right now.' };
  }
  const { token: code, expiresAt } = signFormToken({ kind: invite.kind, inviteId: invite.inviteId });
  return { ok: true, url: buildPrefillUrl(config.formUrl, config.entryId, code), expiresAt: expiresAt * 1000 };
}
