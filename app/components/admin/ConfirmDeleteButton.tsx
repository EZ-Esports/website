'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { deleteIconBtn } from '@/app/components/admin/styles';
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
      if (!window.confirm(message)) {
        setIsPending(false);
        return;
      }

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
          className="text-[10px] text-red-400 font-semibold"
        >
          {error}
        </span>
      )}

      <Overlay
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsOpen(open);
        }}
        isDismissable={!isPending}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      >
        <Modal className="w-full max-w-md outline-none">
          <Dialog
            role="alertdialog"
            aria-label={label}
            className="bg-surface-sunken border border-line rounded-2xl w-full p-6 shadow-2xl outline-none"
          >
            {({ close }) => (
              <>
                <Heading className="text-lg font-bold text-foreground mb-2">
                  Confirm Deletion
                </Heading>
                <p className="text-sm text-foreground-secondary mb-6 leading-relaxed">
                  {message}
                </p>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium"
                  >
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={close}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg border border-line bg-surface-raised hover:bg-surface-raised/80 text-foreground text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(close)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Deleting…' : 'Delete'}
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
