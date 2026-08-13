'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { slugify } from '@/app/lib/text-utils';
import { sortRostersByDivision } from './[school]/SchoolSnapshotsClient';

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

export default function TeamsFilterClient({
  schoolGroups,
  teamGroups,
  gameDisplayName,
  gameSlug,
}: TeamsFilterClientProps) {
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

  // Extract unique seasons across all schools
  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    normalizedSchoolGroups.forEach((school) => {
      school.seasons.forEach((season) => {
        if (season.seasonName) set.add(season.seasonName);
      });
    });
    return Array.from(set);
  }, [normalizedSchoolGroups]);

  // Find default season: Current/Active season if present, else most recent season
  const defaultSeasonName = useMemo(() => {
    let activeName = '';
    normalizedSchoolGroups.forEach((school) => {
      school.seasons.forEach((season) => {
        if (season.isSeasonActive && !activeName) {
          activeName = season.seasonName;
        }
      });
    });
    if (activeName) return activeName;
    return availableSeasons.length > 0 ? availableSeasons[0] : 'all';
  }, [normalizedSchoolGroups, availableSeasons]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>(defaultSeasonName);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [captainsOnly, setCaptainsOnly] = useState(false);

  // Extract unique divisions from the data, sorted: Varsity on top, JV on bottom
  const availableDivisions = useMemo(() => {
    const set = new Set<string>();
    normalizedSchoolGroups.forEach((school) => {
      school.seasons.forEach((season) => {
        season.rosters.forEach((roster) => {
          if (roster.name) set.add(roster.name);
        });
      });
    });
    const items = Array.from(set).map((name) => ({ name }));
    return sortRostersByDivision(items).map((item) => item.name);
  }, [normalizedSchoolGroups]);

  // Extract unique roles from the data
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    normalizedSchoolGroups.forEach((school) => {
      school.seasons.forEach((season) => {
        season.rosters.forEach((roster) => {
          roster.players.forEach((player) => {
            if (player.role) set.add(player.role);
          });
        });
      });
    });
    return Array.from(set).sort();
  }, [normalizedSchoolGroups]);

  // Perform in-memory filtering
  const filteredSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return normalizedSchoolGroups
      .map((school) => {
        const schoolNameMatches = q ? school.schoolName.toLowerCase().includes(q) : false;

        const filteredSeasons = school.seasons
          .filter((season) => {
            if (selectedSeason === 'all') return true;
            return season.seasonName.toLowerCase() === selectedSeason.toLowerCase();
          })
          .map((season) => {
            const seasonNameMatches = q ? season.seasonName.toLowerCase().includes(q) : false;

            const filteredRosters = sortRostersByDivision(
              season.rosters.filter((roster) => {
                if (selectedDivision === 'all') return true;
                return roster.name.toLowerCase() === selectedDivision.toLowerCase();
              })
            )
              .map((roster) => {
                const rosterNameMatches = q ? roster.name.toLowerCase().includes(q) : false;

                const filteredPlayers = roster.players.filter((player) => {
                  // Role filter
                  if (selectedRole !== 'all' && player.role !== selectedRole) {
                    return false;
                  }

                  // Captains only filter
                  if (captainsOnly && player.role !== 'Captain' && !player.isCaptain) {
                    return false;
                  }

                  // Search query filter: match school name, season name, roster name, player name, role, or bio
                  if (!q || schoolNameMatches || seasonNameMatches || rosterNameMatches) return true;

                  const nameMatch = player.name.toLowerCase().includes(q);
                  const roleMatch = player.role.toLowerCase().includes(q);
                  const bioMatch = player.bio.toLowerCase().includes(q);

                  return nameMatch || roleMatch || bioMatch;
                });

                return {
                  ...roster,
                  players: filteredPlayers,
                };
              })
              .filter((roster) => roster.players.length > 0);

            return {
              ...season,
              rosters: filteredRosters,
            };
          })
          .filter((season) => season.rosters.length > 0);

        return {
          ...school,
          seasons: filteredSeasons,
        };
      })
      .filter((school) => school.seasons.length > 0);
  }, [normalizedSchoolGroups, searchQuery, selectedSeason, selectedDivision, selectedRole, captainsOnly]);

  // Count total matching stats
  const totalMatchingSchools = filteredSchools.length;
  const totalMatchingSeasons = useMemo(() => {
    return filteredSchools.reduce((acc, school) => acc + school.seasons.length, 0);
  }, [filteredSchools]);
  const totalMatchingPlayers = useMemo(() => {
    return filteredSchools.reduce((acc, school) => {
      return (
        acc +
        school.seasons.reduce((sAcc, season) => {
          return sAcc + season.rosters.reduce((rAcc, roster) => rAcc + roster.players.length, 0);
        }, 0)
      );
    }, 0);
  }, [filteredSchools]);

  const isFiltered =
    searchQuery !== '' ||
    selectedSeason !== defaultSeasonName ||
    selectedDivision !== 'all' ||
    selectedRole !== 'all' ||
    captainsOnly;

  const handleReset = () => {
    setSearchQuery('');
    setSelectedSeason(defaultSeasonName);
    setSelectedDivision('all');
    setSelectedRole('all');
    setCaptainsOnly(false);
  };

  const resolvedGameSlug = gameSlug || slugify(gameDisplayName);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Filtering Control Bar */}
      <Card padding="md" className="space-y-4 border border-line bg-surface-raised/80 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-foreground-muted">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${gameDisplayName} schools, rosters, IGNs, or players...`}
              className="w-full rounded-xl border border-line bg-surface-sunken py-3 sm:py-2.5 pl-10 pr-9 text-base md:text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent touch-manipulation"
              aria-label="Filter schools and rosters by search text"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 min-w-[44px] justify-center text-foreground-muted hover:text-foreground touch-manipulation"
                title="Clear search"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Division Selector Swipeable Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth snap-x touch-manipulation">
            <button
              type="button"
              onClick={() => setSelectedDivision('all')}
              className={`px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                selectedDivision === 'all'
                  ? 'bg-accent text-on-accent border-accent'
                  : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40'
              }`}
            >
              All Divisions
            </button>
            {availableDivisions.map((divName) => {
              const label = divName === 'JV' ? 'Junior Varsity' : divName;
              const isActive = selectedDivision.toLowerCase() === divName.toLowerCase();
              return (
                <button
                  key={divName}
                  type="button"
                  onClick={() => setSelectedDivision(divName)}
                  className={`px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                    isActive
                      ? 'bg-accent text-on-accent border-accent'
                      : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Row: Season, Role & Captains Toggles */}
        <div className="flex flex-col gap-3 pt-3 border-t border-line/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            {/* Season Selector Dropdown (Defaults to Current Season) */}
            {availableSeasons.length > 0 && (
              <div className="relative col-span-1">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full sm:w-auto appearance-none rounded-xl border border-line bg-surface-sunken py-2.5 sm:py-2 pl-3 pr-8 text-xs font-bold text-foreground-secondary hover:text-foreground focus:border-accent focus:outline-none cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation"
                  aria-label="Filter by season"
                >
                  {availableSeasons.map((seasonName) => (
                    <option key={seasonName} value={seasonName}>
                      {seasonName} {seasonName === defaultSeasonName ? '(Current Season)' : ''}
                    </option>
                  ))}
                  <option value="all">All Seasons</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-foreground-muted">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Role Select Dropdown */}
            {availableRoles.length > 0 && (
              <div className="relative col-span-1">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full sm:w-auto appearance-none rounded-xl border border-line bg-surface-sunken py-2.5 sm:py-2 pl-3 pr-8 text-xs font-bold text-foreground-secondary hover:text-foreground focus:border-accent focus:outline-none cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation"
                  aria-label="Filter by player role"
                >
                  <option value="all">All Roles</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-foreground-muted">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Captains Toggle */}
            <button
              type="button"
              onClick={() => setCaptainsOnly(!captainsOnly)}
              className={`col-span-2 sm:col-span-1 px-3.5 py-2.5 sm:py-2 text-xs font-bold rounded-xl border transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation ${
                captainsOnly
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground'
              }`}
            >
              <span className="text-accent">★</span>
              Captains Only
            </button>
          </div>

          {/* Results Counter & Reset Button */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-foreground-muted pt-1 sm:pt-0">
            <span className="truncate">
              Showing <strong className="text-foreground font-bold">{totalMatchingSchools}</strong> school
              {totalMatchingSchools === 1 ? '' : 's'} ({totalMatchingSeasons} season snapshot
              {totalMatchingSeasons === 1 ? '' : 's'}, <strong className="text-foreground font-bold">{totalMatchingPlayers}</strong> player{totalMatchingPlayers === 1 ? '' : 's'})
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="font-bold text-accent hover:underline cursor-pointer shrink-0 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Grid: Member Schools List */}
      <div className="space-y-6">
        {filteredSchools.length === 0 ? (
          <div className="text-center p-8 sm:p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line space-y-4">
            <p className="font-semibold text-foreground-secondary">
              {isFiltered ? 'No member schools match your active filters.' : 'No active school teams registered for this game yet.'}
            </p>
            {isFiltered && (
              <div>
                <Button size="sm" variant="secondary" onClick={handleReset}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSchools.map((school) => {
              const divisionsSet = new Set<string>();
              let totalSchoolPlayers = 0;

              school.seasons.forEach((season) => {
                season.rosters.forEach((roster) => {
                  divisionsSet.add(roster.name === 'JV' ? 'Junior Varsity' : roster.name);
                  totalSchoolPlayers += roster.players.length;
                });
              });

              // Sort division badges: Varsity on top (1st), Junior Varsity on bottom (2nd)
              const sortedDivisions = Array.from(divisionsSet).map((name) => ({ name }));
              const divisions = sortRostersByDivision(sortedDivisions).map((item) => item.name);

              const schoolSlug = school.schoolSlug || slugify(school.schoolName);
              const schoolHref = `/${resolvedGameSlug}/teams/${schoolSlug}`;

              return (
                <Card
                  key={school.schoolId}
                  interactive
                  padding="md"
                  className="flex flex-col justify-between space-y-5 p-5 sm:p-6 group hover:border-accent/60 transition-all duration-300 touch-manipulation"
                >
                  <Link href={schoolHref} className="space-y-4 block">
                    {/* Header: Logo & School Name */}
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-surface-sunken border border-line rounded-full flex items-center justify-center text-foreground font-black text-lg sm:text-xl shrink-0 group-hover:border-accent/40 group-hover:text-accent transition-colors">
                        {school.schoolName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight group-hover:text-accent transition-colors leading-snug line-clamp-2">
                          {school.schoolName}
                        </h2>
                        <p className="text-xs text-foreground-muted mt-0.5">
                          {school.seasons.length} Season Snapshot{school.seasons.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    {/* Divisions & Badges (Varsity 1st, Junior Varsity 2nd) */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {divisions.map((divName) => (
                        <Badge key={divName} size="sm" variant="neutral">
                          {divName}
                        </Badge>
                      ))}
                    </div>

                    {/* Quick Stats Summary */}
                    <div className="text-xs text-foreground-secondary border-t border-line/50 pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>Active Roster Snapshots</span>
                        <span className="font-bold text-foreground">
                          {school.seasons.reduce((acc, s) => acc + s.rosters.length, 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total Registered Students</span>
                        <span className="font-bold text-foreground">{totalSchoolPlayers}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Dedicated Page Route Link CTA */}
                  <div className="pt-2">
                    <Button
                      href={schoolHref}
                      variant="outline"
                      size="sm"
                      className="w-full min-h-[44px] sm:min-h-[38px] flex items-center justify-center gap-2 group-hover:bg-accent group-hover:text-on-accent group-hover:border-accent transition-all duration-300 touch-manipulation"
                    >
                      <span>View School Snapshots & Teams</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
