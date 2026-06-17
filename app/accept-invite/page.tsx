import Link from 'next/link';
import { findValidInvite } from './actions';
import AcceptInviteForm from './AcceptInviteForm';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token ? await findValidInvite(token) : null;

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-background-secondary border border-custom-border/80 rounded-2xl p-8 shadow-2xl space-y-6">
        {!invite ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Invite not valid</h1>
            <p className="text-sm text-foreground-secondary">
              This invite link is invalid, has already been used, or has expired. Ask an existing admin
              to send you a new one.
            </p>
            <Link href="/login" className="inline-block text-sm text-ez-pink hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Accept admin invite</h1>
              <p className="text-sm text-foreground-secondary">
                Set a password for <span className="font-semibold text-foreground">{invite.email}</span> to
                activate your admin account.
              </p>
            </div>
            <AcceptInviteForm token={token!} email={invite.email} />
          </>
        )}
      </div>
    </main>
  );
}
