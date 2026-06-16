'use client';

import { useState, useTransition } from 'react';
import { acceptInvite } from './actions';

const MIN_PASSWORD_LENGTH = 8;

export default function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const password = (formData.get('password') as string) ?? '';
    const confirm = (formData.get('confirm') as string) ?? '';

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    startTransition(async () => {
      // On success the action redirects (throws NEXT_REDIRECT); only failures return.
      const result = await acceptInvite(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="block text-sm font-medium text-foreground-secondary mb-1">Email</label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full px-4 py-3 bg-background/60 border border-custom-border/80 rounded-lg text-foreground-secondary cursor-not-allowed"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground-secondary mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-background border border-custom-border/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-foreground-secondary mb-1">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-background border border-custom-border/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all"
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
        className="w-full py-3 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-semibold rounded-lg shadow-lg hover:shadow-ez-pink/20 focus:outline-none focus:ring-2 focus:ring-ez-pink transition-all cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
