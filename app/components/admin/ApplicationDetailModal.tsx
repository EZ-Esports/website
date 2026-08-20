"use client";

import { FiX } from "react-icons/fi";
import { Overlay, Modal, Dialog } from "@/app/components/ui/overlay";
import { formatSchoolApplicationDetails, type SchoolApplicationDetails } from "@/app/lib/school-application-form";
import { schoolApplicationsToCsv } from "@/app/lib/application-csv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";
import { DetailSection, DetailField, FlatDetailList } from "@/app/components/admin/ApplicationDetailSections";
import type { Application } from "@/app/components/admin/ApplicationRow";

interface ApplicationDetailModalProps {
  app: Application;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSubmittedDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DetailsBody({ details, message }: { details: SchoolApplicationDetails | null; message: string }) {
  if (!details) {
    return message ? (
      <p className="text-sm text-foreground-secondary whitespace-pre-line">{message}</p>
    ) : (
      <p className="text-sm text-foreground-muted italic">No details were submitted with this application.</p>
    );
  }

  if (details.version === 1) {
    return (
      <>
        <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-4">
          This application used an earlier form version -- a sectioned view is not available for it.
        </p>
        <FlatDetailList rows={formatSchoolApplicationDetails(details)} />
      </>
    );
  }

  // `details` comes straight off a public, unauthenticated POST body (see
  // app/api/apply/route.ts, which only checks `typeof === "object" &&
  // !Array.isArray` before storing it) -- a row tagged `version: 2` is not
  // guaranteed to actually have the nested president/vicePresident/
  // thirdOfficer/club objects this sectioned view reads from. Fall back to
  // the flat formatter (which already applies this exact guard and degrades
  // to a safe placeholder) instead of letting a missing nested object throw
  // during render and take down the whole admin page via its error boundary.
  if (
    details.version === 2 &&
    details.president &&
    details.vicePresident &&
    details.thirdOfficer &&
    details.club &&
    typeof details.agreedRules === "boolean"
  ) {
    const games = details.club.interestedGames.join(", ") || "—";
    const nonRoster = details.club.nonRosterOpportunities.join(", ") || "—";
    const inclusive = details.club.inclusiveOpportunities.join(", ") || "—";
    const contribute = details.club.contributeBeyondSchool.join(", ") || "—";

    return (
      <div className="space-y-4">
        <DetailField label="Club Status" value={details.clubStatus} />

        <DetailSection title="President">
          <DetailField label="Name" value={`${details.president.firstName} ${details.president.lastName}`} />
          <DetailField label="Email" value={details.president.email} />
          <DetailField label="Discord" value={details.president.discord} />
          <DetailField label="Graduation Year" value={details.president.gradYear} />
          <DetailField label="Preferred Contact" value={details.president.preferredContact} />
        </DetailSection>

        <DetailSection title="Vice President">
          <DetailField label="Name" value={`${details.vicePresident.firstName} ${details.vicePresident.lastName}`} />
          <DetailField label="Email" value={details.vicePresident.email} />
          <DetailField label="Discord" value={details.vicePresident.discord} />
          <DetailField label="Graduation Year" value={details.vicePresident.gradYear} />
          <DetailField label="Preferred Contact" value={details.vicePresident.preferredContact} />
        </DetailSection>

        <DetailSection title="3rd Club Officer">
          <DetailField label="Name" value={`${details.thirdOfficer.firstName} ${details.thirdOfficer.lastName}`} />
          <DetailField label="Email" value={details.thirdOfficer.email} />
          <DetailField label="Graduation Year" value={details.thirdOfficer.gradYear} />
          <DetailField label="Preferred Contact" value={details.thirdOfficer.preferredContact} />
        </DetailSection>

        <DetailSection title="Club Info">
          <DetailField label="Instagram" value={details.club.instagramLink} />
          <DetailField label="Discord" value={details.club.discordLink} />
          <DetailField label="Faculty Advisor" value={`${details.club.advisorName} (${details.club.advisorEmail})`} />
          <DetailField label="Advisor Confirmed" value={details.club.advisorConfirmed} />
          <DetailField label="Active Club Members" value={details.club.activeStudentsCount} />
          <DetailField label="Interested Games" value={games} />
          <DetailField label="Biggest Barrier" value={details.club.clubBarrier} />
          <DetailField label="Non-Roster Opportunities" value={nonRoster} />
          <DetailField label="Inclusive Opportunities" value={inclusive} />
          <DetailField label="Separate Gaming Clubs/Groups" value={details.club.separateGamingClubs} />
          <DetailField label="Contribute Beyond School" value={contribute} />
        </DetailSection>

        <DetailSection title="Feedback">
          <DetailField label="Feedback / Notes" value={details.feedback} />
          <DetailField label="Rules Agreement" value={details.agreedRules ? "Agreed" : "Disagreed"} />
        </DetailSection>
      </div>
    );
  }

  return <FlatDetailList rows={formatSchoolApplicationDetails(details)} />;
}

export default function ApplicationDetailModal({ app, isOpen, onOpenChange }: ApplicationDetailModalProps) {
  const csvContent = schoolApplicationsToCsv([app]);
  const csvFilename = `application-${app.applicantName.toLowerCase().replace(/\s+/g, "-")}.csv`;

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <Modal className="contents">
        <Dialog
          aria-label={`Application details for ${app.applicantName}`}
          className="bg-surface-sunken border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 outline-none flex flex-col"
        >
          <div className="bg-gradient-to-r from-accent/15 to-transparent border-b border-line px-6 py-5 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h4 className="text-lg font-black text-foreground uppercase tracking-tight truncate">{app.applicantName}</h4>
              <p className="text-sm text-foreground-secondary mt-0.5 truncate">
                {app.schoolName} · <span className="capitalize">{app.role}</span>
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                <a href={`mailto:${app.email}`} className="hover:text-foreground transition-colors">
                  {app.email}
                </a>
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

          <div className="p-6 overflow-y-auto">
            <DetailsBody details={app.details} message={app.message ?? ""} />
          </div>

          <div className="bg-surface-raised/30 border-t border-line px-6 py-3 flex items-center justify-end shrink-0">
            <DownloadCsvButton content={csvContent} filename={csvFilename} label="Download CSV" />
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
