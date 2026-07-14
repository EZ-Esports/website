'use client';

import Link from 'next/link';
import { cx } from '@/app/lib/cx';

export interface FilterTab {
  label: string;
  value: string;
  href: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  active: string;
  className?: string;
  /** Accessible name for the tab row's nav landmark, e.g. "Division". */
  ariaLabel?: string;
}

const tabBase = 'px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all cursor-pointer';
const tabActive = 'bg-accent text-on-accent hover:bg-accent/80';
const tabInactive = 'bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40';

// These tabs navigate to new URLs, so plain links with aria-current are the
// correct pattern here (not a RAC Tabs widget, which is for in-page panel
// switching without a URL change).
export default function FilterTabs({ tabs, active, className = '', ariaLabel = 'Filter' }: FilterTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={cx('flex gap-2', className)}>
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            className={cx(tabBase, isActive ? tabActive : tabInactive)}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
