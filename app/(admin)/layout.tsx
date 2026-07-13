import { getAdmin } from '@/app/lib/auth';
import { logout } from './admin/actions';

/**
 * Server-side authorization gate for the entire (admin) route group.
 *
 * Middleware only proves a user is *authenticated* (redirects anonymous traffic
 * to /login); it cannot cheaply check the allowlist on the edge. This layout is
 * where authorization happens: an authenticated user with no `admin_users` row
 * gets the "not authorized" screen instead of the panel.
 *
 * We render a screen (HTTP 200) rather than redirecting to /login, because the
 * login middleware bounces authenticated users straight back to /admin — a
 * redirect here would create a loop. The screen offers a sign-out instead.
 */
export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();

  if (!admin) {
    return (
      <main className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-surface-raised border border-line/80 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Access denied
            </h1>
            <p className="text-sm text-foreground-secondary">
              Your account is signed in but is not authorized for the admin
              panel. Ask an existing admin to send you an invite.
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full py-3 bg-surface-raised hover:bg-line text-foreground font-semibold rounded-lg border border-line/80 transition-all cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
