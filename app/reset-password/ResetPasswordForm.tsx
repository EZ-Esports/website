'use client';

import { useState, useTransition } from 'react';
import { RESET_PASSWORD_MIN_LENGTH } from '@/app/lib/password-reset/constants';
import { resetPassword } from './actions';

const fieldClass =
  'w-full px-4 py-3 bg-surface border border-line/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');
    if (password.length < RESET_PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${RESET_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the login page; only failures return.
      const result = await resetPassword(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground-secondary mb-1">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={RESET_PASSWORD_MIN_LENGTH}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-foreground-secondary mb-1">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={RESET_PASSWORD_MIN_LENGTH}
          className={fieldClass}
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full py-3 min-h-[44px] bg-accent hover:bg-accent/80 text-on-accent font-semibold rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
