import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/app/lib/cx';

// Built only from semantic tokens so the same components render correctly on
// dark surfaces (login page, at :root) and light surfaces (apply form, inside
// .theme-light) with no per-consumer overrides needed.

export const inputClassName =
  'w-full px-4 py-3 bg-surface border border-line rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export const selectClassName =
  'w-full px-4 py-3 bg-surface border border-line rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx('block text-sm font-semibold text-foreground-secondary mb-1.5', className)} {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClassName, className)} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClassName, 'resize-y', className)} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(selectClassName, className)} {...props}>
      {children}
    </select>
  );
}

interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Label + input + error wrapper. */
export function Field({ label, htmlFor, required, error, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-accent ml-1" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-xs text-danger font-semibold">{error}</p>}
    </div>
  );
}
