'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GAMES,
  getGameFromPath,
  getGameSubRoute,
  getGameRoute,
  isGameOverviewPath,
} from '@/app/lib/constants';

export default function GameSubHeader() {
  const pathname = usePathname();
  const gameSlug = getGameFromPath(pathname);

  if (!gameSlug) return null;

  const gameConfig = GAMES[gameSlug];

  const teamsRoute = getGameSubRoute(gameSlug, 'teams');
  const isTeamsActive = pathname === teamsRoute || pathname.startsWith(`${teamsRoute}/`);

  const isTournament = gameConfig.competitionModel === 'tournament';
  const competitionRoute = isTournament
    ? getGameSubRoute(gameSlug, 'bracket')
    : getGameSubRoute(gameSlug, 'schedule');
  const competitionLabel = isTournament ? 'Bracket' : 'Schedule';
  const teamsLabel = isTournament ? 'Participants & Rosters' : 'Teams & Rosters';

  // Overview owns three paths, not one: the bare game URL redirects to a
  // division route, so an exact-path check would leave the tab unhighlighted
  // on every page it actually links to.
  const navItems = [
    {
      label: 'Overview',
      href: getGameRoute(gameSlug),
      isActive: isGameOverviewPath(pathname, gameSlug),
    },
    { label: competitionLabel, href: competitionRoute },
    { label: 'Standings', href: getGameSubRoute(gameSlug, 'standings') },
    {
      label: teamsLabel,
      href: teamsRoute,
      isActive: isTeamsActive,
    },
  ];

  return (
    <div className="border-t border-line/60 bg-surface/90 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 h-12 overflow-x-auto no-scrollbar justify-start">
          {/* Active game label */}
          <div className="flex items-center gap-2 pr-4 shrink-0 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground-secondary">
              {gameConfig.shortName} Hub
            </span>
          </div>

          {/* Sub nav links */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {navItems.map((item) => {
              const isActive = item.isActive ?? pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3.5 min-h-[44px] flex items-center rounded-lg text-xs font-bold uppercase tracking-wider transition-all select-none cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-accent text-on-accent shadow-sm'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-surface-raised/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
