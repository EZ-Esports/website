'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  label: string;
  pendingLabel?: string;
  className?: string;
}

/**
 * A submit button that uses useFormStatus to disable itself during form submission.
 * Must be rendered inside a <form> element.
 */
export default function SubmitButton({ label, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
    >
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  );
}
