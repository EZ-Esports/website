"use client";

import { FiX } from "react-icons/fi";
import { Overlay, Modal, Dialog } from "@/app/components/ui/overlay";
import { formatStaffApplicationDetails } from "@/app/lib/staff-application-form";
import { staffApplicationsToCsv } from "@/app/lib/application-csv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";
import { DetailSection, DetailField } from "@/app/components/admin/ApplicationDetailSections";
import type { StaffApplication } from "@/app/components/admin/StaffApplicationRow";

interface StaffApplicationDetailModalProps {
  app: StaffApplication;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSubmittedDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function StaffApplicationDetailModal({ app, isOpen, onOpenChange }: StaffApplicationDetailModalProps) {
  const csvContent = staffApplicationsToCsv([app]);
  const csvFilename = `staff-application-${app.name.toLowerCase().replace(/\s+/g, "-")}.csv`;

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <Modal className="contents">
        <Dialog
          aria-label={`Application details for ${app.name}`}
          className="bg-surface-sunken border border-line rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 outline-none flex flex-col"
        >
          <div className="bg-gradient-to-r from-accent/15 to-transparent border-b border-line px-6 py-5 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h4 className="text-lg font-black text-foreground uppercase tracking-tight truncate">
                {app.name}
                {app.preferredFirstName ? ` (goes by ${app.preferredFirstName})` : ""}
              </h4>
              <p className="text-sm text-foreground-secondary mt-0.5 truncate capitalize">{app.role}</p>
              <p className="text-xs text-foreground-muted mt-1">
                <a href={`mailto:${app.email}`} className="hover:text-foreground transition-colors">
                  {app.email}
                </a>
                {" · " + app.phone + " · Submitted " + formatSubmittedDate(app.submittedAt) + " · "}
                <span className="capitalize">{app.status}</span>
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close details"
              className="p-2 rounded-lg bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40 transition-colors cursor-pointer shrink-0"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {app.details ? (
              <DetailSection title="Application Details">
                {formatStaffApplicationDetails(app.details).map((row) => (
                  <DetailField key={row.label} label={row.label} value={row.value} />
                ))}
              </DetailSection>
            ) : app.message ? (
              <p className="text-sm text-foreground-secondary whitespace-pre-line">{app.message}</p>
            ) : (
              <p className="text-sm text-foreground-muted italic">No details were submitted with this application.</p>
            )}
          </div>

          <div className="bg-surface-raised/30 border-t border-line px-6 py-3 flex items-center justify-end shrink-0">
            <DownloadCsvButton content={csvContent} filename={csvFilename} label="Download CSV" />
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
