'use client';

import { FiTrash2 } from 'react-icons/fi';
import { deleteIconBtn } from '@/app/components/admin/styles';

interface ConfirmDeleteButtonProps {
  /** A bound server action that performs the deletion. */
  action: () => void | Promise<void>;
  /** Confirmation prompt shown before the action runs. */
  message: string;
  /**
   * Required accessible name and tooltip for the icon-only trigger. Name the
   * target ("Delete school Foo") so a screen reader can tell rows apart.
   */
  label: string;
}

/**
 * Trash-can icon button that submits a server action only after the user
 * confirms. Keeps destructive deletes from firing on a single accidental click.
 */
export default function ConfirmDeleteButton({
  action,
  message,
  label,
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
        className={deleteIconBtn}
      >
        <FiTrash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
  );
}
