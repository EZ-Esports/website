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
  message: string | null;
  details: SchoolApplicationDetails | null;
}

const SCHOOL_CSV_HEADER = ["Applicant Name", "School", "Role", "Email", "Status", "Submitted", "Details"];

/**
 * One CSV row per application: fixed columns plus a single Details column
 * carrying the same human-readable label: value text the admin table
 * already shows, so the export works uniformly across every `details`
 * version without version-specific columns.
 *
 * A row can have `details: null` while still holding a real `message` --
 * a permanent state for legacy rows predating the `details` column whose
 * message text was never (or could never be) converted to structured data.
 * Falling back to the raw message keeps the export matching what the row
 * already shows on screen (ApplicationRow.tsx and the detail modal both
 * fall back the same way) instead of silently exporting an empty Details
 * column.
 */
export function schoolApplicationsToCsv(apps: SchoolApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.applicantName,
    app.schoolName,
    app.role,
    app.email,
    app.status,
    formatSubmittedDate(app.submittedAt),
    app.details ? detailsColumn(formatSchoolApplicationDetails(app.details)) : (app.message ?? ""),
  ]);
  return buildCsv(SCHOOL_CSV_HEADER, rows);
}

export interface StaffApplicationCsvSource {
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  submittedAt: Date;
  message: string | null;
  details: StaffApplicationDetails | null;
  hasResume?: boolean;
}

// "Resume" records only whether a PDF is on file: signed links expire within
// a minute, so a URL in an exported spreadsheet would be dead on arrival.
const STAFF_CSV_HEADER = ["Name", "Role", "Email", "Phone", "Status", "Submitted", "Resume", "Details"];

/** See schoolApplicationsToCsv above for why a null `details` falls back to `message` rather than an empty column. */
export function staffApplicationsToCsv(apps: StaffApplicationCsvSource[]): string {
  const rows = apps.map((app) => [
    app.name,
    app.role,
    app.email,
    app.phone,
    app.status,
    formatSubmittedDate(app.submittedAt),
    app.hasResume ? "Attached" : "",
    app.details ? detailsColumn(formatStaffApplicationDetails(app.details)) : (app.message ?? ""),
  ]);
  return buildCsv(STAFF_CSV_HEADER, rows);
}
