"use client";

import { HiArrowDownTray } from "react-icons/hi2";
import { downloadCsv } from "@/app/lib/csv-download";
import { ghostBtnSm } from "@/app/components/admin/styles";

interface DownloadCsvButtonProps {
  content: string;
  filename: string;
  label?: string;
  className?: string;
}

const defaultClassName = ghostBtnSm;

/**
 * Deliberately understated CSV export trigger -- a small text control, not a
 * prominent call to action. Used both for the per-table bulk export and the
 * per-record export inside the detail modal.
 */
export default function DownloadCsvButton({ content, filename, label = "Export CSV", className }: DownloadCsvButtonProps) {
  return (
    <button type="button" onClick={() => downloadCsv(filename, content)} className={className ?? defaultClassName}>
      <HiArrowDownTray aria-hidden className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
