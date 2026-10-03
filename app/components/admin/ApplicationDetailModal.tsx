"use client";

import { FiX } from "react-icons/fi";
import { Overlay, Modal, Dialog } from "@/app/components/ui/overlay";
import { formatSchoolApplicationDetails, type SchoolApplicationDetails } from "@/app/lib/school-application-form";
import { schoolApplicationsToCsv } from "@/app/lib/application-csv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";
import { DetailSection, DetailField, FlatDetailList } from "@/app/components/admin/ApplicationDetailSections";
import type { Application } from "@/app/components/admin/ApplicationRow";
import { iconBtn } from "@/app/components/admin/styles";

interface ApplicationDetailModalProps {
  app: Application;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSubmittedDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function safeJoin(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    return items.length > 0 ? items.join(", ") : "—";
  }
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function safeString(value: unknown, fallback = "—"): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function DetailsBody({ details }: { details: SchoolApplicationDetails | null }) {
  if (!details) {
    return (
      <p className="text-sm text-foreground-secondary">No details were submitted with this application.</p>
    );
  }

  if (details.version === 1) {
    return (
      <>
        <p className="mb-5 rounded-lg bg-warning/[0.08] px-3 py-2 text-xs leading-5 text-warning">
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
    const games = safeJoin(details.club.interestedGames);
    const nonRoster = safeJoin(details.club.nonRosterOpportunities);
    const inclusive = safeJoin(details.club.inclusiveOpportunities);
    const contribute = safeJoin(details.club.contributeBeyondSchool);

    return (
      <div className="space-y-5">
        <DetailField label="Club Status" value={safeString(details.clubStatus)} />

        <DetailSection title="President">
          <DetailField label="Name" value={`${safeString(details.president.firstName, "")} ${safeString(details.president.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.president.email)} />
          <DetailField label="Discord" value={safeString(details.president.discord)} />
          <DetailField label="Graduation Year" value={safeString(details.president.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.president.preferredContact)} />
        </DetailSection>

        <DetailSection title="Vice President">
          <DetailField label="Name" value={`${safeString(details.vicePresident.firstName, "")} ${safeString(details.vicePresident.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.vicePresident.email)} />
          <DetailField label="Discord" value={safeString(details.vicePresident.discord)} />
          <DetailField label="Graduation Year" value={safeString(details.vicePresident.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.vicePresident.preferredContact)} />
        </DetailSection>

        <DetailSection title="3rd Club Officer">
          <DetailField label="Name" value={`${safeString(details.thirdOfficer.firstName, "")} ${safeString(details.thirdOfficer.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.thirdOfficer.email)} />
          <DetailField label="Graduation Year" value={safeString(details.thirdOfficer.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.thirdOfficer.preferredContact)} />
        </DetailSection>

        <DetailSection title="Club Info">
          <DetailField label="Instagram" value={safeString(details.club.instagramLink)} />
          <DetailField label="Discord" value={safeString(details.club.discordLink)} />
          <DetailField label="Faculty Advisor" value={`${safeString(details.club.advisorName, "")} (${safeString(details.club.advisorEmail, "")})`.trim() || "—"} />
          <DetailField label="Advisor Confirmed" value={safeString(details.club.advisorConfirmed)} />
          <DetailField label="Active Club Members" value={safeString(details.club.activeStudentsCount)} />
          <DetailField label="Interested Games" value={games} />
          <DetailField label="Biggest Barrier" value={safeString(details.club.clubBarrier)} />
          <DetailField label="Non-Roster Opportunities" value={nonRoster} />
          <DetailField label="Inclusive Opportunities" value={inclusive} />
          <DetailField label="Separate Gaming Clubs/Groups" value={safeString(details.club.separateGamingClubs)} />
          <DetailField label="Contribute Beyond School" value={contribute} />
        </DetailSection>

        <DetailSection title="Feedback">
          <DetailField label="Feedback / Notes" value={safeString(details.feedback)} />
          <DetailField label="Rules Agreement" value={details.agreedRules ? "Agreed" : "Disagreed"} />
        </DetailSection>
      </div>
    );
  }

  // v3 (issue #127): same nested shape as v2, except the single `agreedRules`
  // boolean became three independently-tracked consents. Same defensive
  // shape guard as the v2 branch above — `details` is unauthenticated input.
  if (
    details.version === 3 &&
    details.president &&
    details.vicePresident &&
    details.thirdOfficer &&
    details.club &&
    details.consent
  ) {
    const games = safeJoin(details.club.interestedGames);
    const nonRoster = safeJoin(details.club.nonRosterOpportunities);
    const inclusive = safeJoin(details.club.inclusiveOpportunities);
    const contribute = safeJoin(details.club.contributeBeyondSchool);
    const agreed = (v: unknown) => (v === true ? "Agreed" : "Disagreed");

    return (
      <div className="space-y-5">
        <DetailField label="Club Status" value={safeString(details.clubStatus)} />

        <DetailSection title="President">
          <DetailField label="Name" value={`${safeString(details.president.firstName, "")} ${safeString(details.president.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.president.email)} />
          <DetailField label="Discord" value={safeString(details.president.discord)} />
          <DetailField label="Graduation Year" value={safeString(details.president.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.president.preferredContact)} />
        </DetailSection>

        <DetailSection title="Vice President">
          <DetailField label="Name" value={`${safeString(details.vicePresident.firstName, "")} ${safeString(details.vicePresident.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.vicePresident.email)} />
          <DetailField label="Discord" value={safeString(details.vicePresident.discord)} />
          <DetailField label="Graduation Year" value={safeString(details.vicePresident.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.vicePresident.preferredContact)} />
        </DetailSection>

        <DetailSection title="3rd Club Officer">
          <DetailField label="Name" value={`${safeString(details.thirdOfficer.firstName, "")} ${safeString(details.thirdOfficer.lastName, "")}`.trim() || "—"} />
          <DetailField label="Email" value={safeString(details.thirdOfficer.email)} />
          <DetailField label="Graduation Year" value={safeString(details.thirdOfficer.gradYear)} />
          <DetailField label="Preferred Contact" value={safeString(details.thirdOfficer.preferredContact)} />
        </DetailSection>

        <DetailSection title="Club Info">
          <DetailField label="Instagram" value={safeString(details.club.instagramLink)} />
          <DetailField label="Discord" value={safeString(details.club.discordLink)} />
          <DetailField label="Faculty Advisor" value={`${safeString(details.club.advisorName, "")} (${safeString(details.club.advisorEmail, "")})`.trim() || "—"} />
          <DetailField label="Advisor Confirmed" value={safeString(details.club.advisorConfirmed)} />
          <DetailField label="Active Club Members" value={safeString(details.club.activeStudentsCount)} />
          <DetailField label="Interested Games" value={games} />
          <DetailField label="Biggest Barrier" value={safeString(details.club.clubBarrier)} />
          <DetailField label="Non-Roster Opportunities" value={nonRoster} />
          <DetailField label="Inclusive Opportunities" value={inclusive} />
          <DetailField label="Separate Gaming Clubs/Groups" value={safeString(details.club.separateGamingClubs)} />
          <DetailField label="Contribute Beyond School" value={contribute} />
        </DetailSection>

        <DetailSection title="Feedback">
          <DetailField label="Feedback / Notes" value={safeString(details.feedback)} />
        </DetailSection>

        <DetailSection title="Consent">
          <DetailField label="League Rules & Code of Conduct" value={agreed(details.consent.agreedToRules)} />
          <DetailField label="Terms of Service" value={agreed(details.consent.agreedToTerms)} />
          <DetailField label="Privacy & Data Handling" value={agreed(details.consent.agreedToPrivacy)} />
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
      className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <Modal className="admin-modal w-full max-w-2xl outline-none">
        <Dialog
          aria-label={`Application details for ${app.applicantName}`}
          className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-surface-raised text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line/60 px-6 py-5">
            <div className="min-w-0">
              <h4 className="truncate text-lg font-semibold text-foreground">{app.applicantName}</h4>
              <p className="mt-0.5 truncate text-sm text-foreground-secondary">
                {app.schoolName} · <span className="capitalize">{app.role}</span>
              </p>
              <p className="mt-1.5 text-xs leading-5 text-foreground-secondary">
                <a href={`mailto:${app.email}`} className="rounded underline-offset-2 hover:text-foreground hover:underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                  {app.email}
                </a>
                {" · Submitted " + formatSubmittedDate(app.submittedAt) + " · "}
                <span className="capitalize">{app.status}</span>
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close details"
              className={`${iconBtn} -mr-2 -mt-1`}
            >
              <FiX aria-hidden className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto p-6">
            <DetailsBody details={app.details} />
          </div>

          <div className="flex shrink-0 items-center justify-end border-t border-line/60 px-6 py-3">
            <DownloadCsvButton content={csvContent} filename={csvFilename} label="Download CSV" />
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
