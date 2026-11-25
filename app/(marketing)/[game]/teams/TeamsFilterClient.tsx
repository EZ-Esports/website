'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { slugify } from '@/app/lib/text-utils';

export interface PlayerItem {
  name: string;
  role: string;
  bio: string;
  isCaptain?: boolean;
}

export interface RosterItem {
  id: string;
  name: string;
  division: string;
  record: string;
  players: PlayerItem[];
}

export interface SeasonTeamSnapshot {
  seasonId: string;
  seasonName: string;
  isSeasonActive?: boolean;
  rosters: RosterItem[];
}

export interface SchoolGroup {
  schoolId: string;
  schoolName: string;
  schoolSlug?: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  seasons: SeasonTeamSnapshot[];
  divisionBadges?: string[];
}

// Backwards compatibility alias for PR 68
export interface TeamRosterGroup {
  teamName: string;
  rosters: RosterItem[];
}

interface TeamsFilterClientProps {
  schoolGroups?: SchoolGroup[];
  teamGroups?: TeamRosterGroup[];
  gameDisplayName: string;
  gameSlug?: string;
}

/**
 * Sorts schools alphabetically by schoolName.
 */
export function sortSchoolsAlphabetically<T extends { schoolName: string }>(schools: T[]): T[] {
  return [...schools].sort((a, b) =>
    a.schoolName.localeCompare(b.schoolName, undefined, { sensitivity: 'base' })
  );
}

export type SchoolSortOption = 'name-asc' | 'name-desc' | 'season-desc';

/**
 * Sorts schools based on specified sort criteria:
 * - name-asc: Alphabetical (A-Z)
 * - name-desc: Alphabetical (Z-A)
 * - season-desc: Most recent / active season first, ties broken by school name
 */
export function sortSchools<T extends SchoolGroup>(
  schools: T[],
  sortBy: SchoolSortOption = 'name-asc'
): T[] {
  const copy = [...schools];
  if (sortBy === 'name-desc') {
    return copy.sort((a, b) =>
      b.schoolName.localeCompare(a.schoolName, undefined, { sensitivity: 'base' })
    );
  }
  if (sortBy === 'season-desc') {
    return copy.sort((a, b) => {
      const aHasActive = a.seasons?.some((s) => s.isSeasonActive) ? 1 : 0;
      const bHasActive = b.seasons?.some((s) => s.isSeasonActive) ? 1 : 0;
      if (bHasActive !== aHasActive) {
        return bHasActive - aHasActive;
      }
      const aLatestSeason = a.seasons?.find((s) => s.isSeasonActive)?.seasonName || a.seasons?.[0]?.seasonName || '';
      const bLatestSeason = b.seasons?.find((s) => s.isSeasonActive)?.seasonName || b.seasons?.[0]?.seasonName || '';
      const seasonCompare = bLatestSeason.localeCompare(aLatestSeason, undefined, { numeric: true });
      if (seasonCompare !== 0) {
        return seasonCompare;
      }
      return a.schoolName.localeCompare(b.schoolName, undefined, { sensitivity: 'base' });
    });
  }
  return copy.sort((a, b) =>
    a.schoolName.localeCompare(b.schoolName, undefined, { sensitivity: 'base' })
  );
}

/**
 * Filters schools by season name or ID. If seasonFilter is 'all' or empty, returns all schools.
 */
export function filterSchoolsBySeason<T extends SchoolGroup>(
  schools: T[],
  seasonFilter: string
): T[] {
  const s = seasonFilter?.trim();
  if (!s || s.toLowerCase() === 'all') return schools;

  return schools.filter((school) =>
    school.seasons?.some(
      (season) =>
        season.seasonName.toLowerCase() === s.toLowerCase() ||
        season.seasonId.toLowerCase() === s.toLowerCase()
    )
  );
}

export interface AvailableSeason {
  seasonName: string;
  isSeasonActive?: boolean;
}

/**
 * Extracts distinct seasons across all schools, ordered active first, then descending by season name.
 */
export function getAvailableSeasons(schools: SchoolGroup[]): AvailableSeason[] {
  const map = new Map<string, AvailableSeason>();
  for (const school of schools) {
    for (const season of school.seasons || []) {
      if (season.seasonName && !map.has(season.seasonName)) {
        map.set(season.seasonName, {
          seasonName: season.seasonName,
          isSeasonActive: Boolean(season.isSeasonActive),
        });
      } else if (season.isSeasonActive && map.has(season.seasonName)) {
        map.get(season.seasonName)!.isSeasonActive = true;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.isSeasonActive && !b.isSeasonActive) return -1;
    if (!a.isSeasonActive && b.isSeasonActive) return 1;
    return b.seasonName.localeCompare(a.seasonName, undefined, { numeric: true });
  });
}

/**
 * Determines the default season to display.
 * Defaults to the current active season (e.g. 2026-27 / 26-27), or any active season,
 * or the most recent season, falling back to 'all'.
 */
export function getDefaultSeason(availableSeasons: AvailableSeason[]): string {
  if (!availableSeasons || availableSeasons.length === 0) return 'all';

  // 1. Current active season explicitly matching 2026-27 or 26-27
  const currentActive = availableSeasons.find(
    (s) => s.isSeasonActive && (s.seasonName === '2026-27' || s.seasonName.includes('26-27'))
  );
  if (currentActive) return currentActive.seasonName;

  // 2. Any active season
  const anyActive = availableSeasons.find((s) => s.isSeasonActive);
  if (anyActive) return anyActive.seasonName;

  // 3. Any season matching 2026-27 or 26-27
  const currentNamed = availableSeasons.find(
    (s) => s.seasonName === '2026-27' || s.seasonName.includes('26-27')
  );
  if (currentNamed) return currentNamed.seasonName;

  // 4. Most recent season
  return availableSeasons[0]?.seasonName || 'all';
}

/**
 * Builds the canonical roster page link for a given school and game.
 */
export function getTeamRosterUrl(
  gameSlug: string,
  school: { schoolSlug?: string; schoolName: string }
): string {
  const schoolSlug = school.schoolSlug || slugify(school.schoolName);
  return `/${gameSlug}/teams/${schoolSlug}`;
}

/**
 * Filters schools based on search query matching school name or division badges.
 */
export function filterSchoolsByQuery<T extends SchoolGroup>(
  schools: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return schools;

  const isVarsityQuery = q === 'varsity';
  const isJvQuery = q === 'jv' || q.includes('jv');

  return schools.filter((school) => {
    const nameMatch = school.schoolName.toLowerCase().includes(q);
    const badges = getSchoolDivisionBadges(school);
    const badgeMatch = badges.some((b) => {
      const lower = b.toLowerCase();
      if (isVarsityQuery) {
        return lower === 'varsity';
      }
      return lower.includes(q);
    });
    const jvMatch = isJvQuery && badges.includes('Junior Varsity');
    return nameMatch || badgeMatch || jvMatch;
  });
}

export type DivisionFilterOption = 'all' | 'varsity' | 'jv';

/**
 * Filters schools by division ('all', 'varsity', 'jv').
 * - 'all' (default): returns all schools (both Varsity and JV)
 * - 'varsity': returns schools fielding a Varsity roster
 * - 'jv': returns schools fielding a Junior Varsity roster
 */
export function filterSchoolsByDivision<T extends SchoolGroup>(
  schools: T[],
  division: DivisionFilterOption | string,
  targetSeason?: string
): T[] {
  const d = division?.trim().toLowerCase();
  if (!d || d === 'all') return schools;

  const wantVarsity = d === 'varsity';
  const wantJv = d === 'jv' || d === 'junior-varsity' || d === 'junior varsity';

  return schools.filter((school) => {
    const badges = getSchoolDivisionBadges(school, true, targetSeason);
    if (wantVarsity) {
      return badges.includes('Varsity');
    }
    if (wantJv) {
      return badges.includes('Junior Varsity');
    }
    return badges.some((b) => b.toLowerCase() === d);
  });
}

/**
 * Determines the division badge labels for a school.
 * If a team fields both Varsity and Junior Varsity, returns both ['Varsity', 'Junior Varsity'].
 * If only Varsity, returns ['Varsity'].
 * If only Junior Varsity, returns ['Junior Varsity'].
 * For tournament / undivided models, returns the division name or ['Open'].
 */
export function getSchoolDivisionBadges(
  school: SchoolGroup,
  preferActiveSeasons = true,
  targetSeason?: string
): string[] {
  if (school.divisionBadges && school.divisionBadges.length > 0) {
    return school.divisionBadges;
  }

  let seasonsToInspect = school.seasons || [];
  if (targetSeason && targetSeason !== 'all') {
    const matched = school.seasons?.filter(
      (s) =>
        s.seasonName.toLowerCase() === targetSeason.toLowerCase() ||
        s.seasonId.toLowerCase() === targetSeason.toLowerCase()
    );
    if (matched && matched.length > 0) {
      seasonsToInspect = matched;
    }
  } else if (preferActiveSeasons) {
    const activeWithRosters = school.seasons?.filter(
      (s) => s.isSeasonActive && s.rosters && s.rosters.length > 0
    );
    if (activeWithRosters && activeWithRosters.length > 0) {
      seasonsToInspect = activeWithRosters;
    }
  }

  let hasVarsity = false;
  let hasJv = false;
  const otherDivisions = new Set<string>();

  for (const s of seasonsToInspect) {
    const rosters = s.rosters || [];
    const hasAnyPlayers = rosters.some((r) => r.players && r.players.length > 0);
    const hasAnyStandings = rosters.some(
      (r) => r.record && r.record !== 'Unpublished' && r.record !== '0-0'
    );

    const validRosters = rosters.filter((r) => {
      const hasStanding = Boolean(r.record && r.record !== 'Unpublished' && r.record !== '0-0');
      const hasPlayers = Boolean(r.players && r.players.length > 0);
      if (hasAnyStandings || hasAnyPlayers) {
        return hasStanding || hasPlayers;
      }
      return true;
    });

    for (const r of validRosters) {
      const name = (r.name || '').toLowerCase().trim();
      const div = (r.division || '').toLowerCase().trim();

      const isJv =
        name === 'jv' ||
        name.includes('junior varsity') ||
        name.includes('junior') ||
        div === 'jv' ||
        div === 'b';

      const isVarsity =
        !isJv &&
        (name === 'varsity' ||
          name.includes('varsity') ||
          div === 'varsity' ||
          div === 'a');

      if (isJv) {
        hasJv = true;
      } else if (isVarsity) {
        hasVarsity = true;
      } else if (div === 'all' || name === 'all' || name === 'entrants') {
        otherDivisions.add('Open');
      } else if (r.name?.trim()) {
        otherDivisions.add(r.name.trim());
      } else if (r.division?.trim()) {
        otherDivisions.add(r.division.trim());
      }
    }
  }

  const badges: string[] = [];
  if (hasVarsity) badges.push('Varsity');
  if (hasJv) badges.push('Junior Varsity');

  if (badges.length > 0) return badges;

  if (otherDivisions.size > 0) {
    const first = Array.from(otherDivisions)[0];
    return [first === 'All' ? 'Open' : first];
  }

  return ['Registered'];
}

/**
 * Backwards compatibility helper returning single primary label.
 */
export function getSchoolDivisionLabel(
  school: SchoolGroup,
  preferActiveSeasons = true
): string {
  const badges = getSchoolDivisionBadges(school, preferActiveSeasons);
  if (badges.length === 2 && badges.includes('Varsity') && badges.includes('Junior Varsity')) {
    return 'Both';
  }
  return badges[0] || 'Registered';
}

export default function TeamsFilterClient({
  schoolGroups,
  teamGroups,
  gameDisplayName,
  gameSlug,
}: TeamsFilterClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize inputs to ensure backwards compatibility with PR 68's teamGroups
  const normalizedSchoolGroups: SchoolGroup[] = useMemo(() => {
    if (schoolGroups && schoolGroups.length > 0) return schoolGroups;
    if (!teamGroups) return [];
    return teamGroups.map((g, idx) => ({
      schoolId: `legacy-school-${idx}`,
      schoolName: g.teamName,
      schoolSlug: slugify(g.teamName),
      seasons: [
        {
          seasonId: 'current-season',
          seasonName: 'Current Season',
          isSeasonActive: true,
          rosters: g.rosters,
        },
      ],
    }));
  }, [schoolGroups, teamGroups]);

  const availableSeasons = useMemo(() => {
    return getAvailableSeasons(normalizedSchoolGroups);
  }, [normalizedSchoolGroups]);

  const defaultSeason = useMemo(() => {
    return getDefaultSeason(availableSeasons);
  }, [availableSeasons]);

  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilterOption>('all');

  // Combined filtering & sorting (always sorted Alphabetically A-Z)
  const processedSchools = useMemo(() => {
    const seasonFiltered = filterSchoolsBySeason(normalizedSchoolGroups, selectedSeason);
    const divisionFiltered = filterSchoolsByDivision(seasonFiltered, selectedDivision, selectedSeason);
    const searchFiltered = filterSchoolsByQuery(divisionFiltered, searchQuery);
    return sortSchoolsAlphabetically(searchFiltered);
  }, [normalizedSchoolGroups, selectedSeason, selectedDivision, searchQuery]);

  const resolvedGameSlug = gameSlug || slugify(gameDisplayName);

  if (normalizedSchoolGroups.length === 0) {
    return (
      <div className="text-center p-8 sm:p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line space-y-2">
        <p className="font-semibold text-foreground-secondary">
          No active school teams registered for {gameDisplayName} yet.
        </p>
        <p className="text-xs text-foreground-muted">
          Check back soon as schools finalize their rosters for upcoming competitions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls: Search Bar + Season Filter + Division Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search teams in ${gameDisplayName}...`}
            aria-label={`Search teams in ${gameDisplayName}`}
            className="w-full min-h-[44px] bg-surface-raised border border-line rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
          />
          <svg
            className="absolute left-3.5 top-3 w-4 h-4 text-foreground-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-foreground-muted hover:text-foreground text-sm cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Season Filter Dropdown */}
        {availableSeasons.length > 0 && (
          <div className="relative shrink-0">
            <label htmlFor="season-filter" className="sr-only">
              Filter by season
            </label>
            <select
              id="season-filter"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              aria-label="Filter by season"
              className="w-full sm:w-auto min-h-[44px] bg-surface-raised border border-line rounded-xl pl-3.5 pr-8 py-2 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Seasons</option>
              {availableSeasons.map((season) => (
                <option key={season.seasonName} value={season.seasonName}>
                  {season.seasonName} {season.isSeasonActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {/* Division Filter Dropdown (Varsity / JV / Both) */}
        <div className="relative shrink-0">
          <label htmlFor="division-filter" className="sr-only">
            Filter by division
          </label>
          <select
            id="division-filter"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value as DivisionFilterOption)}
            aria-label="Filter by division"
            className="w-full sm:w-auto min-h-[44px] bg-surface-raised border border-line rounded-xl pl-3.5 pr-8 py-2 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Divisions (Varsity & JV)</option>
            <option value="varsity">Varsity</option>
            <option value="jv">Junior Varsity (JV)</option>
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Team count header */}
      <div role="status" aria-live="polite" className="flex items-center justify-between text-xs text-foreground-muted px-1">
        <span>
          Showing <strong className="text-foreground font-bold">{processedSchools.length}</strong>{' '}
          {searchQuery || selectedSeason !== 'all' || selectedDivision !== 'all'
            ? `matching team${processedSchools.length === 1 ? '' : 's'}`
            : `team${normalizedSchoolGroups.length === 1 ? '' : 's'}`}
          {(searchQuery || selectedSeason !== 'all' || selectedDivision !== 'all') && normalizedSchoolGroups.length !== processedSchools.length && (
            <span className="text-foreground-muted"> (of {normalizedSchoolGroups.length})</span>
          )}
        </span>
        <span className="hidden sm:inline">Alphabetical (A–Z)</span>
      </div>

      {/* List of teams or empty filter state */}
      {processedSchools.length === 0 ? (
        <div className="text-center p-8 sm:p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line space-y-3">
          <p className="font-semibold text-foreground-secondary">
            {searchQuery ? (
              <>No teams match &ldquo;{searchQuery}&rdquo;.</>
            ) : selectedDivision !== 'all' ? (
              <>No {selectedDivision === 'jv' ? 'Junior Varsity' : 'Varsity'} teams found for the selected season.</>
            ) : (
              <>No teams found for the selected season.</>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedSeason(defaultSeason);
              setSelectedDivision('all');
            }}
            className="min-h-[44px] inline-flex items-center text-xs font-bold text-accent hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-raised/60 divide-y divide-line overflow-hidden shadow-sm">
          {processedSchools.map((school) => {
            const rosterHref = getTeamRosterUrl(resolvedGameSlug, school);
            const activeSeason = school.seasons?.find((s) => s.isSeasonActive);
            const latestSeason = activeSeason?.seasonName || school.seasons?.[0]?.seasonName;

            return (
              <div
                key={school.schoolId}
                className="group relative flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-surface-sunken/50 transition-colors"
              >
                {/* School avatar & clickable school name */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-surface-sunken border border-line flex items-center justify-center text-foreground font-black text-sm shrink-0 group-hover:border-accent/40 group-hover:text-accent transition-colors overflow-hidden">
                    {school.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={school.logoUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      school.schoolName.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={rosterHref}
                      className="text-sm sm:text-base font-semibold text-foreground hover:text-accent focus:outline-none focus:underline transition-colors tracking-tight truncate block after:absolute after:inset-0"
                    >
                      {school.schoolName}
                    </Link>
                  </div>
                </div>

                {/* Subtle season name & navigation chevron */}
                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  {latestSeason && (
                    <span className="text-xs text-foreground-muted hidden sm:inline">
                      {latestSeason}
                      {activeSeason && (
                        <span className="ml-1 text-[10px] font-bold text-accent uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </span>
                  )}

                  <Link
                    href={rosterHref}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="text-foreground-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
