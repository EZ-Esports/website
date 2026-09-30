'use client';

import { useFormStatus } from 'react-dom';
import Button from '@/app/components/ui/Button';

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
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </Button>
  );
}
