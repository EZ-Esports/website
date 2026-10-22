'use client';

import type { ReactNode } from 'react';
import { ghostBtn, primaryBtn } from '@/app/components/admin/styles';
import { PendingLabel } from '@/app/components/admin/AdminUI';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';

interface ConfirmActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Explains what the action does; shown under the title. */
  message: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  /** Disables both buttons and shows the pending label while the action runs. */
  isPending?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
}

/**
 * In-page confirmation for non-destructive staff actions (the delete flow has its
 * own red variant in ConfirmDeleteButton). A native confirm() is avoided because
 * embedded browsers and some webviews dismiss it before the user can answer.
 */
export default function ConfirmActionDialog({
  isOpen,
  onOpenChange,
  title,
  message,
  confirmLabel,
  pendingLabel,
  isPending = false,
  icon,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open);
      }}
      isDismissable={!isPending}
      className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <Modal className="admin-modal w-full max-w-md outline-none">
        <Dialog
          role="alertdialog"
          aria-label={title}
          className="w-full rounded-2xl bg-surface-raised p-6 text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
        >
          {({ close }) => (
            <>
              <div className="flex items-start gap-4">
                {icon && (
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line/50 text-foreground">
                    {icon}
                  </span>
                )}
                <div className="min-w-0 space-y-1.5">
                  <Heading className="text-base font-semibold text-foreground">{title}</Heading>
                  <p className="text-sm leading-6 text-foreground-secondary whitespace-normal">{message}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" onClick={close} disabled={isPending} className={ghostBtn}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isPending}
                  aria-busy={isPending}
                  className={primaryBtn}
                >
                  <PendingLabel pending={isPending} label={confirmLabel} pendingLabel={pendingLabel ?? `${confirmLabel}…`} />
                </button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </Overlay>
  );
}
