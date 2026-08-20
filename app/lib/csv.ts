/**
 * Minimal RFC-4180-style CSV helpers used by the admin applications export
 * (see app/lib/application-csv.ts). A field is wrapped in double quotes if
 * it contains a comma, a double quote, or a line break, and any double
 * quote inside it is doubled -- the same escaping every spreadsheet app
 * expects.
 */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return "\"" + value.replace(/"/g, "\"\"") + "\"";
  }
  return value;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** Joins a header row and data rows into a full CSV string (CRLF line endings, per RFC 4180). */
export function buildCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map(toCsvRow).join("\r\n");
}
