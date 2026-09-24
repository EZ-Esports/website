'use client';

import { FiTrash2 } from 'react-icons/fi';
import { deleteIconBtn, deleteIconBtnDanger } from '@/app/components/admin/styles';

interface ConfirmDeleteButtonProps {
  /** A bound server action that performs the deletion. */
  action: () => void | Promise<void>;
  /** Confirmation prompt shown before the action runs. */
  message: string;
  /**
   * Accessible name and tooltip for the icon-only trigger. Prefer naming the
   * target ("Delete school Foo") so a screen reader can tell rows apart.
   */
  label?: string;
  /** `danger` keeps the always-red tint used by the application "Remove" rows. */
  tone?: 'neutral' | 'danger';
}

/**
 * Trash-can icon button that submits a server action only after the user
 * confirms. Keeps destructive deletes from firing on a single accidental click.
 */
export default function ConfirmDeleteButton({
  action,
  message,
  label = 'Delete',
  tone = 'neutral',
}: ConfirmDeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="inline-block"
    >
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={tone === 'danger' ? deleteIconBtnDanger : deleteIconBtn}
      >
        <FiTrash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
  );
}
