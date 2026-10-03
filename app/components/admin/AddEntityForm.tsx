'use client';

import { useActionState, useEffect, useRef } from 'react';
import { AdminNotice } from '@/app/components/admin/AdminUI';

type Result = { success?: boolean; error?: string } | void;

/**
 * Wraps an "add/create" form so a server action that returns { success, error }
 * surfaces failures inline (e.g. a duplicate name) instead of throwing to the
 * page-level error boundary, and resets the form on success. Mirrors the
 * pending/feedback pattern used by the Matches and League Setup forms.
 */
export default function AddEntityForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<Result>;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (_prev: { success?: boolean; error?: string }, formData: FormData) => {
      const res = await action(formData);
      return res ?? { success: true };
    },
    {},
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error && (
        <AdminNotice tone="danger" className="sm:col-span-full">
          {state.error}
        </AdminNotice>
      )}
    </form>
  );
}
