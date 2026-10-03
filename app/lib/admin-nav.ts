import type { IconType } from 'react-icons';
import {
  HiOutlineAcademicCap,
  HiOutlineBriefcase,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClipboardDocument,
  HiOutlineCog6Tooth,
  HiOutlineComputerDesktop,
  HiOutlineCurrencyDollar,
  HiOutlineFingerPrint,
  HiOutlineIdentification,
  HiOutlineNewspaper,
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTrophy,
  HiOutlineUserGroup,
  HiOutlineUsers,
} from 'react-icons/hi2';
import type { AdminSectionHref } from '@/app/lib/staff-access';

/**
 * Staff portal information architecture, shared by the sidebar (`AdminShell`)
 * and the Overview hub (`/admin`). Modeled on the Windows Control Panel
 * "Category" view: a handful of categories, each listing its pages. Keep it the single source of truth so the two surfaces can
 * never disagree about where a page lives.
 *
 * Client-safe on purpose: `AdminShell` is a client component, so this module
 * imports only types from `staff-access` and must stay free of server-only
 * code.
 */

export const ADMIN_OVERVIEW_HREF = '/admin';

export interface AdminNavItem {
  label: string;
  /** Every item is a gated section, so its permission comes from `ADMIN_SECTION_PERMISSIONS`. */
  href: AdminSectionHref;
  icon: IconType;
  description: string;
}

export interface AdminNavCategory {
  id: string;
  label: string;
  icon: IconType;
  description: string;
  items: AdminNavItem[];
}

export const ADMIN_OVERVIEW_NAV = {
  label: 'Overview',
  href: ADMIN_OVERVIEW_HREF,
  icon: HiOutlineSquares2X2,
} as const;

export const ADMIN_NAV_CATEGORIES: readonly AdminNavCategory[] = [
  {
    id: 'people',
    label: 'People & Staffing',
    icon: HiOutlineUserGroup,
    description: 'Review applicants, manage staff access, and keep the leadership roster current.',
    items: [
      {
        label: 'Applications',
        href: '/admin/applications',
        icon: HiOutlineClipboardDocument,
        description: 'School interest forms and staff applications.',
      },
      {
        label: 'Careers',
        href: '/admin/careers',
        icon: HiOutlineBriefcase,
        description: 'Open staff roles on the public careers page and their applicants.',
      },
      {
        label: 'Roles & Staff',
        href: '/admin/team',
        icon: HiOutlineShieldCheck,
        description: 'Staff invites, roles, and permissions.',
      },
      {
        label: 'Leadership Manager',
        href: '/admin/leadership',
        icon: HiOutlineIdentification,
        description: 'Profiles and yearly terms on the leadership page.',
      },
    ],
  },
  {
    id: 'league',
    label: 'League Operations',
    icon: HiOutlineTrophy,
    description: 'Set up seasons, run the match schedule, and manage teams and schools.',
    items: [
      {
        label: 'League Setup',
        href: '/admin/league',
        icon: HiOutlineCog6Tooth,
        description: 'Games and seasons everything else depends on.',
      },
      {
        label: 'Matches & Standings',
        href: '/admin/matches',
        icon: HiOutlineCalendarDays,
        description: 'Schedule fixtures and enter results.',
      },
      {
        label: 'Standings Archive',
        href: '/admin/standings',
        icon: HiOutlineChartBar,
        description: 'Snapshotted standings for past seasons.',
      },
      {
        label: 'Teams & Rosters',
        href: '/admin/roster',
        icon: HiOutlineUsers,
        description: 'Teams, rosters, and players by school.',
      },
      {
        label: 'Schools',
        href: '/admin/schools',
        icon: HiOutlineAcademicCap,
        description: 'Member schools and their crests.',
      },
      {
        label: 'Student Demographics',
        href: '/admin/demographics',
        icon: HiOutlineFingerPrint,
        description: 'Restricted equity and survey data for enrolled students.',
      },
    ],
  },
  {
    id: 'content',
    label: 'Website Content',
    icon: HiOutlineComputerDesktop,
    description: 'Publish news and update what visitors see across the public site.',
    items: [
      {
        label: 'News & Announcements',
        href: '/admin/news',
        icon: HiOutlineNewspaper,
        description: 'Draft, publish, and archive articles.',
      },
      {
        label: 'Gallery',
        href: '/admin/gallery',
        icon: HiOutlinePhoto,
        description: 'Photos for the homepage gallery.',
      },
      {
        label: 'Sponsors',
        href: '/admin/sponsors',
        icon: HiOutlineCurrencyDollar,
        description: 'Sponsor logos, links, and tiers.',
      },
      {
        label: 'Page Content',
        href: '/admin/content',
        icon: HiOutlinePencilSquare,
        description: 'Editable copy blocks on public pages.',
      },
    ],
  },
];

/**
 * Keeps only what the viewer may open: items are filtered by
 * `allowedHrefs` (from `getAllowedAdminHrefs`), and a category left with no
 * items is dropped entirely rather than shown as an empty heading.
 */
export function filterAdminNav(
  allowedHrefs: readonly string[],
  categories: readonly AdminNavCategory[] = ADMIN_NAV_CATEGORIES,
): AdminNavCategory[] {
  const allowed = new Set(allowedHrefs);
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => allowed.has(item.href)),
    }))
    .filter((category) => category.items.length > 0);
}

/** Overview matches only itself; a section matches itself and anything nested below it. */
export function isAdminHrefActive(pathname: string, href: string): boolean {
  if (href === ADMIN_OVERVIEW_HREF) return pathname === ADMIN_OVERVIEW_HREF;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface ActiveAdminNav {
  category: AdminNavCategory;
  item: AdminNavItem;
}

/** The most specific item whose route contains `pathname`, with its category. */
export function findActiveAdminNav(
  pathname: string,
  categories: readonly AdminNavCategory[] = ADMIN_NAV_CATEGORIES,
): ActiveAdminNav | null {
  let best: ActiveAdminNav | null = null;
  for (const category of categories) {
    for (const item of category.items) {
      if (!isAdminHrefActive(pathname, item.href)) continue;
      if (!best || item.href.length > best.item.href.length) best = { category, item };
    }
  }
  return best;
}

/** Pages below a section that get their own title instead of the section's. */
const NESTED_PAGE_TITLES: ReadonlyArray<{ matches: (pathname: string) => boolean; title: string }> = [
  { matches: (pathname) => pathname === '/admin/news/new', title: 'New Article' },
  { matches: (pathname) => pathname.startsWith('/admin/news/'), title: 'Edit Article' },
];

/**
 * The sidebar's open categories after a navigation: the user's manual choices
 * are kept and the active category is added. Returns the same Set when nothing
 * changes so the caller can skip a state update.
 */
export function withActiveExpanded<K>(expanded: Set<K>, activeId: K | null): Set<K> {
  if (activeId === null || expanded.has(activeId)) return expanded;
  return new Set([...expanded, activeId]);
}

export interface AdminBreadcrumb {
  /** Category label, e.g. "Website Content"; null on Overview or unknown routes. */
  category: string | null;
  /** The parent section, present only on a nested page (e.g. New Article under News). */
  section: { label: string; href: string } | null;
  /** The page title shown in the top bar. */
  title: string;
}

/**
 * Top-bar trail in the spirit of the Control Panel address bar
 * ("Category › Page"). Resolved against the full nav, not the viewer's
 * filtered copy, so a page the viewer cannot use still names itself above its
 * permission-denied notice.
 */
export function getAdminBreadcrumb(
  pathname: string,
  categories: readonly AdminNavCategory[] = ADMIN_NAV_CATEGORIES,
): AdminBreadcrumb {
  if (pathname === ADMIN_OVERVIEW_HREF) {
    return { category: null, section: null, title: ADMIN_OVERVIEW_NAV.label };
  }

  const active = findActiveAdminNav(pathname, categories);
  if (!active) return { category: null, section: null, title: 'Not Found' };

  const nested = NESTED_PAGE_TITLES.find((entry) => entry.matches(pathname));
  if (nested && pathname !== active.item.href) {
    return {
      category: active.category.label,
      section: { label: active.item.label, href: active.item.href },
      title: nested.title,
    };
  }

  return { category: active.category.label, section: null, title: active.item.label };
}
