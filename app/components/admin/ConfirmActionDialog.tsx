'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { HiExclamationCircle } from 'react-icons/hi2';
import { dangerBtn, ghostBtn, primaryBtn } from '@/app/components/admin/styles';
import { PendingLabel } from '@/app/components/admin/AdminUI';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import { cx } from '@/app/lib/cx';

interface ConfirmActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Explains what the action does; shown under the title. */
  message: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  /** Marks both buttons busy and shows the pending label while the action runs. */
  isPending?: boolean;
  icon?: ReactNode;
  /** `danger` styles the confirm button red and makes Cancel the initially focused control. */
  tone?: 'default' | 'danger';
  /** Failure from the confirmed action. Shown inside the dialog, which stays open so it can be retried or cancelled. */
  error?: string | null;
  /**
   * `portal` is the dark zinc look of the school manager portal, which does not use
   * the admin surface tokens.
   */
  appearance?: 'admin' | 'portal';
  /**
   * Element to focus once the dialog closes. Only needed when the trigger is not the
   * element focused at open time (an item of a menu that closes as the dialog opens).
   */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
}

const surface = {
  admin: {
    overlay: 'admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4',
    modal: 'admin-modal w-full max-w-md outline-none',
    dialog: 'w-full rounded-2xl bg-surface-raised p-6 text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none',
    title: 'text-base font-semibold text-foreground',
    message: 'text-sm leading-6 text-foreground-secondary whitespace-normal',
    icon: 'bg-line/50 text-foreground',
    dangerIcon: 'bg-danger/15 text-danger-on-tint',
    error: 'text-danger-on-tint bg-danger/15',
  },
  portal: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4',
    modal: 'w-full max-w-md outline-none',
    dialog: 'w-full rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 text-left shadow-2xl outline-none',
    title: 'text-base font-bold text-white',
    message: 'text-sm leading-6 text-zinc-400 whitespace-normal',
    icon: 'bg-zinc-800 text-zinc-200',
    dangerIcon: 'bg-rose-500/10 text-rose-300',
    error: 'text-rose-200 bg-rose-500/10 border border-rose-500/30',
  },
} as const;

const portalBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer outline-none focus-visible:ring-2 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed';
const portalCancel = `${portalBtn} text-zinc-300 hover:text-white hover:bg-zinc-800 focus-visible:ring-[#f4cccc]/70`;
const portalDanger = `${portalBtn} text-white bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-300`;
const portalPrimary = `${portalBtn} text-zinc-950 bg-emerald-400 hover:bg-emerald-300 focus-visible:ring-emerald-200`;

/**
 * In-page confirmation for staff and portal actions. A native confirm() is avoided
 * because embedded browsers and some webviews dismiss it before the user can answer,
 * and it can be neither styled nor made accessible. Renders as an alertdialog:
 * React Aria contains focus, closes on Escape or a backdrop press, and returns focus
 * to the control that opened it.
 *
 * While `isPending`, the buttons use `aria-disabled` rather than `disabled` so focus
 * is not dropped to the body mid-action, and a second press is ignored.
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
  tone = 'default',
  error = null,
  appearance = 'admin',
  restoreFocusRef,
  onConfirm,
}: ConfirmActionDialogProps) {
  const s = surface[appearance];
  const messageId = useId();
  const danger = tone === 'danger';

  const wasOpen = useRef(isOpen);
  useEffect(() => {
    const justClosed = wasOpen.current && !isOpen;
    wasOpen.current = isOpen;
    const target = restoreFocusRef?.current;
    if (!justClosed || !target) return;
    // After React Aria's own focus restore, which would otherwise win.
    const frame = requestAnimationFrame(() => target.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, restoreFocusRef]);

  const cancelClass = appearance === 'portal' ? portalCancel : ghostBtn;
  const confirmClass =
    appearance === 'portal' ? (danger ? portalDanger : portalPrimary) : danger ? dangerBtn : primaryBtn;
  // 44px tap targets on touch widths; the admin buttons are 36px on desktop.
  const touch = 'max-sm:min-h-11';

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open);
      }}
      isDismissable={!isPending}
      className={s.overlay}
    >
      <Modal className={s.modal}>
        <Dialog role="alertdialog" aria-label={title} aria-describedby={messageId} className={s.dialog}>
          {({ close }) => (
            <>
              <div className="flex items-start gap-4">
                {(icon || danger) && (
                  <span
                    aria-hidden
                    className={cx(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      danger ? s.dangerIcon : s.icon,
                    )}
                  >
                    {icon ?? <HiExclamationCircle className="h-5 w-5" />}
                  </span>
                )}
                <div className="min-w-0 space-y-1.5">
                  <Heading className={s.title}>{title}</Heading>
                  <p id={messageId} className={s.message}>
                    {message}
                  </p>
                </div>
              </div>

              {error && (
                <p role="alert" className={cx('mt-4 rounded-xl px-4 py-3 text-sm leading-6', s.error)}>
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  // Cancel is the safe default for a destructive confirm, so an Enter
                  // keypress straight after the dialog opens cannot delete anything.
                  autoFocus={danger}
                  onClick={() => {
                    if (!isPending) close();
                  }}
                  aria-disabled={isPending || undefined}
                  className={cx(cancelClass, touch)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPending) onConfirm();
                  }}
                  aria-disabled={isPending || undefined}
                  aria-busy={isPending || undefined}
                  className={cx(confirmClass, touch)}
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
