'use client';

import { usePathname } from 'next/navigation';

export default function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Game hub routes (/[game]) deliberately have no hero: they open on a compact
  // identity row, so they need the solid header and the pt-[88px] offset.
  const hasHero = pathname === '/' ||
                  pathname === '/about' ||
                  pathname === '/news' ||
                  pathname.startsWith('/news/') ||
                  pathname === '/sponsors' ||
                  pathname === '/privacy';

  return (
    <main id="main-content" tabIndex={-1} className={`flex-grow ${hasHero ? '' : 'pt-[88px]'}`}>
      {children}
    </main>
  );
}
