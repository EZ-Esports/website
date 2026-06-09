'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GAMES, getGameFromPath, getGameSubRoute, getGameRoute } from '@/app/lib/constants';

export default function GameSubHeader() {
  const pathname = usePathname();
  const gameSlug = getGameFromPath(pathname);

  if (!gameSlug) return null;

  const gameConfig = GAMES[gameSlug];

  const navItems = [
    { label: 'Overview', href: getGameRoute(gameSlug) },
    { label: 'Schedule', href: getGameSubRoute(gameSlug, 'schedule') },
    { label: 'Standings', href: getGameSubRoute(gameSlug, 'standings') },
    { label: 'Teams & Rosters', href: getGameSubRoute(gameSlug, 'teams') },
  ];

  return (
    <div className="border-t border-custom-border/60 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-12 overflow-x-auto no-scrollbar">
          {/* Active game label */}
          <div className="flex items-center gap-2 pr-4 shrink-0 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-ez-pink" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground-secondary">
              {gameConfig.shortName} Hub
            </span>
          </div>

          {/* Sub nav links */}
          <div className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all select-none cursor-pointer ${
                    isActive
                      ? 'bg-ez-pink text-ez-black shadow-sm'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-background-secondary/50'
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
