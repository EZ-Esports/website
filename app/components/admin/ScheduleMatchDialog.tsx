'use client';

import { HiXMark } from 'react-icons/hi2';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import { iconBtnSm } from '@/app/components/admin/styles';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import type { ComponentProps } from 'react';

type FormProps = Omit<ComponentProps<typeof MatchScheduleForm>, 'onSuccess' | 'onCancel'>;

interface ScheduleMatchDialogProps extends FormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the match is created, once the dialog has been asked to close. */
  onScheduled: () => void;
}

/**
 * "Schedule match" modal around the existing MatchScheduleForm (same createMatch
 * action and Eastern-time handling). RAC supplies focus containment, Escape and
 * returning focus to the button that opened it; the admin-modal classes carry
 * the shared motion, which globals.css turns off for reduced motion.
 */
export default function ScheduleMatchDialog({ isOpen, onOpenChange, onScheduled, ...formProps }: ScheduleMatchDialogProps) {
  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <Modal className="admin-modal max-h-full w-full max-w-lg outline-none">
        <Dialog className="max-h-[calc(100dvh-2rem)] w-full overflow-auto rounded-2xl bg-surface-raised p-5 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none sm:p-6">
          {({ close }) => (
            <>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Heading className="text-base font-semibold text-foreground">Schedule a match</Heading>
                  <p className="mt-0.5 text-sm text-foreground-secondary">Times are Eastern Time (ET).</p>
                </div>
                <button type="button" onClick={close} aria-label="Close" className={iconBtnSm}>
                  <HiXMark aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <MatchScheduleForm
                {...formProps}
                onCancel={close}
                onSuccess={() => {
                  close();
                  onScheduled();
                }}
              />
            </>
          )}
        </Dialog>
      </Modal>
    </Overlay>
  );
}
