'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { deleteIconBtn } from '@/app/components/admin/styles';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';

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
 * Trash-can icon button that opens an accessible alert dialog before submitting
 * a server action deletion. Keeps destructive deletes from firing on accidental click.
 */
export default function ConfirmDeleteButton({
  action,
  message,
  label,
}: ConfirmDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={label}
        title={label}
        className={deleteIconBtn}
      >
        <FiTrash2 aria-hidden="true" className="h-4 w-4" />
      </button>

      <Overlay
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
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
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-lg border border-line bg-surface-raised hover:bg-surface-raised/80 text-foreground text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <form
                    action={async () => {
                      close();
                      await action();
                    }}
                  >
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </Overlay>
    </>
  );
}
