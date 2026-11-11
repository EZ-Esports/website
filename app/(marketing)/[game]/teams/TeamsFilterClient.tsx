'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge from '@/app/components/ui/Badge';
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

/**
 * Determines the division badge labels for a school.
 * If a team fields both Varsity and Junior Varsity, returns both ['Varsity', 'Junior Varsity'].
 * If only Varsity, returns ['Varsity'].
 * If only Junior Varsity, returns ['Junior Varsity'].
 * For tournament / undivided models, returns the division name or ['Open'].
 */
export function getSchoolDivisionBadges(
  school: SchoolGroup,
  preferActiveSeasons = true
): string[] {
  if (school.divisionBadges && school.divisionBadges.length > 0) {
    return school.divisionBadges;
  }

  let seasonsToInspect = school.seasons || [];
  if (preferActiveSeasons) {
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

  const sortedSchools = useMemo(() => {
    return sortSchoolsAlphabetically(normalizedSchoolGroups);
  }, [normalizedSchoolGroups]);

  const resolvedGameSlug = gameSlug || slugify(gameDisplayName);

  // Search filter
  const filteredSchools = useMemo(() => {
    return filterSchoolsByQuery(sortedSchools, searchQuery);
  }, [sortedSchools, searchQuery]);

  if (sortedSchools.length === 0) {
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
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search teams in ${gameDisplayName}...`}
          aria-label={`Search teams in ${gameDisplayName}`}
          className="w-full bg-surface-raised border border-line rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
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

      {/* Team count header */}
      <div role="status" aria-live="polite" className="flex items-center justify-between text-xs text-foreground-muted px-1">
        <span>
          Showing <strong className="text-foreground font-bold">{filteredSchools.length}</strong>{' '}
          {searchQuery ? `matching team${filteredSchools.length === 1 ? '' : 's'}` : `team${sortedSchools.length === 1 ? '' : 's'}`}
          {searchQuery && sortedSchools.length !== filteredSchools.length && (
            <span className="text-foreground-muted"> (of {sortedSchools.length})</span>
          )}
        </span>
        <span className="hidden sm:inline">Alphabetical (A–Z)</span>
      </div>

      {/* List of teams or empty filter state */}
      {filteredSchools.length === 0 ? (
        <div className="text-center p-8 sm:p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line space-y-3">
          <p className="font-semibold text-foreground-secondary">
            No teams match &ldquo;{searchQuery}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-accent hover:underline cursor-pointer"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface-raised/60 divide-y divide-line overflow-hidden shadow-sm">
          {filteredSchools.map((school) => {
            const divisionBadges = getSchoolDivisionBadges(school);
            const rosterHref = getTeamRosterUrl(resolvedGameSlug, school);

            return (
              <div
                key={school.schoolId}
                className="group flex items-center justify-between gap-4 p-4 sm:p-5 hover:bg-surface-sunken/50 transition-colors"
              >
                {/* School avatar & clickable team name */}
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-surface-sunken border border-line rounded-xl flex items-center justify-center text-foreground font-black text-base sm:text-lg shrink-0 group-hover:border-accent/40 group-hover:text-accent transition-colors overflow-hidden">
                    {school.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={school.logoUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      school.schoolName.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={rosterHref}
                      className="text-base sm:text-lg font-bold text-foreground hover:text-accent focus:outline-none focus:underline transition-colors tracking-tight truncate block"
                    >
                      {school.schoolName}
                    </Link>
                  </div>
                </div>

                {/* Division indicator badges & navigation chevron */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {divisionBadges.map((badge) => (
                      <Badge
                        key={badge}
                        variant="neutral"
                        size="sm"
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>

                  <Link
                    href={rosterHref}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="text-foreground-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
