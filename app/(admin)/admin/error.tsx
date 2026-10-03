'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { AdminEmptyState } from '@/app/components/admin/AdminUI';
import { ghostBtn, secondaryBtn } from '@/app/components/admin/styles';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Admin error boundary: same centred anatomy as PermissionDenied, in the danger tone. */
export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Admin Error]', error);
  }, [error]);

  return (
    <section className="admin-page-enter flex min-h-[55vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl bg-admin-panel">
        <AdminEmptyState
          icon={<HiOutlineExclamationTriangle />}
          tone="danger"
          alert
          titleAs="h1"
          title="Something went wrong"
          description={
            <>
              {error.message || 'An unexpected error occurred loading this page.'}
              {error.digest && (
                <span className="mt-2 block font-mono text-xs text-foreground-secondary">Error ID: {error.digest}</span>
              )}
            </>
          }
          action={
            <div className="flex items-center gap-2">
              <Link href="/admin" className={ghostBtn}>
                Back to overview
              </Link>
              <button type="button" onClick={reset} className={secondaryBtn}>
                Try again
              </button>
            </div>
          }
        />
      </div>
    </section>
  );
}
