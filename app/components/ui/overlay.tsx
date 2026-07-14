'use client';

import {
  ModalOverlay,
  Modal as RACModal,
  Dialog as RACDialog,
  Heading as RACHeading,
} from 'react-aria-components';
import type { ModalOverlayProps, DialogProps, HeadingProps } from 'react-aria-components';
// Thin token-styled wrappers over RAC's overlay primitives. RAC owns focus
// containment, Escape-to-close, outside-press dismissal, and scroll locking;
// these wrappers only own visual classes. Both controlled usage (isOpen /
// onOpenChange) and trigger-based usage (nested in a RAC DialogTrigger) work
// since that state flows through React context from OverlayTriggerProps.

const defaultOverlayClassName = 'fixed inset-0 z-50 bg-black/70 grid place-items-center p-4';

interface OverlayProps extends Omit<ModalOverlayProps, 'className'> {
  className?: string;
}

/**
 * Backdrop scrim. `className` fully replaces the default (rather than
 * appending) so each surface (lightbox, match modal, transparent mobile nav)
 * can supply its own complete look without colliding utility classes.
 */
export function Overlay({ className, ...props }: OverlayProps) {
  return <ModalOverlay className={className ?? defaultOverlayClassName} {...props} />;
}

interface ModalProps extends Omit<ModalOverlayProps, 'className'> {
  className?: string;
}

/** Content box rendered inside an Overlay. Bring your own sizing/surface classes. */
export function Modal({ className, ...props }: ModalProps) {
  return <RACModal className={className} {...props} />;
}

interface DialogBoxProps extends Omit<DialogProps, 'className'> {
  className?: string;
}

/** Dialog box. Renders with role="dialog" by default; pass role="alertdialog" for
 *  prompts that require an explicit user response (e.g. confirm-before-delete). */
export function Dialog({ className, ...props }: DialogBoxProps) {
  return <RACDialog className={className} {...props} />;
}

interface HeadingBoxProps extends Omit<HeadingProps, 'className'> {
  className?: string;
}

export function Heading({ className, ...props }: HeadingBoxProps) {
  return <RACHeading className={className} {...props} />;
}
