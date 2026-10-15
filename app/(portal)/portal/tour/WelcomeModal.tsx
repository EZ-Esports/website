'use client';

import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import {
  HiOutlineAcademicCap,
  HiOutlineCheckBadge,
  HiOutlinePaperAirplane,
  HiOutlineUserGroup,
} from 'react-icons/hi2';

interface WelcomeModalProps {
  isOpen: boolean;
  schoolName?: string;
  /** Begin the full tour. */
  onStart: () => void;
  /** Dismiss without touring (button, Escape or backdrop). */
  onDismiss: () => void;
}

const HIGHLIGHTS = [
  { icon: HiOutlinePaperAirplane, label: 'Invite players with a single-use link' },
  { icon: HiOutlineCheckBadge, label: 'Approve submissions in one click' },
  { icon: HiOutlineUserGroup, label: 'Build rosters and check eligibility' },
] as const;

/**
 * First-run greeting shown before the guided tour so it does not start abruptly.
 * Motion lives in globals.css (`welcome-*`); RAC holds the modal mounted until the
 * exit animation finishes via `data-exiting`.
 */
export default function WelcomeModal({
  isOpen,
  schoolName,
  onStart,
  onDismiss,
}: WelcomeModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      isDismissable
      className="welcome-overlay fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <Modal className="welcome-card relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-2xl outline-none">
        <Dialog
          aria-label="Welcome to the Manager Portal"
          className="relative p-6 text-center outline-none sm:p-8"
        >
          <div
            aria-hidden="true"
            className="welcome-glow pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl"
          />

          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span
              aria-hidden="true"
              className="welcome-ring absolute inset-0 rounded-2xl bg-accent/30"
            />
            <span className="welcome-icon relative flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/40 bg-surface text-accent">
              <HiOutlineAcademicCap className="h-8 w-8" aria-hidden="true" />
            </span>
          </div>

          <p
            className="welcome-rise relative mt-5 text-[11px] font-bold uppercase tracking-widest text-accent"
            style={{ animationDelay: '160ms' }}
          >
            Manager Portal
          </p>
          <Heading
            slot="title"
            className="welcome-rise relative mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl"
            style={{ animationDelay: '220ms' }}
          >
            Welcome{schoolName ? `, ${schoolName}` : ''}
          </Heading>
          <p
            className="welcome-rise relative mt-3 text-sm leading-relaxed text-foreground-secondary"
            style={{ animationDelay: '280ms' }}
          >
            This is your control deck for getting students onto a team. Take a
            quick tour and you will be ready in about a minute.
          </p>

          <ul className="relative mt-5 space-y-2 text-left">
            {HIGHLIGHTS.map(({ icon: Icon, label }, i) => (
              <li
                key={label}
                className="welcome-rise flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-foreground"
                style={{ animationDelay: `${360 + i * 80}ms` }}
              >
                <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div
            className="welcome-rise relative mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center"
            style={{ animationDelay: '640ms' }}
          >
            <Button
              onPress={onDismiss}
              className="min-h-[44px] cursor-pointer rounded-lg px-4 text-sm font-medium text-foreground-muted outline-none hover:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent"
            >
              Maybe later
            </Button>
            <Button
              autoFocus
              onPress={onStart}
              className="min-h-[44px] cursor-pointer rounded-lg bg-accent px-6 text-sm font-bold text-on-accent outline-none transition-transform hover:opacity-90 motion-safe:active:scale-[0.98] data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-surface-raised"
            >
              Start the tour
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
