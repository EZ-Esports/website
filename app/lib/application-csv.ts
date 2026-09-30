import { buildCsv } from "@/app/lib/csv";
import { formatSchoolApplicationDetails, type SchoolApplicationDetails } from "@/app/lib/school-application-form";
import { formatStaffApplicationDetails, type StaffApplicationDetails } from "@/app/lib/staff-application-form";

function formatSubmittedDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function detailsColumn(rows: { label: string; value: string }[]): string {
  return rows.map(({ label, value }) => `${label}: ${value}`).join("\n");
}

export interface SchoolApplicationCsvSource {
  applicantName: string;
  schoolName: string;
  role: string;
  email: string;
  status: string;
  submittedAt: Date;
  details: SchoolApplicationDetails | null;
}

const SCHOOL_CSV_HEADER = ["Applicant Name", "School", "Role", "Email", "Status", "Submitted", "Details"];

/**
 * One CSV row per application: fixed columns plus a single Details column
 * carrying the same human-readable label: value text the admin table
 * already shows, so the export works uniformly across every `details`
 * version without version-specific columns.
 */
export function schoolApplicationsToCsv(apps: SchoolApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.applicantName,
    app.schoolName,
    app.role,
    app.email,
    app.status,
    formatSubmittedDate(app.submittedAt),
    app.details ? detailsColumn(formatSchoolApplicationDetails(app.details)) : "",
  ]);
  return buildCsv(SCHOOL_CSV_HEADER, rows);
}

export interface StaffApplicationCsvSource {
  name: string;
  preferredFirstName?: string | null;
  role: string;
  email: string;
  phone: string;
  discordTag?: string | null;
  status: string;
  submittedAt: Date;
  details: StaffApplicationDetails | null;
  hasResume?: boolean;
}

// "Resume" records only whether a PDF is on file: signed links expire within
// a minute, so a URL in an exported spreadsheet would be dead on arrival.
const STAFF_CSV_HEADER = ["Name", "Role", "Email", "Phone", "Status", "Submitted", "Resume", "Details"];

function getStaffDetailsRows(app: StaffApplicationCsvSource): { label: string; value: string }[] {
  if (!app.details) return [];
  const rows = [...formatStaffApplicationDetails(app.details)];
  const hasPreferred = rows.some((r) => r.label === "Preferred First Name");
  if (!hasPreferred && app.preferredFirstName?.trim()) {
    rows.unshift({ label: "Preferred First Name", value: app.preferredFirstName.trim() });
  }
  const hasDiscord = rows.some((r) => r.label === "Discord");
  if (!hasDiscord && app.discordTag?.trim()) {
    const idx = rows.findIndex((r) => r.label === "Preferred First Name");
    rows.splice(idx >= 0 ? idx + 1 : 0, 0, { label: "Discord", value: app.discordTag.trim() });
  }
  return rows;
}

export function staffApplicationsToCsv(apps: StaffApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.name,
    app.role,
    app.email,
    app.phone,
    app.status,
    formatSubmittedDate(app.submittedAt),
    app.hasResume ? "Attached" : "",
    app.details ? detailsColumn(getStaffDetailsRows(app)) : "",
  ]);
  return buildCsv(STAFF_CSV_HEADER, rows);
}

const SCHOOL_TABLE_CSV_HEADER = ["Applicant Name", "School", "Role", "Email", "Status", "Submitted"];

/**
 * On-demand bulk CSV export matching the admin table columns without exposing
 * internal nested details / bulk PII in the RSC payload or table export.
 */
export function schoolApplicationsTableToCsv(apps: SchoolApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.applicantName,
    app.schoolName,
    app.role,
    app.email,
    app.status,
    formatSubmittedDate(app.submittedAt),
  ]);
  return buildCsv(SCHOOL_TABLE_CSV_HEADER, rows);
}

const STAFF_TABLE_CSV_HEADER = ["Name", "Preferred Name", "Discord", "Role", "Email", "Phone", "Status", "Submitted"];

/**
 * On-demand bulk CSV export matching the staff admin table columns without exposing
 * full unvetted details in the RSC payload.
 */
export function staffApplicationsTableToCsv(apps: StaffApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.name,
    app.preferredFirstName || (app.details as { preferredFirstName?: string } | null)?.preferredFirstName || "",
    app.discordTag || (app.details as { discordTag?: string } | null)?.discordTag || "",
    app.role,
    app.email,
    app.phone,
    app.status,
    formatSubmittedDate(app.submittedAt),
  ]);
  return buildCsv(STAFF_TABLE_CSV_HEADER, rows);
}
