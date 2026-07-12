'use client';

import Link from 'next/link';
import { cx } from '@/app/lib/cx';

export interface FilterTab {
  label: string;
  value: string;
  href?: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  active: string;
  onChange?: (value: string) => void;
  className?: string;
}

const tabBase = 'px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all cursor-pointer';
const tabActive = 'bg-accent text-on-accent hover:bg-accent/80';
const tabInactive = 'bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40';

export default function FilterTabs({ tabs, active, onChange, className = '' }: FilterTabsProps) {
  return (
    <div className={cx('flex gap-2', className)}>
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        const tabClassName = cx(tabBase, isActive ? tabActive : tabInactive);

        if (tab.href) {
          return (
            <Link key={tab.value} href={tab.href} className={tabClassName} aria-current={isActive ? 'true' : undefined}>
              {tab.label}
            </Link>
          );
        }

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange?.(tab.value)}
            aria-current={isActive ? 'true' : undefined}
            className={tabClassName}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
