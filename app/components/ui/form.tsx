'use client';

import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { TextField, Label as RACLabel, Input as RACInput, TextArea as RACTextArea, FieldError } from 'react-aria-components';
import { cx } from '@/app/lib/cx';

// Built only from semantic tokens so the same components render correctly on
// dark surfaces (login page, at :root) and light surfaces (apply form, inside
// .theme-light) with no per-consumer overrides needed.
//
// RAC owns keyboard/focus/aria state here (TextField + FieldError wire up
// aria-invalid/aria-describedby automatically when nested via Field); these
// wrappers only own the token-styled look. Input/Textarea/Label also work
// completely standalone (no TextField ancestor) — RAC's context lookup is a
// no-op when absent — since ApplyForm.tsx uses them outside of Field.

export const inputClassName =
  'w-full px-4 py-3 bg-surface border border-line rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <RACLabel className={cx('block text-sm font-semibold text-foreground-secondary mb-1.5', className)} {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <RACInput className={cx(inputClassName, className)} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <RACTextArea className={cx(inputClassName, 'resize-y', className)} {...props} />;
}

interface FieldProps {
  label: ReactNode;
  /**
   * Associates the label with an input. Inside `Field` this is redundant — RAC's
   * `TextField` context wires `Label` ↔ `Input` automatically via generated IDs.
   * Accepted here so standalone `Label` usage outside a `Field` wrapper still works
   * without a separate component.
   */
  htmlFor?: string;
  required?: boolean;
  error?: string;
  defaultValue?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  density?: 'normal' | 'compact';
}

/** Label + input + error wrapper. When `error` is set, the nested input gets
    aria-invalid and aria-describedby pointing at the error text, via RAC's
    TextField + FieldError context (no manual id wiring needed). Supports compact
    density for admin panels. */
export function Field({
  label,
  htmlFor,
  required,
  error,
  defaultValue,
  children,
  className = '',
  labelClassName,
  density = 'normal',
}: FieldProps) {
  const isCompact = density === 'compact';
  const defaultLabelClass = isCompact
    ? 'block text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-1'
    : 'block text-sm font-semibold text-foreground-secondary mb-1.5';

  return (
    <TextField isInvalid={!!error} defaultValue={defaultValue} className={cx(isCompact && 'space-y-1', className)}>
      <Label htmlFor={htmlFor} className={cx(defaultLabelClass, labelClassName)}>
        {label}
        {required && <span className="text-accent ml-1" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && (
        <FieldError className="mt-1.5 text-xs text-danger font-semibold">
          {error}
        </FieldError>
      )}
    </TextField>
  );
}
