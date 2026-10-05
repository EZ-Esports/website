"use client";

import { useState, useTransition } from "react";
import { HiArrowDownTray } from "react-icons/hi2";
import { downloadCsv } from "@/app/lib/csv-download";
import { ghostBtnSm } from "@/app/components/admin/styles";
import { AdminSpinner } from "@/app/components/admin/AdminUI";

interface ExportCsvButtonProps {
  /** Server action that returns CSV text on-demand (called only when clicked). */
  action?: (status?: string) => Promise<string>;
  status?: string;
  fetchCsv?: () => Promise<string>;
  filename: string;
  label?: string;
  className?: string;
}

/** Understated on purpose: a quiet ghost button, never the page's primary action. */
const defaultClassName = ghostBtnSm;

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
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        className={className ?? defaultClassName}
      >
        {isPending ? <AdminSpinner /> : <HiArrowDownTray aria-hidden className="h-3.5 w-3.5" />}
        {isPending ? "Exporting…" : label}
      </button>
      {error && <span role="alert" className="admin-fade-in text-xs font-medium text-danger-on-tint">{error}</span>}
    </span>
  );
}
