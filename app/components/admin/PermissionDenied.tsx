import Link from 'next/link';
import { HiOutlineLockClosed } from 'react-icons/hi2';

export default function PermissionDenied() {
  return (
    <section className="min-h-[55vh] flex items-center justify-center px-4" role="alert">
      <div className="max-w-lg text-center rounded-2xl border border-line bg-surface-raised/40 p-8 space-y-4">
        <HiOutlineLockClosed className="mx-auto h-9 w-9 text-foreground-muted" aria-hidden="true" />
        <h1 className="text-2xl font-black text-foreground">Permission required</h1>
        <p className="text-sm leading-relaxed text-foreground-secondary">
          You are signed in, but your current roles do not grant access to this section.
          Ask a staff member with role-management permission if you need access.
        </p>
        <Link href="/admin" className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-bold text-on-accent">
          Return to overview
        </Link>
      </div>
    </section>
  );
}
