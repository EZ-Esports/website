import { logout } from '@/app/(admin)/admin/actions';

export default function StaffSetupProblem({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface-raised p-8 text-center shadow-2xl space-y-5">
        <h1 className="text-2xl font-black text-foreground">Account setup needs attention</h1>
        <p className="text-sm leading-relaxed text-foreground-secondary">{message}</p>
        <p className="text-xs text-foreground-muted">
          Your session is still valid. Signing out is optional and will not repair the staff record.
        </p>
        <form action={logout}>
          <button type="submit" className="w-full rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm font-bold text-foreground hover:bg-line">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
