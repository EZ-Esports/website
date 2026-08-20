"use client";

import { downloadCsv } from "@/app/lib/csv-download";

interface DownloadCsvButtonProps {
  content: string;
  filename: string;
  label?: string;
  className?: string;
}

const defaultClassName =
  "inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-muted hover:text-foreground-secondary underline decoration-line hover:decoration-foreground-secondary underline-offset-2 transition-colors cursor-pointer";

/**
 * Deliberately understated CSV export trigger -- a small text control, not a
 * prominent call to action. Used both for the per-table bulk export and the
 * per-record export inside the detail modal.
 */
export default function DownloadCsvButton({ content, filename, label = "Export CSV", className }: DownloadCsvButtonProps) {
  return (
    <button type="button" onClick={() => downloadCsv(filename, content)} className={className ?? defaultClassName}>
      {label}
    </button>
  );
}
