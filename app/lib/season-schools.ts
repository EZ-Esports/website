/**
 * Pure planning for "Add school to season" (spec-058): which rosters a school's team needs so
 * that it fields every division its game allows. League Setup writes them when staff add the
 * school, so school managers never have to create Varsity / JV themselves.
 *
 * Idempotent by construction: a division that already has a roster (under any name or stored
 * spelling, `A`/`Varsity`) is left alone, so re-adding a school, or adding one whose manager
 * already built a roster, creates nothing twice.
 */
import { canonicalDivision, type CanonicalDivision } from './db/match-page';
import { allowedRosterDivisions, storedDivision } from './school-roster-view';

export interface ExistingRosterRef {
  name: string;
  division: string;
}

export interface RosterToCreate {
  name: string;
  /** Value for `rosters.division` (A / B / All), matching what staff and Generate season write. */
  division: string;
  canonical: CanonicalDivision;
}

export function planSchoolRosters(gameSlug: string, existing: ExistingRosterRef[]): RosterToCreate[] {
  const haveDivision = new Set(existing.map((r) => canonicalDivision(r.division)));
  // (team, name) is unique: a roster named "Varsity" stored under another division must not be hit.
  const takenNames = new Set(existing.map((r) => r.name));

  const toCreate: RosterToCreate[] = [];
  for (const canonical of allowedRosterDivisions(gameSlug)) {
    if (haveDivision.has(canonical)) continue;
    let name: string = canonical;
    for (let n = 2; takenNames.has(name); n++) name = `${canonical} ${n}`;
    takenNames.add(name);
    toCreate.push({ name, division: storedDivision(canonical), canonical });
  }
  return toCreate;
}

/** "Varsity roster", "Varsity and JV rosters": the count decides singular or plural. */
export function rosterNamesPhrase(names: string[]): string {
  if (names.length === 0) return 'no rosters';
  if (names.length === 1) return `${names[0]} roster`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} rosters`;
}

/** Divisions the game fields that this team has no roster for yet (drives the "missing roster" hint). */
export function missingDivisions(gameSlug: string, existing: ExistingRosterRef[]): CanonicalDivision[] {
  return planSchoolRosters(gameSlug, existing).map((r) => r.canonical);
}
