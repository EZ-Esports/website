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
    <div className="rounded-xl border border-line bg-surface-raised/40 p-4">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-accent mb-3">{title}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: string;
}

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">{label}</dt>
      <dd className="text-sm text-foreground-secondary break-words">{value || "—"}</dd>
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
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(({ label, value }) => (
        <DetailField key={label} label={label} value={value} />
      ))}
    </dl>
  );
}
