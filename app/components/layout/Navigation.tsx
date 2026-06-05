'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ROUTES, GAMES, GAME_SLUGS, getGameRoute, getGameSubRoute, getNavigationState } from '@/app/lib/constants';

interface NavigationProps {
  onNavigate?: () => void;
}

export default function Navigation({ onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const navState = getNavigationState(pathname);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLinkClick = () => {
    setIsDropdownOpen(false);
    onNavigate?.();
  };

  const linkClass = (isActive: boolean) => 
    `transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-1.5 md:py-1 px-3 text-sm md:text-[15px] font-medium tracking-wide ${
      isActive 
        ? 'text-ez-pink bg-ez-pink/5 border-l-2 border-ez-pink md:border-l-0 md:bg-transparent md:px-0' 
        : 'text-slate-300 hover:text-white md:hover:text-ez-pink hover:translate-x-1 md:hover:translate-x-0'
    }`;

  if (navState.state === 'game' && navState.game) {
    // Game-level navigation
    const currentGame = navState.game;
    const gameConfig = GAMES[currentGame];

    const gameNavItems = [
      { label: 'Schedule', href: getGameSubRoute(currentGame, 'schedule'), key: 'schedule' },
      { label: 'Standings', href: getGameSubRoute(currentGame, 'standings'), key: 'standings' },
      { label: 'Teams', href: getGameSubRoute(currentGame, 'teams'), key: 'teams' },
      { label: 'Roster', href: getGameSubRoute(currentGame, 'roster'), key: 'roster' },
    ];

    return (
      <nav className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-6 w-full">
        {/* Game Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-white hover:text-ez-pink transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-1.5 px-3 flex items-center justify-between md:justify-start gap-1 w-full text-left font-bold border border-slate-800/80 md:border-0 bg-slate-950/20 md:bg-transparent cursor-pointer"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <span>{gameConfig.displayName}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full md:w-52 bg-[#0d121f]/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-800/80 z-50 p-1">
              <div className="py-1 space-y-1">
                {GAME_SLUGS.map((slug) => {
                  const game = GAMES[slug];
                  const isActive = slug === currentGame;
                  return (
                    <Link
                      key={slug}
                      href={getGameRoute(slug)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                        isActive
                          ? 'bg-ez-pink/10 text-ez-pink font-bold'
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`}
                      onClick={handleLinkClick}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-ez-pink animate-pulse' : 'bg-transparent'}`} />
                      <span>{game.displayName}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Game-specific nav items */}
        {gameNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={linkClass(isActive)}
              onClick={handleLinkClick}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Back to Main */}
        <Link
          href={ROUTES.home}
          className="text-slate-400 hover:text-white md:hover:text-ez-pink transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-2 px-3 md:px-0 flex items-center gap-1.5 md:ml-auto border border-dashed border-slate-800/80 md:border-0 justify-center mt-3 md:mt-0 font-medium text-sm md:text-[15px]"
          onClick={handleLinkClick}
        >
          <span>←</span>
          <span>Back to Main</span>
        </Link>
      </nav>
    );
  }

  // League-level navigation
  const leagueNavItems = [
    { label: 'About', href: ROUTES.about },
    { label: 'Games', href: '#', isDropdown: true },
    { label: 'News', href: ROUTES.news },
    { label: 'Leadership', href: ROUTES.leadership },
    { label: 'Archives', href: ROUTES.archives },
  ];

  return (
    <nav className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-6 w-full">
      {leagueNavItems.map((item) => {
        if (item.isDropdown) {
          return (
            <div key="games" className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="text-slate-300 hover:text-white md:hover:text-ez-pink transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-1.5 px-3 flex items-center justify-between md:justify-start gap-1 w-full text-left font-medium border border-slate-800/80 md:border-0 bg-slate-950/20 md:bg-transparent cursor-pointer"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <span>Games</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full md:w-52 bg-[#0d121f]/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-800/80 z-50 p-1">
                  <div className="py-1 space-y-1">
                    {GAME_SLUGS.map((slug) => {
                      const game = GAMES[slug];
                      const isActive = pathname.startsWith(getGameRoute(slug));
                      return (
                        <Link
                          key={slug}
                          href={getGameRoute(slug)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                            isActive
                              ? 'bg-ez-pink/10 text-ez-pink font-bold'
                              : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                          }`}
                          onClick={handleLinkClick}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-ez-pink animate-pulse' : 'bg-transparent'}`} />
                          <span>{game.displayName}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        }

        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={linkClass(isActive)}
            onClick={handleLinkClick}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
