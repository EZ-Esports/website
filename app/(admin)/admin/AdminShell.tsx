'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from './actions';
import SessionWarning from '@/app/components/admin/SessionWarning';
import AdminSidebarNav from '@/app/components/admin/AdminSidebarNav';
import { filterAdminNav, getAdminBreadcrumb } from '@/app/lib/admin-nav';
import { cx } from '@/app/lib/cx';
import { HiOutlineGlobeAlt, HiArrowRightOnRectangle, HiChevronRight } from 'react-icons/hi2';

interface AdminShellProps {
  children: React.ReactNode;
  allowedHrefs: string[];
}

/** Focus ring for controls on the sidebar's panel surface. */
const sidebarFocus =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-panel';

/** Quiet footer row (Public site, Sign out): same height and rhythm as a nav row. */
const footerRow = cx(
  'group flex w-full min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-raised transition-colors duration-150 cursor-pointer',
  sidebarFocus,
);

const crumbLink = cx(
  'rounded text-sm text-foreground-secondary hover:text-foreground transition-colors duration-150',
  'outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
);

export default function AdminShell({ children, allowedHrefs }: AdminShellProps) {
  const pathname = usePathname();

  // Same category tree as the Overview hub, filtered to what this viewer may open.
  const categories = filterAdminNav(allowedHrefs);
  const breadcrumb = getAdminBreadcrumb(pathname);

  // Staggered lists animate on first mount only. A browser restarts a CSS
  // animation whenever a node is moved (React reorders keyed children with
  // insertBefore), which would blink reordered gallery cards or roles back to
  // opacity 0. Once a child's entrance finishes it is marked data-entered, and
  // `.admin-stagger > :not([data-entered])` stops matching it. One listener on
  // the persistent shell covers every page; new rows still animate in.
  useEffect(() => {
    const settle = (event: AnimationEvent) => {
      if (event.animationName !== 'admin-rise') return;
      const el = event.target;
      if (el instanceof HTMLElement && el.parentElement?.classList.contains('admin-stagger')) {
        el.setAttribute('data-entered', '');
      }
    };
    document.addEventListener('animationend', settle);
    // On a full page load the first rows can finish before this listener
    // attaches, so settle anything that is no longer animating. This waits
    // until every entrance (the longest ends ~490ms in) and hydration are done:
    // adding data-entered while React is still hydrating the page makes it log
    // a hydration mismatch for every row.
    const settleTimer = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.admin-stagger > :not([data-entered])').forEach((el) => {
        const animating = el.getAnimations().some((a) => a.playState === 'running' || a.pending);
        if (!animating) el.setAttribute('data-entered', '');
      });
    }, 700);
    return () => {
      window.clearTimeout(settleTimer);
      document.removeEventListener('animationend', settle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface flex text-foreground font-sans">
      {/* Left Sidebar: pinned to the viewport (spec-001); only the nav scrolls. */}
      <aside className="w-64 bg-admin-panel border-r border-line/60 flex flex-col shrink-0 z-20 sticky top-0 h-dvh self-start">
        {/* Sidebar Header: same 56px height as the top bar so their bottom edges line up. */}
        <div className="h-14 px-5 flex items-center border-b border-line/60">
          <Link
            href="/admin"
            className={cx('rounded-md text-lg tracking-tight flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity', sidebarFocus)}
          >
            <span className="text-accent font-extrabold">EZ</span>
            <span className="text-foreground font-semibold">Staff</span>
          </Link>
        </div>

        {/* Sidebar navigation: Overview plus collapsible categories. Scrolls on its own
            only when every category is open on a short viewport; the footer stays pinned. */}
        <AdminSidebarNav pathname={pathname} categories={categories} />

        {/* Pinned footer: leave-the-portal actions, separated from the nav by one hairline. */}
        <div className="border-t border-line/60 p-3 space-y-0.5">
          <Link href="/" className={footerRow}>
            <HiOutlineGlobeAlt aria-hidden className="w-5 h-5 shrink-0" />
            <span>Public site</span>
          </Link>
          <form action={logout}>
            <button type="submit" className={footerRow}>
              <HiArrowRightOnRectangle
                aria-hidden
                className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: sticky so the breadcrumb stays visible on long pages. Sticky
            toolbars inside pages sit just below it (`top-14`). */}
        <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-line/60 bg-surface flex items-center px-8">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2">
              <li className="flex shrink-0 items-center">
                <Link href="/admin" className={crumbLink}>
                  Staff Portal
                </Link>
              </li>
              {breadcrumb.category && (
                <BreadcrumbStep>
                  <span className="whitespace-nowrap text-sm text-foreground-secondary">{breadcrumb.category}</span>
                </BreadcrumbStep>
              )}
              {breadcrumb.section && (
                <BreadcrumbStep>
                  <Link href={breadcrumb.section.href} className={crumbLink}>
                    {breadcrumb.section.label}
                  </Link>
                </BreadcrumbStep>
              )}
              <BreadcrumbStep>
                {/* Each page renders its own h1 in its page header (spec-013), so the
                    current crumb is plain text rather than a second heading. */}
                <span aria-current="page" className="truncate text-sm font-medium text-foreground">
                  {breadcrumb.title}
                </span>
              </BreadcrumbStep>
            </ol>
          </nav>
        </header>

        {/* Main content. Not a scroll container: the document scrolls, which is
            what lets the top bar and page toolbars be position: sticky. */}
        <main className="flex-1 px-8 pt-8 pb-16">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <SessionWarning />
    </div>
  );
}

/** One trail segment after the root, preceded by a "›" separator like an address bar. */
function BreadcrumbStep({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <HiChevronRight aria-hidden className="w-3.5 h-3.5 shrink-0 text-foreground-muted" />
      {children}
    </li>
  );
}
