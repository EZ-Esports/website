'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROUTES, GAMES, GAME_SLUGS, getGameRoute } from '@/app/lib/constants';

interface NavigationProps {
  onNavigate?: () => void;
  isDarkText?: boolean;
}

export default function Navigation({ onNavigate, isDarkText = true }: NavigationProps) {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLinkClick = () => {
    setIsDropdownOpen(false);
    onNavigate?.();
  };

  const linkClass = (isActive: boolean) =>
    `transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-2.5 md:py-1 px-3 min-h-[44px] flex items-center text-sm md:text-[15px] font-medium tracking-wide ${
      isActive
        ? 'text-ez-pink bg-ez-pink/5 border-l-2 border-ez-pink md:border-l-0 md:bg-transparent md:px-0'
        : isDarkText
          ? 'text-foreground-secondary hover:text-foreground md:hover:text-ez-pink hover:translate-x-1 md:hover:translate-x-0'
          : 'text-white/80 hover:text-white md:hover:text-ez-pink hover:translate-x-1 md:hover:translate-x-0'
    }`;



  // League-level navigation
  const leagueNavItems = [
    { label: 'About', href: ROUTES.about },
    { label: 'Games', href: '#', isDropdown: true },
    { label: 'News', href: ROUTES.news },
    { label: 'Leadership', href: ROUTES.leadership },
  ];

  return (
    <nav className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-6 w-full">
      {leagueNavItems.map((item) => {
        if (item.isDropdown) {
          return (
            <div key="games" className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-1.5 px-3 flex items-center justify-between md:justify-start gap-1 w-full text-left font-medium border md:border-0 md:bg-transparent cursor-pointer ${
                  isDarkText
                    ? 'text-foreground-secondary hover:text-foreground md:hover:text-ez-pink border-custom-border/80 bg-background-secondary/20'
                    : 'text-white/80 hover:text-white md:hover:text-ez-pink border-white/20 bg-white/10'
                }`}
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

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 mt-2 w-full md:w-52 bg-background-secondary/95 backdrop-blur-md rounded-xl shadow-2xl border border-custom-border/80 z-50 p-1"
                  >
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
                                : 'text-foreground-secondary hover:bg-background-secondary/60 hover:text-foreground'
                            }`}
                            onClick={handleLinkClick}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-ez-pink animate-pulse motion-reduce:animate-none' : 'bg-transparent'}`} />
                            <span>{game.displayName}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
