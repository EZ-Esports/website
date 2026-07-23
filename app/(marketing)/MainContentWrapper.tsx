'use client';

import { usePathname } from 'next/navigation';
import { GAME_SLUGS, getGameRoute } from '@/app/lib/constants';

export default function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHero = pathname === '/' ||
                  pathname === '/about' ||
                  pathname === '/news' ||
                  pathname.startsWith('/news/') ||
                  GAME_SLUGS.some((slug) => pathname === getGameRoute(slug)) ||
                  pathname === '/sponsors' ||
                  pathname === '/privacy';

  return (
    <main id="main-content" tabIndex={-1} className={`flex-grow ${hasHero ? '' : 'pt-[88px]'}`}>
      {children}
    </main>
  );
}
