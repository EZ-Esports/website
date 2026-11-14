import type { Metadata } from 'next';
import Link from 'next/link';
import { passwordResetService } from '@/app/lib/password-reset/server';
import { INVALID_RESET_LINK_MESSAGE } from '@/app/lib/password-reset/core';
import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reset Password | EZ Esports',
  // A bearer token sits in this URL; keep it out of indexes and away from referrers.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await passwordResetService.peek(token).catch(() => false) : false;

  return (
    <main className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-raised border border-line/80 rounded-2xl p-8 shadow-2xl space-y-6">
        {!valid ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Reset link not valid</h1>
            <p className="text-sm text-foreground-secondary">
              {INVALID_RESET_LINK_MESSAGE}
            </p>
            <Link href="/portal/login" className="inline-block text-sm text-accent hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Choose a new password</h1>
              <p className="text-sm text-foreground-secondary">
                Your current password keeps working until you save a new one. You will be asked to sign in again afterwards.
              </p>
            </div>
            <ResetPasswordForm token={token!} />
          </>
        )}
      </div>
    </main>
  );
}
