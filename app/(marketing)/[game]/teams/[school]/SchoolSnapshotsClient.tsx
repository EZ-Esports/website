'use client';

import { useMemo, useState } from 'react';
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

export interface SchoolDetailData {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  seasons: SeasonTeamSnapshot[];
}

interface SchoolSnapshotsClientProps {
  school: SchoolDetailData;
  gameDisplayName: string;
}

export default function SchoolSnapshotsClient({ school, gameDisplayName }: SchoolSnapshotsClientProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>('all');

  // Extract available seasons for this school
  const availableSeasons = useMemo(() => {
    return school.seasons.map((s) => s.seasonName);
  }, [school]);

  // Filter season team snapshots
  const filteredSeasons = useMemo(() => {
    if (selectedSeason === 'all') return school.seasons;
    return school.seasons.filter((s) => s.seasonName === selectedSeason);
  }, [school, selectedSeason]);

  // Calculate total players across seasons
  const totalPlayersCount = useMemo(() => {
    return school.seasons.reduce((acc, season) => {
      return acc + season.rosters.reduce((rAcc, roster) => rAcc + roster.players.length, 0);
    }, 0);
  }, [school]);

  return (
    <div className="space-y-8">
      {/* School Header Banner Card */}
      <Card padding="lg" className="border border-line bg-surface-raised/90 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-line/60 pb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-surface-sunken border border-line rounded-full flex items-center justify-center text-accent font-black text-2xl sm:text-3xl shrink-0 shadow-inner">
              {school.schoolName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight line-clamp-2">
                {school.schoolName}
              </h1>
              <p className="text-xs sm:text-sm text-foreground-secondary mt-1">
                Official Season Snapshots & Rosters for {gameDisplayName}
              </p>
            </div>
          </div>

          {school.websiteUrl && (
            <Button
              href={school.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
              className="shrink-0 flex items-center gap-2"
            >
              <span>Visit School Website</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </Button>
          )}
        </div>

        {/* Quick Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs text-foreground-secondary">
          <div className="bg-surface-sunken/60 rounded-xl p-3.5 border border-line/40">
            <span className="block text-foreground-muted">Season Snapshots</span>
            <strong className="text-foreground text-base sm:text-lg font-black">{school.seasons.length}</strong>
          </div>
          <div className="bg-surface-sunken/60 rounded-xl p-3.5 border border-line/40">
            <span className="block text-foreground-muted">Division Squads</span>
            <strong className="text-foreground text-base sm:text-lg font-black">
              {school.seasons.reduce((acc, s) => acc + s.rosters.length, 0)}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-surface-sunken/60 rounded-xl p-3.5 border border-line/40">
            <span className="block text-foreground-muted">Registered Students</span>
            <strong className="text-foreground text-base sm:text-lg font-black">{totalPlayersCount}</strong>
          </div>
        </div>
      </Card>

      {/* Season Filter Selector Tabs */}
      {availableSeasons.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth snap-x touch-manipulation">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted shrink-0 mr-2 hidden sm:inline">
            Filter Season:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSeason('all')}
            className={`px-4 py-2 min-h-[40px] text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 ${
              selectedSeason === 'all'
                ? 'bg-accent text-on-accent border-accent'
                : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40'
            }`}
          >
            All Seasons ({school.seasons.length})
          </button>
          {availableSeasons.map((seasonName) => {
            const seasonObj = school.seasons.find((s) => s.seasonName === seasonName);
            const isActive = selectedSeason === seasonName;
            return (
              <button
                key={seasonName}
                type="button"
                onClick={() => setSelectedSeason(seasonName)}
                className={`px-4 py-2 min-h-[40px] text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                  isActive
                    ? 'bg-accent text-on-accent border-accent'
                    : 'bg-surface-sunken border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40'
                }`}
              >
                {seasonName} {seasonObj?.isSeasonActive ? '(Active)' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Season Team Snapshots List */}
      <div className="space-y-8">
        {filteredSeasons.length === 0 ? (
          <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line">
            No team snapshots registered for this season filter.
          </div>
        ) : (
          filteredSeasons.map((season) => (
            <Card
              key={season.seasonId}
              padding="lg"
              className="space-y-6 border border-line bg-surface-raised/80 p-5 sm:p-8"
            >
              {/* Season Snapshot Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {season.seasonName} Team Snapshot
                  </h2>
                  {season.isSeasonActive && <Badge size="sm" variant="success">Active Season</Badge>}
                </div>
                <span className="text-xs text-foreground-muted">
                  {season.rosters.length} Division Squad{season.rosters.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Division Rosters */}
              <div className="space-y-8">
                {season.rosters.map((roster) => (
                  <div key={roster.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-secondary flex items-center gap-2">
                        <span>{roster.name === 'JV' ? 'Junior Varsity' : roster.name} Division</span>
                      </h3>
                      <Badge size="sm" variant="neutral">Record: {roster.record}</Badge>
                    </div>

                    {roster.players.length === 0 ? (
                      <p className="text-xs text-foreground-muted italic pl-2">
                        No registered players under this division roster.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roster.players.map((player, pIdx) => (
                          <Card
                            key={pIdx}
                            padding="sm"
                            className="flex flex-col justify-between bg-surface-sunken/60 border border-line/60 p-4"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-bold text-base tracking-tight text-foreground line-clamp-1">
                                  {player.name}
                                </h4>
                                <Badge
                                  size="sm"
                                  variant={player.isCaptain || player.role === 'Captain' ? 'accent' : 'neutral'}
                                >
                                  {player.role}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground-secondary leading-relaxed mt-1 line-clamp-3">
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
