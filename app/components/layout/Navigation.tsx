'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROUTES, GAMES, getGameRoute } from '@/app/lib/constants';

interface NavigationProps {
  onNavigate?: () => void;
}

export default function Navigation({ onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDropdown(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLinkClick = () => {
    setActiveDropdown(null);
    onNavigate?.();
  };

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const isSubItemActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isDropdownActive = (items: { href: string }[]) => {
    return items.some((subItem) => isSubItemActive(subItem.href));
  };

  const getButtonClass = (isActive: boolean) =>
    `transition-all focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded-md py-2.5 md:py-1 px-3 flex items-center justify-between md:justify-start gap-1.5 w-full text-left font-bold uppercase tracking-widest border md:border-0 md:bg-transparent cursor-pointer border-white/15 bg-white/5 text-[11px] md:text-xs min-h-[44px] ${
      isActive
        ? 'text-ez-pink bg-ez-pink/5 md:bg-transparent border-ez-pink/30 md:px-0'
        : 'text-white/80 hover:text-white md:hover:text-ez-pink border-white/15 hover:translate-x-1 md:hover:translate-x-0'
    }`;

  const leagueNavItems = [
    {
      label: 'Students & Fans',
      id: 'students-fans',
      items: [
        { label: GAMES['valorant']?.displayName || 'Valorant', href: getGameRoute('valorant') },
        { label: GAMES['league-of-legends']?.displayName || 'League of Legends', href: getGameRoute('league-of-legends') },
        { label: GAMES['team-fight-tactics']?.displayName || 'Teamfight Tactics', href: getGameRoute('team-fight-tactics') },
        { label: 'League News', href: ROUTES.news },
      ],
    },
    {
      label: 'School Admins & Parents',
      id: 'admins-parents',
      items: [
        { label: 'About the League', href: ROUTES.about },
        { label: 'Leadership Team', href: ROUTES.leadership },
        { label: 'Apply to Join', href: ROUTES.apply },
      ],
    },
    {
      label: 'Sponsors & Partners',
      id: 'sponsors-partners',
      items: [
        { label: 'Sponsorship Tiers', href: ROUTES.sponsors },
        { label: 'About the League', href: ROUTES.about },
      ],
    },
  ];

  return (
    <nav ref={navRef} className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 lg:gap-6 w-full">
      {leagueNavItems.map((item) => {
        const isOpen = activeDropdown === item.id;
        const isActive = isDropdownActive(item.items);

        return (
          <div key={item.id} className="relative">
            <button
              onClick={() => toggleDropdown(item.id)}
              className={getButtonClass(isActive)}
              aria-expanded={isOpen}
              aria-haspopup="true"
            >
              <span>{item.label}</span>
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute top-full left-0 mt-2 w-full md:w-60 bg-background-secondary/95 backdrop-blur-md rounded-xl shadow-2xl border border-custom-border/80 z-50 p-1"
                >
                  <div className="py-1 space-y-1">
                    {item.items.map((subItem) => {
                      const isSubActive = isSubItemActive(subItem.href);
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                            isSubActive
                              ? 'bg-ez-pink/10 text-ez-pink font-bold'
                              : 'text-foreground-secondary hover:bg-background-secondary/60 hover:text-foreground'
                          }`}
                          onClick={handleLinkClick}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-ez-pink animate-pulse motion-reduce:animate-none' : 'bg-transparent'}`} />
                          <span>{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
