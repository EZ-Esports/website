"use client";

import { FiFileText, FiX } from "react-icons/fi";
import { Overlay, Modal, Dialog } from "@/app/components/ui/overlay";
import {
  formatStaffApplicationDetails,
  type StaffApplicationDetails,
} from "@/app/lib/staff-application-form";
import { staffApplicationsToCsv } from "@/app/lib/application-csv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";
import { DetailSection, DetailField, FlatDetailList } from "@/app/components/admin/ApplicationDetailSections";
import type { StaffApplication } from "@/app/components/admin/StaffApplicationRow";
import { secondaryBtn } from "@/app/components/admin/styles";

interface StaffApplicationDetailModalProps {
  app: StaffApplication;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSubmittedDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StaffDetailsBody({ details, app }: { details: StaffApplicationDetails | null; app: StaffApplication }) {
  if (!details) {
    return <p className="text-sm text-foreground-muted italic">No details were submitted with this application.</p>;
  }

  const linkedin = details.linkedin ? (
    <a
      href={details.linkedin.startsWith("http") ? details.linkedin : `https://${details.linkedin}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline break-all"
    >
      {details.linkedin}
    </a>
  ) : (
    "—"
  );

  const agreed = (v: boolean | undefined) => (v ? "Agreed" : "Disagreed");

  if (details.version === 1) {
    return (
      <div className="space-y-4">
        <DetailSection title="Applicant Profile">
          <DetailField label="Preferred Name" value={details.preferredFirstName || app.preferredFirstName || "—"} />
          <DetailField label="Discord Tag" value={details.discordTag || app.discordTag || "—"} />
          <DetailField label="LinkedIn / Portfolio" value={linkedin} />
        </DetailSection>

        <DetailSection title="Role & Availability">
          <DetailField label="Role Applied For" value={app.role} />
          <DetailField label="Weekly Availability" value={details.availability || "—"} />
        </DetailSection>

        <DetailSection title="Background & Motivation">
          <DetailField label="Motivation" value={details.backgroundMotivation || "—"} />
        </DetailSection>

        <DetailSection title="Consent">
          <DetailField label="League Rules Agreement" value={agreed(details.agreedRules)} />
        </DetailSection>
      </div>
    );
  }

  if (details.version === 2) {
    return (
      <div className="space-y-4">
        <DetailSection title="Applicant Profile">
          <DetailField label="Preferred Name" value={details.preferredFirstName || app.preferredFirstName || "—"} />
          <DetailField label="Discord Tag" value={details.discordTag || app.discordTag || "—"} />
          <DetailField label="LinkedIn / Portfolio" value={linkedin} />
        </DetailSection>

        <DetailSection title="Role & Availability">
          <DetailField label="Role Applied For" value={app.role} />
          <DetailField label="Weekly Availability" value={details.availability || "—"} />
        </DetailSection>

        <DetailSection title="Background & Motivation">
          <DetailField label="Motivation" value={details.backgroundMotivation || "—"} />
        </DetailSection>

        <DetailSection title="Consent">
          <DetailField label="Terms of Service" value={agreed(details.consent?.agreedToTerms)} />
          <DetailField label="Privacy Policy" value={agreed(details.consent?.agreedToPrivacy)} />
        </DetailSection>
      </div>
    );
  }

  return <FlatDetailList rows={formatStaffApplicationDetails(details)} />;
}

export default function StaffApplicationDetailModal({ app, isOpen, onOpenChange }: StaffApplicationDetailModalProps) {
  const csvContent = staffApplicationsToCsv([app]);
  const csvFilename = `staff-application-${app.name.toLowerCase().replace(/\s+/g, "-")}.csv`;

  const preferredName =
    app.preferredFirstName || (app.details as { preferredFirstName?: string } | null)?.preferredFirstName;
  const discord = app.discordTag || (app.details as { discordTag?: string } | null)?.discordTag;

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <Modal className="w-full max-w-xl outline-none">
        <Dialog
          aria-label={`Application details for ${app.name}`}
          className="bg-surface-sunken border border-line rounded-2xl w-full max-h-[90vh] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 outline-none flex flex-col"
        >
          <div className="bg-gradient-to-r from-accent/15 to-transparent border-b border-line px-6 py-5 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h4 className="text-lg font-black text-foreground uppercase tracking-tight truncate">
                {app.name}
                {preferredName ? ` (goes by ${preferredName})` : ""}
              </h4>
              <p className="text-sm text-foreground-secondary mt-0.5 truncate capitalize">{app.role}</p>
              <p className="text-xs text-foreground-muted mt-1">
                <a href={`mailto:${app.email}`} className="hover:text-foreground transition-colors">
                  {app.email}
                </a>
                {" · " + app.phone}
                {discord && <span>{" · Discord: " + discord}</span>}
                {" · Submitted " + formatSubmittedDate(app.submittedAt) + " · "}
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

          <div className="p-6 overflow-y-auto space-y-4">
            {app.hasResume && (
              // A plain link to the gated route, which redirects to a signed URL
              // valid for about a minute: nothing long-lived reaches the page.
              <a
                href={`/admin/applications/staff/${app.id}/resume`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${secondaryBtn} w-fit min-h-[44px]`}
              >
                <FiFileText className="w-4 h-4" aria-hidden="true" />
                View resume (PDF)
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <StaffDetailsBody details={app.details} app={app} />
          </div>

          <div className="bg-surface-raised/30 border-t border-line px-6 py-3 flex items-center justify-end shrink-0">
            <DownloadCsvButton content={csvContent} filename={csvFilename} label="Download CSV" />
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
