'use client';

import type { ButtonHTMLAttributes, Ref } from 'react';
import { FiEdit2, FiX } from 'react-icons/fi';
import { cancelIconBtn, editIconBtn } from '@/app/components/admin/styles';

type Kind = 'edit' | 'cancel';

const ICONS = { edit: FiEdit2, cancel: FiX } as const;
const STYLES = { edit: editIconBtn, cancel: cancelIconBtn } as const;

interface RowIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'title' | 'aria-label'> {
  /** Pen (edit) or X (cancel). Decides icon and style. */
  kind: Kind;
  /** Accessible name and tooltip. Name the target, e.g. "Edit school Foo". */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The staff-area row action icon button (see `admin/styles.ts` for the shared
 * shape and hit-area rules). Always `type="button"` unless overridden.
 */
export default function RowIconButton({ kind, label, type = 'button', ref, ...rest }: RowIconButtonProps) {
  const Icon = ICONS[kind];
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={STYLES[kind]} {...rest}>
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
