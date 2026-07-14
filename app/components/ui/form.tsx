'use client';

import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
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

export const selectClassName =
  'w-full px-4 py-3 bg-surface border border-line rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <RACLabel className={cx('block text-sm font-semibold text-foreground-secondary mb-1.5', className)} {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <RACInput className={cx(inputClassName, className)} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <RACTextArea className={cx(inputClassName, 'resize-y', className)} {...props} />;
}

// Kept as a plain styled native <select> — its consumers expect native behavior
// (no keyboard/focus/aria work to gain from RAC here); see SeasonSelect.tsx for
// the RAC-based Select used where a richer custom popup is warranted.
export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(selectClassName, className)} {...props}>
      {children}
    </select>
  );
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
  children: ReactNode;
  className?: string;
}

/** Label + input + error wrapper. When `error` is set, the nested input gets
    aria-invalid and aria-describedby pointing at the error text, via RAC's
    TextField + FieldError context (no manual id wiring needed). */
export function Field({ label, htmlFor, required, error, children, className = '' }: FieldProps) {
  return (
    <TextField isInvalid={!!error} className={className}>
      <Label htmlFor={htmlFor}>
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
