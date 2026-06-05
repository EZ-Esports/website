'use client';

interface ConfirmDeleteButtonProps {
  /** A bound server action that performs the deletion. */
  action: () => void | Promise<void>;
  /** Confirmation prompt shown before the action runs. */
  message: string;
  label?: string;
  className?: string;
}

/**
 * Submits a server action only after the user confirms.
 * Keeps destructive deletes from firing on a single accidental click.
 */
export default function ConfirmDeleteButton({
  action,
  message,
  label = 'Delete',
  className,
}: ConfirmDeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="inline-block"
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
