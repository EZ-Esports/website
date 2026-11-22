'use server';

import { requireStaff } from '@/app/lib/auth';
import { rateLimit } from '@/app/lib/rate-limit';
import { passwordResetService } from '@/app/lib/password-reset/server';
import type { IssuedLinkView } from '@/app/lib/password-reset/core';

// Manager accounts only. Staff resets are deliberately not offered (spec-064), and the
// service is wired with enabledKinds: ['manager'] as well, so a crafted call cannot
// reach them. The service checks MANAGE_SCHOOLS and the staff-hierarchy rule.

const ISSUE_RATE_LIMIT = 20;
const ISSUE_RATE_WINDOW_MS = 60_000;
const NOT_ALLOWED = 'Could not complete that request.';

export interface IssueResetLinkResult {
  success: boolean;
  error?: string;
  /** Path (not origin) of the one-time link. Returned once; the raw token is never stored or logged. */
  resetPath?: string;
  expiresAt?: string;
}

export async function issuePasswordResetLink(params: { userId: string }): Promise<IssueResetLinkResult> {
  const staff = await requireStaff();
  if (typeof params?.userId !== 'string' || !params.userId) return { success: false, error: NOT_ALLOWED };
  const limited = rateLimit(`password-reset-issue:${staff.id}`, ISSUE_RATE_LIMIT, ISSUE_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return { success: false, error: 'Too many reset links issued. Please slow down and try again shortly.' };
  }
  try {
    const result = await passwordResetService.issue(staff, { userId: params.userId, kind: 'manager' });
    if (!result.success) return { success: false, error: result.error };
    return {
      success: true,
      resetPath: `/reset-password?token=${result.token}`,
      expiresAt: result.expiresAt.toISOString(),
    };
  } catch (error) {
    // Deliberately not logging the result: it holds the raw token.
    console.error('Failed to issue password reset link', error instanceof Error ? error.message : error);
    return { success: false, error: 'Could not issue a reset link. Please try again.' };
  }
}

export async function revokePasswordResetLink(linkId: string): Promise<{ success: boolean; error?: string }> {
  const staff = await requireStaff();
  if (typeof linkId !== 'string' || !linkId) return { success: false, error: NOT_ALLOWED };
  try {
    return await passwordResetService.revoke(staff, linkId);
  } catch (error) {
    console.error('Failed to revoke password reset link', error);
    return { success: false, error: 'Could not revoke the link. Please try again.' };
  }
}

export async function listPasswordResetLinks(params: { userId: string }): Promise<IssuedLinkView[]> {
  const staff = await requireStaff();
  if (typeof params?.userId !== 'string' || !params.userId) return [];
  try {
    return await passwordResetService.list(staff, { userId: params.userId, kind: 'manager' });
  } catch (error) {
    console.error('Failed to list password reset links', error);
    return [];
  }
}
