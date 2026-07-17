'use client';

import { usePathname } from 'next/navigation';

export default function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHero = pathname === '/' ||
                  pathname === '/about' ||
                  pathname === '/news' ||
                  pathname.startsWith('/news/') ||
                  pathname === '/valorant' ||
                  pathname === '/league-of-legends' ||
                  pathname === '/team-fight-tactics' ||
                  pathname === '/sponsors' ||
                  pathname === '/privacy';

  return (
    <main id="main-content" tabIndex={-1} className={`flex-grow ${hasHero ? '' : 'pt-[88px]'}`}>
      {children}
    </main>
  );
}
