'use client';

import { useMemo, useState, useEffect } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';

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
}

export default function TeamsFilterClient({
  schoolGroups,
  teamGroups,
  gameDisplayName,
}: TeamsFilterClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [captainsOnly, setCaptainsOnly] = useState(false);

  // Active modal state for clicking into a school
  const [selectedSchool, setSelectedSchool] = useState<SchoolGroup | null>(null);
  const [modalSeasonFilter, setModalSeasonFilter] = useState<string>('all');

  // Normalize inputs to ensure backwards compatibility with PR 68's teamGroups
  const normalizedSchoolGroups: SchoolGroup[] = useMemo(() => {
    if (schoolGroups && schoolGroups.length > 0) return schoolGroups;
    if (!teamGroups) return [];
    return teamGroups.map((g, idx) => ({
      schoolId: `legacy-school-${idx}`,
      schoolName: g.teamName,
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

  // Extract unique divisions from the data
  const availableDivisions = useMemo(() => {
    const set = new Set<string>();
    normalizedSchoolGroups.forEach((school) => {
      school.seasons.forEach((season) => {
        season.rosters.forEach((roster) => {
          if (roster.name) set.add(roster.name);
        });
      });
    });
    return Array.from(set);
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

  // Handle escape key & lock background body scrolling when modal/drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSchool(null);
      }
    };

    if (selectedSchool) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSchool]);

  // Perform in-memory filtering (No lazy loading)
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

            const filteredRosters = season.rosters
              .filter((roster) => {
                if (selectedDivision === 'all') return true;
                return roster.name.toLowerCase() === selectedDivision.toLowerCase();
              })
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
    selectedSeason !== 'all' ||
    selectedDivision !== 'all' ||
    selectedRole !== 'all' ||
    captainsOnly;

  const handleReset = () => {
    setSearchQuery('');
    setSelectedSeason('all');
    setSelectedDivision('all');
    setSelectedRole('all');
    setCaptainsOnly(false);
  };

  const openSchoolModal = (school: SchoolGroup) => {
    setSelectedSchool(school);
    setModalSeasonFilter('all');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Filtering Control Bar */}
      <Card padding="md" className="space-y-4 border border-line bg-surface-raised/80 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input (text-base on mobile prevents iOS auto-zoom) */}
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
            {/* Season Selector Dropdown */}
            {availableSeasons.length > 0 && (
              <div className="relative col-span-1">
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full sm:w-auto appearance-none rounded-xl border border-line bg-surface-sunken py-2.5 sm:py-2 pl-3 pr-8 text-xs font-bold text-foreground-secondary hover:text-foreground focus:border-accent focus:outline-none cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation"
                  aria-label="Filter by season"
                >
                  <option value="all">All Seasons</option>
                  {availableSeasons.map((seasonName) => (
                    <option key={seasonName} value={seasonName}>
                      {seasonName}
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

      {/* Main Grid: Member Schools List (Students hidden behind schools) */}
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
              // Gather division badges across seasons
              const divisionsSet = new Set<string>();
              let totalSchoolPlayers = 0;

              school.seasons.forEach((season) => {
                season.rosters.forEach((roster) => {
                  divisionsSet.add(roster.name === 'JV' ? 'Junior Varsity' : roster.name);
                  totalSchoolPlayers += roster.players.length;
                });
              });

              const divisions = Array.from(divisionsSet);

              return (
                <Card
                  key={school.schoolId}
                  interactive
                  padding="md"
                  onClick={() => openSchoolModal(school)}
                  className="flex flex-col justify-between space-y-5 p-5 sm:p-6 group hover:border-accent/60 transition-all duration-300 touch-manipulation"
                >
                  <div className="space-y-4">
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

                    {/* Divisions & Badges */}
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
                  </div>

                  {/* Click-into Action CTA */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full min-h-[44px] sm:min-h-[38px] flex items-center justify-center gap-2 group-hover:bg-accent group-hover:text-on-accent group-hover:border-accent transition-all duration-300 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSchoolModal(school);
                      }}
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

      {/* Interactive School Snapshot Mobile Drawer / Dialog View */}
      {selectedSchool && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end md:justify-center p-0 md:p-6 overflow-y-auto animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="school-modal-title"
          onClick={() => setSelectedSchool(null)}
        >
          {/* Modal / Mobile Sheet Panel */}
          <div
            className="relative w-full max-h-[92vh] md:max-h-[85vh] md:max-w-4xl bg-surface-raised border-t md:border border-line rounded-t-3xl md:rounded-2xl shadow-2xl p-5 sm:p-6 md:p-8 space-y-5 md:space-y-6 overflow-y-auto md:my-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Indicator Pull Bar */}
            <div className="w-12 h-1.5 bg-foreground-muted/40 rounded-full mx-auto mb-1 md:hidden" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4 md:pb-6">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className="w-11 h-11 md:w-14 md:h-14 bg-surface-sunken border border-line rounded-full flex items-center justify-center text-accent font-black text-xl md:text-2xl shrink-0">
                  {selectedSchool.schoolName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="school-modal-title" className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight leading-tight line-clamp-2">
                    {selectedSchool.schoolName}
                  </h2>
                  <p className="text-xs sm:text-sm text-foreground-secondary mt-0.5">
                    Season Team Snapshots for {gameDisplayName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSchool(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors cursor-pointer shrink-0 touch-manipulation"
                title="Close dialog"
                aria-label="Close dialog"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* In-Modal Season Filter Bar */}
            {selectedSchool.seasons.length > 1 && (
              <div className="flex items-center gap-2 border-b border-line/60 pb-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 scroll-smooth snap-x touch-manipulation">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted shrink-0 mr-1 hidden sm:inline">
                  Season:
                </span>
                <button
                  type="button"
                  onClick={() => setModalSeasonFilter('all')}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 min-h-[40px] ${
                    modalSeasonFilter === 'all'
                      ? 'bg-accent text-on-accent border-accent'
                      : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground'
                  }`}
                >
                  All Seasons ({selectedSchool.seasons.length})
                </button>
                {selectedSchool.seasons.map((season) => (
                  <button
                    key={season.seasonId}
                    type="button"
                    onClick={() => setModalSeasonFilter(season.seasonName)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 min-h-[40px] ${
                      modalSeasonFilter === season.seasonName
                        ? 'bg-accent text-on-accent border-accent'
                        : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground'
                    }`}
                  >
                    {season.seasonName} {season.isSeasonActive ? '(Current)' : ''}
                  </button>
                ))}
              </div>
            )}

            {/* Season Team Snapshots */}
            <div className="space-y-6 pt-1">
              {selectedSchool.seasons
                .filter((season) => {
                  if (modalSeasonFilter === 'all') return true;
                  return season.seasonName === modalSeasonFilter;
                })
                .map((season) => (
                  <div key={season.seasonId} className="space-y-4 sm:space-y-5 bg-surface-sunken/40 rounded-2xl p-4 sm:p-5 border border-line/60">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-foreground">{season.seasonName} Snapshot</h3>
                        {season.isSeasonActive && <Badge size="sm" variant="success">Active Season</Badge>}
                      </div>
                      <span className="text-xs text-foreground-muted">
                        {season.rosters.length} Division Roster{season.rosters.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="space-y-5">
                      {season.rosters.map((roster) => (
                        <div key={roster.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground-secondary flex items-center gap-2">
                              <span>{roster.name === 'JV' ? 'Junior Varsity' : roster.name} Division</span>
                            </h4>
                            <Badge size="sm" variant="neutral">Record: {roster.record}</Badge>
                          </div>

                          {roster.players.length === 0 ? (
                            <p className="text-xs text-foreground-muted italic pl-2">
                              No registered players found under active filters.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {roster.players.map((player, pIdx) => (
                                <Card key={pIdx} padding="sm" className="flex flex-col justify-between bg-surface-raised/90 p-3.5 sm:p-4">
                                  <div>
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <h5 className="font-bold text-sm tracking-tight text-foreground line-clamp-1">{player.name}</h5>
                                      <Badge
                                        size="sm"
                                        variant={player.isCaptain || player.role === 'Captain' ? 'accent' : 'neutral'}
                                      >
                                        {player.role}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-foreground-secondary leading-relaxed mt-1 line-clamp-2">
                                      {player.bio}
                                    </p>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-line">
              <Button variant="secondary" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] touch-manipulation" onClick={() => setSelectedSchool(null)}>
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
