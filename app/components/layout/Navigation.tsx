'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ROUTES, GAMES, GAME_SLUGS, getGameRoute, getGameSubRoute, getNavigationState } from '@/app/lib/constants';

export default function Navigation() {
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
      <nav className="flex items-center gap-6">
        {/* Game Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-white hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded flex items-center gap-1"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            {gameConfig.shortName}
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
              <div className="py-1">
                {GAME_SLUGS.map((slug) => {
                  const game = GAMES[slug];
                  const isActive = slug === currentGame;
                  return (
                    <Link
                      key={slug}
                      href={getGameRoute(slug)}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-gray-700 text-rose-300'
                          : 'text-white hover:bg-gray-700 hover:text-rose-300'
                      }`}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <div className="flex items-center gap-2">
                        {isActive && <span className="text-rose-300">●</span>}
                        <span>{game.displayName}</span>
                      </div>
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
              className={`transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded ${
                isActive ? 'text-rose-300' : 'text-white hover:text-rose-300'
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Back to Main */}
        <Link
          href={ROUTES.home}
          className="text-white hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded flex items-center gap-1 ml-auto"
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
    <nav className="flex items-center gap-6">
      {leagueNavItems.map((item) => {
        if (item.isDropdown) {
          return (
            <div key="games" className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="text-white hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded flex items-center gap-1"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                Games
                <svg
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
                  <div className="py-1">
                    {GAME_SLUGS.map((slug) => {
                      const game = GAMES[slug];
                      return (
                        <Link
                          key={slug}
                          href={getGameRoute(slug)}
                          className="block px-4 py-2 text-sm text-white hover:bg-gray-700 hover:text-rose-300 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          {game.displayName}
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
            className={`transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded ${
              isActive ? 'text-rose-300' : 'text-white hover:text-rose-300'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
