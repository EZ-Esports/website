'use client';

import { useMemo, useState } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';

export interface PlayerItem {
  name: string;
  role: string;
  bio: string;
}

export interface RosterItem {
  id: string;
  name: string;
  division: string;
  record: string;
  players: PlayerItem[];
}

export interface TeamRosterGroup {
  teamName: string;
  rosters: RosterItem[];
}

interface TeamsFilterClientProps {
  teamGroups: TeamRosterGroup[];
  gameDisplayName: string;
}

export default function TeamsFilterClient({ teamGroups, gameDisplayName }: TeamsFilterClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [captainsOnly, setCaptainsOnly] = useState(false);

  // Extract unique divisions from the data
  const availableDivisions = useMemo(() => {
    const set = new Set<string>();
    teamGroups.forEach((group) => {
      group.rosters.forEach((roster) => {
        if (roster.name) set.add(roster.name);
      });
    });
    return Array.from(set);
  }, [teamGroups]);

  // Extract unique roles from the data
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    teamGroups.forEach((group) => {
      group.rosters.forEach((roster) => {
        roster.players.forEach((player) => {
          if (player.role) set.add(player.role);
        });
      });
    });
    return Array.from(set).sort();
  }, [teamGroups]);

  // Perform in-memory filtering (No lazy loading)
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return teamGroups
      .map((group) => {
        const teamNameMatches = q ? group.teamName.toLowerCase().includes(q) : false;

        const filteredRosters = group.rosters
          .filter((roster) => {
            if (selectedDivision === 'all') return true;
            return roster.name.toLowerCase() === selectedDivision.toLowerCase();
          })
          .map((roster) => {
            const filteredPlayers = roster.players.filter((player) => {
              // Role filter
              if (selectedRole !== 'all' && player.role !== selectedRole) {
                return false;
              }

              // Captains only filter
              if (captainsOnly && player.role !== 'Captain') {
                return false;
              }

              // Search query filter: match player name, role, bio, or if team name matches
              if (!q || teamNameMatches) return true;

              const nameMatch = player.name.toLowerCase().includes(q);
              const roleMatch = player.role.toLowerCase().includes(q);
              const bioMatch = player.bio.toLowerCase().includes(q);
              const rosterNameMatch = roster.name.toLowerCase().includes(q);

              return nameMatch || roleMatch || bioMatch || rosterNameMatch;
            });

            return {
              ...roster,
              players: filteredPlayers,
            };
          })
          .filter((roster) => roster.players.length > 0);

        return {
          ...group,
          rosters: filteredRosters,
        };
      })
      .filter((group) => group.rosters.length > 0);
  }, [teamGroups, searchQuery, selectedDivision, selectedRole, captainsOnly]);

  // Count total matching stats
  const totalMatchingTeams = filteredGroups.length;
  const totalMatchingPlayers = useMemo(() => {
    return filteredGroups.reduce((acc, g) => {
      return acc + g.rosters.reduce((rAcc, r) => rAcc + r.players.length, 0);
    }, 0);
  }, [filteredGroups]);

  const isFiltered = searchQuery !== '' || selectedDivision !== 'all' || selectedRole !== 'all' || captainsOnly;

  const handleReset = () => {
    setSearchQuery('');
    setSelectedDivision('all');
    setSelectedRole('all');
    setCaptainsOnly(false);
  };

  return (
    <div className="space-y-8">
      {/* Filtering Control Bar */}
      <Card padding="md" className="space-y-4 border border-line bg-surface-raised/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              placeholder={`Search ${gameDisplayName} teams, player names, IGNs, or roles...`}
              className="w-full rounded-xl border border-line bg-surface-sunken py-2.5 pl-10 pr-9 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Filter teams and rosters by search text"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted hover:text-foreground"
                title="Clear search"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Division Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDivision('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
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
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
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

        {/* Secondary Filter Row: Roles & Quick Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Captains Toggle */}
            <button
              type="button"
              onClick={() => setCaptainsOnly(!captainsOnly)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                captainsOnly
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground'
              }`}
            >
              <span className="text-accent">★</span>
              Captains Only
            </button>

            {/* Role Select Dropdown */}
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="appearance-none rounded-lg border border-line bg-surface-sunken py-1.5 pl-3 pr-8 text-xs font-bold text-foreground-secondary hover:text-foreground focus:border-accent focus:outline-none cursor-pointer"
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
          </div>

          {/* Results Counter & Reset Button */}
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span>
              Showing <strong className="text-foreground font-bold">{totalMatchingTeams}</strong> team{totalMatchingTeams === 1 ? '' : 's'} (
              <strong className="text-foreground font-bold">{totalMatchingPlayers}</strong> player{totalMatchingPlayers === 1 ? '' : 's'})
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="font-bold text-accent hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Rendered Teams List */}
      <div className="space-y-12">
        {filteredGroups.length === 0 ? (
          <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line space-y-4">
            <p className="font-semibold text-foreground-secondary">
              {isFiltered ? 'No teams or rosters match your active filters.' : 'No active teams or rosters registered for this game yet.'}
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
          filteredGroups.map((group, index) => (
            <Card key={index} as="section" padding="lg" className="space-y-6">
              <div className="flex items-center gap-4 border-b border-line pb-4">
                <div className="w-12 h-12 bg-surface-sunken border border-line rounded-full flex items-center justify-center text-foreground shrink-0">
                  <span className="text-lg font-black">{group.teamName.charAt(0)}</span>
                </div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">{group.teamName}</h2>
              </div>

              <div className="space-y-8">
                {group.rosters.map((roster) => (
                  <div key={roster.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-secondary">
                        {roster.name === 'JV' ? 'Junior Varsity' : roster.name} Division
                      </h3>
                      <Badge size="sm">Record: {roster.record}</Badge>
                    </div>

                    {roster.players.length === 0 ? (
                      <p className="text-xs text-foreground-muted italic pl-2">
                        No players registered under this division roster.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roster.players.map((player, pIdx) => (
                          <Card key={pIdx} interactive padding="sm" className="flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <h4 className="font-bold text-base tracking-tight text-foreground">{player.name}</h4>
                                <Badge
                                  size="sm"
                                  variant={player.role === 'Captain' ? 'accent' : 'neutral'}
                                >
                                  {player.role}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground-secondary leading-relaxed mt-1.5">{player.bio}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
