"use client";

import { useState, useTransition } from "react";
import { downloadCsv } from "@/app/lib/csv-download";

interface ExportCsvButtonProps {
  /** Server action that returns CSV text on-demand (called only when clicked). */
  action?: (status?: string) => Promise<string>;
  status?: string;
  fetchCsv?: () => Promise<string>;
  filename: string;
  label?: string;
  className?: string;
}

const defaultClassName =
  "inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-muted hover:text-foreground-secondary underline decoration-line hover:decoration-foreground-secondary underline-offset-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Triggers a server action on click to fetch CSV data on-demand,
 * so no bulk PII is embedded in the RSC page payload at render time.
 */
export default function ExportCsvButton({
  action,
  status,
  fetchCsv,
  filename,
  label = "Export CSV",
  className,
}: ExportCsvButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const csv = action ? await action(status) : await fetchCsv!();
        downloadCsv(filename, csv);
      } catch {
        setError("Export failed. Please try again.");
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className ?? defaultClassName}
      >
        {isPending ? "Exporting…" : label}
      </button>
      {error && <span className="text-[10px] text-danger font-semibold">{error}</span>}
    </span>
  );
}
