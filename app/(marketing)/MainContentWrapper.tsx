'use client';

import { usePathname } from 'next/navigation';
import { hasHeroRoute } from '@/app/lib/constants';

export default function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHero = hasHeroRoute(pathname);

  return (
    <main id="main-content" tabIndex={-1} className={`flex-grow ${hasHero ? '' : 'pt-[88px]'}`}>
      {children}
    </main>
  );
}
