import type { ReactNode } from "react";

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Labeled group of fields inside a detail modal, mirroring one object
 * grouping from the underlying details shape (for example President, or
 * Club Info).
 */
export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <section className="border-t border-line/60 pt-5 first:border-t-0 first:pt-0">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </section>
  );
}

interface DetailFieldProps {
  label: string;
  value: ReactNode;
}

export function DetailField({ label, value }: DetailFieldProps) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs font-medium text-foreground-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground break-words">{displayValue}</dd>
    </div>
  );
}

interface FlatDetailListProps {
  rows: { label: string; value: string }[];
}

/**
 * Falls back to a flat label/value list for detail shapes that do not have
 * a known section grouping (for example a legacy version, or an unrecognized
 * one).
 */
export function FlatDetailList({ rows }: FlatDetailListProps) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {rows.map(({ label, value }) => (
        <DetailField key={label} label={label} value={value} />
      ))}
    </dl>
  );
}
