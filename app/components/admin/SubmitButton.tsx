'use client';

import { useFormStatus } from 'react-dom';
import { cx } from '@/app/lib/cx';
import { adminButton, type AdminButtonSize, type AdminButtonTone } from '@/app/components/admin/styles';
import { PendingLabel } from '@/app/components/admin/AdminUI';

interface SubmitButtonProps {
  label: string;
  pendingLabel?: string;
  /** Admin button tone; the form's main submit is `primary`. */
  tone?: AdminButtonTone;
  size?: AdminButtonSize;
  /** Extra layout classes (e.g. `w-full`), appended to the admin button style. */
  className?: string;
}

/**
 * A submit button that uses useFormStatus to disable itself during form
 * submission and show a spinner with the pending label. Must be rendered
 * inside a <form> element.
 */
export default function SubmitButton({ label, pendingLabel, tone = 'primary', size = 'md', className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cx(adminButton(tone, size), className)}>
      <PendingLabel pending={pending} label={label} pendingLabel={pendingLabel ?? `${label}…`} />
    </button>
  );
}
