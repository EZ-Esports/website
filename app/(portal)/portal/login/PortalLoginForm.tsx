'use client';

import { useActionState } from 'react';
import { Field, Input } from '@/app/components/ui/form';
import { portalLogin } from './actions';
import { useFormStatus } from 'react-dom';
import Button from '@/app/components/ui/Button';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      aria-busy={pending}
      className="w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing into Portal…' : 'Sign In to School Portal'}
    </Button>
  );
}

export default function PortalLoginForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, formAction] = useActionState(portalLogin, null);

  return (
    <form action={formAction} className="space-y-4">
      {/* Error Alert from Server Action State */}
      {state?.error && (
        <div
          className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-lg flex items-start gap-2"
          role="alert"
        >
          <svg
            className="w-5 h-5 text-danger shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <Field label="Manager Email Address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="manager@school.edu"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
