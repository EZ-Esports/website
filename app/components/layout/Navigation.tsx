'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MenuTrigger, Menu, MenuItem, Popover, Button as AriaButton } from 'react-aria-components';
import { ROUTES, GAMES, getGameRoute } from '@/app/lib/constants';

interface NavigationProps {
  onNavigate?: () => void;
}

export default function Navigation({ onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleLinkClick = () => {
    setActiveDropdown(null);
    onNavigate?.();
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
    `transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md py-2.5 md:py-1 px-3 flex items-center justify-between md:justify-start gap-1.5 w-full text-left font-black uppercase tracking-widest md:bg-transparent cursor-pointer bg-white/5 text-xs md:text-[13px] min-h-[44px] ${
      isActive
        ? 'text-accent bg-accent/5 md:bg-transparent'
        : 'text-foreground/80 hover:text-foreground md:hover:text-accent'
    }`;

  const leagueNavItems = [
    {
      label: 'Competition',
      id: 'competition',
      items: [
        { label: GAMES['valorant']?.displayName || 'Valorant', href: getGameRoute('valorant') },
        { label: GAMES['team-fight-tactics']?.displayName || 'Teamfight Tactics', href: getGameRoute('team-fight-tactics') },
        { label: GAMES['league-of-legends']?.displayName || 'League of Legends', href: getGameRoute('league-of-legends') },
        { label: 'Past Seasons', href: ROUTES.archives },
      ],
    },
    {
      label: 'About',
      id: 'about',
      items: [
        { label: 'About the League', href: ROUTES.about },
        { label: 'Leadership Team', href: ROUTES.leadership },
        { label: 'League News', href: ROUTES.news },
      ],
    },
    {
      label: 'Get Involved',
      id: 'get-involved',
      items: [
        { label: 'Apply to Play', href: ROUTES.apply },
        { label: 'Sponsorship Tiers', href: ROUTES.sponsors },
      ],
    },
  ];

  return (
    <nav className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 lg:gap-6 w-full">
      {leagueNavItems.map((item) => {
        const isOpen = activeDropdown === item.id;
        const isActive = isDropdownActive(item.items);

        return (
          <div key={item.id} className="relative">
            <MenuTrigger
              isOpen={isOpen}
              onOpenChange={(open) => setActiveDropdown(open ? item.id : null)}
            >
              <AriaButton className={getButtonClass(isActive)}>
                <span>{item.label}</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </AriaButton>

              <Popover
                placement="bottom start"
                offset={8}
                className="w-[calc(100vw-2rem)] md:w-60 bg-surface-raised/95 backdrop-blur-md rounded-xl shadow-2xl border border-line/80 z-50 p-1 outline-none animate-fade-in"
              >
                <Menu className="outline-none py-1 space-y-1">
                  {item.items.map((subItem) => {
                    const isSubActive = isSubItemActive(subItem.href);
                    return (
                      <MenuItem
                        key={subItem.href}
                        href={subItem.href}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-lg transition-all outline-none cursor-pointer ${
                          isSubActive
                            ? 'bg-accent/10 text-accent font-extrabold'
                            : 'text-foreground-secondary hover:bg-surface-raised/60 hover:text-foreground focus:bg-surface-raised/60 focus:text-foreground'
                        }`}
                        onAction={handleLinkClick}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-accent animate-pulse motion-reduce:animate-none' : 'bg-transparent'}`} />
                        <span>{subItem.label}</span>
                      </MenuItem>
                    );
                  })}
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
        );
      })}
    </nav>
  );
}
