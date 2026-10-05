'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { HiOutlineTrash } from 'react-icons/hi2';
import { dangerBtn, deleteIconBtn, ghostBtn } from '@/app/components/admin/styles';
import { AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import type { ActionResult } from '@/app/lib/result';

interface ConfirmDeleteButtonProps {
  /** A bound server action or async function that performs the deletion. */
  action: () => void | Promise<void | ActionResult | unknown>;
  /** Confirmation prompt shown before the action runs. */
  message: string;
  /**
   * Accessible name for the button (and its tooltip). Required because the
   * button only contains an icon.
   */
  label: string;
  /** Callback fired when deletion fails. */
  onError?: (error: string) => void;
}

/**
 * Trash-can icon button that opens an accessible alert dialog before submitting
 * a server action deletion. Keeps destructive deletes from firing on accidental click.
 * Disabled while pending; prevents double-clicks; surfaces server errors.
 */
export default function ConfirmDeleteButton({
  action,
  message,
  label,
  onError,
}: ConfirmDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (close: () => void) => {
    if (isPending) return;
    setIsPending(true);
    setError(null);

    try {
      const res = await action();
      if (res && typeof res === 'object' && 'success' in res && (res as ActionResult).success === false) {
        const errorMsg = (res as { error?: string }).error || 'Failed to delete.';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
      close();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete.';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        aria-label={label}
        title={label}
        disabled={isPending}
        className={`${deleteIconBtn} ${isPending ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <FiTrash2 aria-hidden="true" className="h-4 w-4" />
      </button>

      {error && (
        <span
          role="alert"
          aria-live="polite"
          className="admin-fade-in text-xs font-medium text-danger-on-tint"
        >
          {error}
        </span>
      )}

      {/* Admin modal motion (admin-modal-overlay / admin-modal in globals.css):
          RAC keeps the overlay mounted until the exit animation finishes. */}
      <Overlay
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsOpen(open);
        }}
        isDismissable={!isPending}
        className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <Modal className="admin-modal w-full max-w-md outline-none">
          <Dialog
            role="alertdialog"
            aria-label={label}
            className="w-full rounded-2xl bg-surface-raised p-6 text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
          >
            {({ close }) => (
              <>
                <div className="flex items-start gap-4">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger-on-tint">
                    <HiOutlineTrash className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <Heading className="text-base font-semibold text-foreground">
                      Confirm deletion
                    </Heading>
                    <p className="text-sm leading-6 text-foreground-secondary whitespace-normal">
                      {message}
                    </p>
                  </div>
                </div>

                {error && (
                  <AdminNotice tone="danger" className="mt-4">
                    {error}
                  </AdminNotice>
                )}

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={isPending}
                    className={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(close)}
                    disabled={isPending}
                    aria-busy={isPending}
                    className={dangerBtn}
                  >
                    <PendingLabel pending={isPending} label="Delete" pendingLabel="Deleting…" />
                  </button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </Overlay>
    </div>
  );
}
