'use server';

import { redirect } from 'next/navigation';
import { passwordResetService } from '@/app/lib/password-reset/server';
import { isResetBlocked, recordFailedResetAttempt } from '@/app/lib/password-reset/rate-limit';
import {
  INVALID_RESET_LINK_MESSAGE,
  RESET_PASSWORD_MIN_LENGTH,
  loginPathForKind,
} from '@/app/lib/password-reset/core';

/**
 * Public action: the token authorizes exactly one thing, setting a new password
 * for its target user. It does not sign anyone in; on success the visitor is sent
 * to the matching login page to sign in with the new password.
 */
export async function resetPassword(formData: FormData): Promise<{ error: string }> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (await isResetBlocked()) {
    return { error: 'Too many attempts. Please try again in 15 minutes.' };
  }
  if (password.length < RESET_PASSWORD_MIN_LENGTH) {
    return { error: `Password must be at least ${RESET_PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  let loginPath: string;
  try {
    const result = await passwordResetService.redeem(token, password);
    if (!result.ok) {
      // Only a dead or unknown link counts toward the throttle; typos in the password do not.
      if (!result.retryable) await recordFailedResetAttempt();
      return { error: result.error };
    }
    loginPath = loginPathForKind(result.kind);
  } catch (error) {
    await recordFailedResetAttempt();
    console.error('Password reset failed', error instanceof Error ? error.message : error);
    return { error: INVALID_RESET_LINK_MESSAGE };
  }

  redirect(`${loginPath}?message=password-reset`);
}
