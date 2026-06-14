/**
 * Pure parsing + transform logic for the archived CSV import.
 *
 * Kept free of any DB import so it can be dry-run and unit-tested in isolation.
 * `seed.ts` consumes these helpers and performs the actual inserts.
 *
 * See seed.ts for the high-level design notes (schedule-only matches,
 * A->Varsity / B->JV division mapping, staff -> leadership).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

export const MATCHES_CSV = 'complete_matches_valorant 2022-26.csv';
export const STAFF_CSV = 'staff_completeroster.csv';

// --- CSV parsing (RFC-4180: handles quoted fields, embedded commas/quotes) ---

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse a CSV file into objects keyed by header name. */
export function readRecords(filename: string): Record<string, string>[] {
  const text = readFileSync(resolve(process.cwd(), filename), 'utf8');
  const rows = parseCSV(text);
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = (cols[i] ?? '').trim();
    });
    return rec;
  });
}

// --- Helpers ---

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DIVISION_LABEL: Record<string, string> = { A: 'Varsity', B: 'JV' };
export function divisionLabel(raw: string): string {
  return DIVISION_LABEL[raw.trim().toUpperCase()] ?? raw.trim();
}

/** Combine "M/D/YYYY" + a loose time string ("7:30PM", "9:00 PM", "") into a Date. */
export function parseScheduledAt(dateStr: string, timeStr: string): Date {
  const [m, d, y] = dateStr.split('/').map((n) => parseInt(n, 10));
  let hours = 19; // default to 7:00 PM when time is missing
  let minutes = 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }
  return new Date(Date.UTC(y, m - 1, d, hours, minutes));
}

/** Render a staff member's department + role into a single display role. */
export function formatRole(department: string, role: string): string {
  const dept = department.trim();
  const r = role.trim();
  if (!dept || dept === 'Executive' || dept === 'Advisor') return r || dept;
  return `${dept} ${r}`.trim();
}

/** A staff member's public-facing display name, folding in a handle/preferred name. */
export function displayName(name: string, preferred: string): string {
  return preferred && preferred !== name ? `${name} (${preferred})` : name;
}

// --- Plan building (pure: derives the full set of rows to insert) ---

export interface ImportPlan {
  schoolNames: string[];
  seasonNames: string[];
  latestSeason: string;
  /** `${season}|${school}` keys for every team to create. */
  teamKeys: string[];
  /** `${season}|${school}|${division}` keys for every roster to create. */
  rosterKeys: string[];
  /** Resolved match rows, referencing roster keys (ids are filled in at insert time). */
  matches: {
    seasonName: string;
    homeRosterKey: string;
    awayRosterKey: string;
    scheduledAt: Date;
  }[];
  leadership: { name: string; role: string; year: string; bio: string | null }[];
}

export function buildImportPlan(
  matchRecords: Record<string, string>[],
  staffRecords: Record<string, string>[]
): ImportPlan {
  const schoolNames = Array.from(
    new Set(matchRecords.flatMap((r) => [r.school_1, r.school_2]).filter(Boolean))
  ).sort();

  const seasonNames = Array.from(new Set(matchRecords.map((r) => r.season_id).filter(Boolean))).sort();
  const latestSeason = seasonNames[seasonNames.length - 1];

  const teamKeys = new Set<string>();
  const rosterKeys = new Set<string>();
  for (const r of matchRecords) {
    const division = divisionLabel(r.division);
    for (const school of [r.school_1, r.school_2]) {
      teamKeys.add(`${r.season_id}|${school}`);
      rosterKeys.add(`${r.season_id}|${school}|${division}`);
    }
  }

  const matches = matchRecords.map((r) => {
    const division = divisionLabel(r.division);
    return {
      seasonName: r.season_id,
      homeRosterKey: `${r.season_id}|${r.school_1}|${division}`,
      awayRosterKey: `${r.season_id}|${r.school_2}|${division}`,
      scheduledAt: parseScheduledAt(r.match_date, r.match_time),
    };
  });

  const leadership = staffRecords
    .filter((r) => r.name)
    .map((r) => ({
      name: displayName(r.name, r.preferred_name),
      role: formatRole(r.division, r.role),
      year: r.season_id.slice(0, 4), // "2022-23" -> "2022"
      bio: r.fun_fact || r.notes || null,
    }));

  return {
    schoolNames,
    seasonNames,
    latestSeason,
    teamKeys: Array.from(teamKeys),
    rosterKeys: Array.from(rosterKeys),
    matches,
    leadership,
  };
}
