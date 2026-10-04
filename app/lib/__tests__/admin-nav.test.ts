import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_CATEGORIES,
  type AdminPageRoute,
  filterAdminNav,
  findActiveAdminNav,
  getAdminBreadcrumb,
  isAdminHrefActive,
  withActiveExpanded,
} from '@/app/lib/admin-nav';
import { ADMIN_SECTION_PERMISSIONS, getAllowedAdminHrefs } from '@/app/lib/staff-access';
import { Permissions } from '@/app/lib/roles';

const ALL_SECTIONS = Object.keys(ADMIN_SECTION_PERMISSIONS);

describe('ADMIN_NAV_CATEGORIES', () => {
  it('lists every gated admin section exactly once', () => {
    const hrefs = ADMIN_NAV_CATEGORIES.flatMap((category) => category.items.map((item) => item.href));
    expect([...hrefs].sort()).toEqual([...ALL_SECTIONS].sort());
  });

  it('groups sections into the three Control Panel categories', () => {
    expect(ADMIN_NAV_CATEGORIES.map((c) => [c.label, c.items.map((i) => i.href)])).toEqual([
      ['People & Staffing', ['/admin/applications', '/admin/careers', '/admin/team', '/admin/leadership']],
      ['League Operations', ['/admin/league', '/admin/matches', '/admin/standings', '/admin/roster', '/admin/schools', '/admin/demographics']],
      ['Website Content', ['/admin/news', '/admin/gallery', '/admin/sponsors', '/admin/content']],
    ]);
  });

});

describe('filterAdminNav', () => {
  it('keeps everything for an owner', () => {
    const filtered = filterAdminNav(getAllowedAdminHrefs(BigInt(0), true));
    expect(filtered).toHaveLength(ADMIN_NAV_CATEGORIES.length);
    expect(filtered.flatMap((c) => c.items)).toHaveLength(ALL_SECTIONS.length);
  });

  it('hides a category whose items are all filtered out', () => {
    const filtered = filterAdminNav(getAllowedAdminHrefs(Permissions.MANAGE_NEWS, false));
    expect(filtered.map((c) => c.id)).toEqual(['content']);
    expect(filtered[0].items.map((i) => i.href)).toEqual(['/admin/news']);
  });


  it('returns no categories when the viewer only has the Overview', () => {
    expect(filterAdminNav(['/admin'])).toEqual([]);
  });

  it('does not mutate the shared category definitions', () => {
    filterAdminNav(['/admin', '/admin/news']);
    expect(ADMIN_NAV_CATEGORIES.flatMap((c) => c.items)).toHaveLength(ALL_SECTIONS.length);
  });
});

describe('isAdminHrefActive', () => {
  it('matches Overview only on /admin itself', () => {
    expect(isAdminHrefActive('/admin', '/admin')).toBe(true);
    expect(isAdminHrefActive('/admin/news', '/admin')).toBe(false);
  });

  it('matches a section and its nested routes but not lookalike prefixes', () => {
    expect(isAdminHrefActive('/admin/news', '/admin/news')).toBe(true);
    expect(isAdminHrefActive('/admin/news/new', '/admin/news')).toBe(true);
    expect(isAdminHrefActive('/admin/newsletter', '/admin/news')).toBe(false);
  });
});

describe('findActiveAdminNav', () => {
  it('finds the category and item for a section route', () => {
    const active = findActiveAdminNav('/admin/standings');
    expect(active?.category.id).toBe('league');
    expect(active?.item.label).toBe('Standings Archive');
  });

  it('finds the parent section for nested routes', () => {
    expect(findActiveAdminNav('/admin/news/123')?.item.href).toBe('/admin/news');
    expect(findActiveAdminNav('/admin/applications/staff/abc/resume')?.category.id).toBe('people');
  });

  it('returns null on the Overview and unknown routes', () => {
    expect(findActiveAdminNav('/admin')).toBeNull();
    expect(findActiveAdminNav('/admin/unknown')).toBeNull();
  });

  it('only matches within the categories it is given', () => {
    const filtered = filterAdminNav(['/admin', '/admin/news']);
    expect(findActiveAdminNav('/admin/team', filtered)).toBeNull();
  });
});

describe('getAdminBreadcrumb', () => {
  it('titles the Overview without a category', () => {
    expect(getAdminBreadcrumb('/admin')).toEqual({ category: null, section: null, title: 'Overview' });
  });

  it('shows Category › Page for a section', () => {
    expect(getAdminBreadcrumb('/admin/team')).toEqual({ category: 'People & Staffing', section: null, title: 'Roles & Staff' });
  });

  it('keeps nested news titles with the parent section in the trail', () => {
    expect(getAdminBreadcrumb('/admin/news/new')).toEqual({
      category: 'Website Content',
      section: { label: 'News & Announcements', href: '/admin/news' },
      title: 'New Article',
    });
    expect(getAdminBreadcrumb('/admin/news/abc-123').title).toBe('Edit Article');
    expect(getAdminBreadcrumb('/admin/news').title).toBe('News & Announcements');
  });

  it('falls back to a generic title on unknown routes', () => {
    expect(getAdminBreadcrumb('/admin/unknown')).toEqual({ category: null, section: null, title: 'Not Found' });
  });
});

describe('withActiveExpanded', () => {
  it('adds the active category and keeps manually opened ones', () => {
    expect(withActiveExpanded(new Set(['people']), 'league')).toEqual(new Set(['people', 'league']));
  });

  it('returns the same Set when the active category is already open', () => {
    const expanded = new Set(['league']);
    expect(withActiveExpanded(expanded, 'league')).toBe(expanded);
  });

  it('returns the same Set when no category is active', () => {
    const expanded = new Set(['content']);
    expect(withActiveExpanded(expanded, null)).toBe(expanded);
  });
});

describe('AdminPageRoute', () => {
  it('accepts sections and nested news pages; the type rejects unknown routes at compile time', () => {
    const routes: AdminPageRoute[] = ['/admin/news', '/admin/news/new', '/admin/news/abc-123'];
    // @ts-expect-error not a gated section or a nested page
    const wrongRoute: AdminPageRoute = '/admin/nope';
    expect(routes).toHaveLength(3);
    expect(wrongRoute).toBe('/admin/nope');
  });
});
