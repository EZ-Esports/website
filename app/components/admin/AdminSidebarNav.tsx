'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Button as AriaButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
} from 'react-aria-components';
import type { Key } from 'react-aria-components';
import { HiChevronDown } from 'react-icons/hi2';
import { cx } from '@/app/lib/cx';
import {
  ADMIN_OVERVIEW_NAV,
  findActiveAdminNav,
  isAdminHrefActive,
  withActiveExpanded,
  type AdminNavCategory,
} from '@/app/lib/admin-nav';

interface AdminSidebarNavProps {
  pathname: string;
  /** Already filtered to the viewer's permissions (`filterAdminNav`). */
  categories: AdminNavCategory[];
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-panel';

/**
 * Active marker for a nav link: a short accent bar inset at the left edge
 * that grows in (scale-y) when the link becomes current, instead of a full
 * border. Calmer than a coloured row, still unmistakable.
 */
const activeBar =
  "relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-accent before:origin-center before:transition-transform before:duration-300 before:ease-out motion-reduce:before:transition-none";

function linkTone(isActive: boolean): string {
  return isActive
    ? 'bg-surface-raised text-foreground font-medium before:scale-y-100'
    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-raised/60 before:scale-y-0';
}

/**
 * Control-Panel-style sidebar: Overview on its own, then one disclosure per
 * category. Several categories may be open at once. The category holding the
 * current route opens itself whenever the route changes, and its header keeps
 * an accent marker so the location stays visible after a manual collapse.
 */
export default function AdminSidebarNav({ pathname, categories }: AdminSidebarNavProps) {
  const activeCategoryId = findActiveAdminNav(pathname, categories)?.category.id ?? null;

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    () => new Set(activeCategoryId ? [activeCategoryId] : []),
  );
  // Re-open the active category on navigation by adjusting state during render
  // (React's recommended alternative to a syncing effect). Keyed on pathname so
  // moving between two pages of a collapsed category also re-opens it.
  const [syncedPathname, setSyncedPathname] = useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    const next = withActiveExpanded<Key>(expandedKeys, activeCategoryId);
    if (next !== expandedKeys) setExpandedKeys(next);
  }

  const overviewActive = isAdminHrefActive(pathname, ADMIN_OVERVIEW_NAV.href);
  const OverviewIcon = ADMIN_OVERVIEW_NAV.icon;

  return (
    <nav
      aria-label="Staff portal"
      className="admin-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 px-3 space-y-1"
    >
      <Link
        href={ADMIN_OVERVIEW_NAV.href}
        aria-current={overviewActive ? 'page' : undefined}
        className={cx(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 transition-colors duration-150 group cursor-pointer',
          activeBar,
          focusRing,
          linkTone(overviewActive),
        )}
      >
        <OverviewIcon
          aria-hidden
          className={cx('w-5 h-5 shrink-0 transition-colors duration-150', overviewActive ? 'text-accent' : 'group-hover:text-foreground')}
        />
        <span className="text-sm">{ADMIN_OVERVIEW_NAV.label}</span>
      </Link>

      <DisclosureGroup
        allowsMultipleExpanded
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
        className="space-y-1"
      >
        {categories.map((category) => {
          const CategoryIcon = category.icon;
          const containsActive = category.id === activeCategoryId;
          return (
            <Disclosure key={category.id} id={category.id}>
              {({ isExpanded }) => (
                <>
                  <AriaButton
                    slot="trigger"
                    className={({ isFocusVisible }) =>
                      cx(
                        'flex w-full min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-150 cursor-pointer outline-none',
                        containsActive ? 'text-foreground' : 'text-foreground-secondary hover:text-foreground',
                        'hover:bg-surface-raised/60',
                        isFocusVisible && 'ring-2 ring-accent/60 ring-offset-2 ring-offset-admin-panel',
                      )
                    }
                  >
                    {/* The active marker sits on the icon's corner rather than in the
                        row, so long labels like "League Operations" stay on one line. */}
                    <span className="relative shrink-0">
                      <CategoryIcon aria-hidden className={cx('w-5 h-5', containsActive ? 'text-accent' : 'text-foreground-secondary')} />
                      {containsActive && (
                        <span aria-hidden className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-admin-panel" />
                      )}
                    </span>
                    <span className="flex-1 whitespace-nowrap">{category.label}</span>
                    {containsActive && <span className="sr-only">(contains the current page)</span>}
                    <HiChevronDown
                      aria-hidden
                      className={cx(
                        'w-4 h-4 shrink-0 transition-[rotate,color] duration-300 ease-out motion-reduce:transition-none',
                        isExpanded ? 'rotate-180 text-accent' : 'text-foreground-muted',
                      )}
                    />
                  </AriaButton>
                  {/* RAC sets --disclosure-panel-height to the measured height while
                      opening/closing, so the panel slides open instead of popping. */}
                  <DisclosurePanel className="h-(--disclosure-panel-height) overflow-clip transition-[height] duration-300 ease-out motion-reduce:transition-none">
                    <ul className="relative mt-0.5 space-y-0.5 pl-3">
                      {/* Guide rail that draws down alongside the opening panel; it sits in the
                          gutter left of the items so it never crosses the active-item highlight. */}
                      <span
                        aria-hidden
                        className={cx(
                          'pointer-events-none absolute left-[5px] top-1 bottom-1 w-px origin-top bg-gradient-to-b from-accent/50 to-line transition-transform duration-500 ease-out motion-reduce:transition-none',
                          isExpanded ? 'scale-y-100' : 'scale-y-0',
                        )}
                      />
                      {category.items.map((item, index) => {
                        const isActive = isAdminHrefActive(pathname, item.href);
                        const ItemIcon = item.icon;
                        return (
                          <li
                            key={item.href}
                            // Items cascade in one after another on open and leave together on close.
                            style={{ transitionDelay: isExpanded ? `${60 + index * 45}ms` : '0ms' }}
                            className={cx(
                              'transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none',
                              isExpanded ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0',
                            )}
                          >
                            <Link
                              href={item.href}
                              aria-current={isActive ? 'page' : undefined}
                              className={cx(
                                'flex min-h-9 items-center gap-2.5 rounded-lg pl-3 pr-2 transition-colors duration-150 group cursor-pointer',
                                activeBar,
                                focusRing,
                                linkTone(isActive),
                              )}
                            >
                              <ItemIcon
                                aria-hidden
                                className={cx('w-4 h-4 shrink-0 transition-colors duration-150', isActive ? 'text-accent' : 'group-hover:text-foreground')}
                              />
                              <span className="text-sm">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>
          );
        })}
      </DisclosureGroup>
    </nav>
  );
}
