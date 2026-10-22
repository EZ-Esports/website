import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasPermission, Permissions } from '@/app/lib/roles';

const mocks = vi.hoisted(() => ({
  staff: null as null | { permissions: bigint; isOwner: boolean },
  getSchoolForRosterView: vi.fn(async (id: string) => ({ id, name: 'Test High' })),
  getSchoolRosterBlocks: vi.fn(async (_id: string) => [] as unknown[]),
}));

// Mirror the real helper: resolve the identity only when it holds the permission.
vi.mock('@/app/lib/auth', () => ({
  getStaffWithPermission: async (permission: bigint) =>
    mocks.staff && hasPermission(mocks.staff.permissions, mocks.staff.isOwner, permission) ? mocks.staff : null,
}));
vi.mock('@/app/lib/db/school-rosters', () => ({
  getSchoolForRosterView: mocks.getSchoolForRosterView,
  getSchoolRosterBlocks: mocks.getSchoolRosterBlocks,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import SchoolRostersPage from '../[schoolId]/rosters/page';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { buildSeasonBlocks } from '@/app/lib/school-roster-view';

const SCHOOL_ID = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const params = (schoolId: string) => ({ params: Promise.resolve({ schoolId }) });

describe('School rosters page permission gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.staff = null;
  });

  it('denies MANAGE_SCHOOLS without MANAGE_ROSTERS before any roster query runs', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_SCHOOLS, isOwner: false };
    const el = await SchoolRostersPage(params(SCHOOL_ID));
    expect(el.type).toBe(PermissionDenied);
    expect(mocks.getSchoolForRosterView).not.toHaveBeenCalled();
    expect(mocks.getSchoolRosterBlocks).not.toHaveBeenCalled();
  });

  it('denies signed-out visitors', async () => {
    const el = await SchoolRostersPage(params(SCHOOL_ID));
    expect(el.type).toBe(PermissionDenied);
    expect(mocks.getSchoolRosterBlocks).not.toHaveBeenCalled();
  });

  it('loads rosters for MANAGE_ROSTERS', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_ROSTERS, isOwner: false };
    const el = await SchoolRostersPage(params(SCHOOL_ID));
    expect(el.type).not.toBe(PermissionDenied);
    expect(mocks.getSchoolRosterBlocks).toHaveBeenCalledWith(SCHOOL_ID);
  });

  it('404s on a malformed school id without touching the database', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_ROSTERS, isOwner: false };
    await expect(SchoolRostersPage(params('not-a-uuid'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getSchoolForRosterView).not.toHaveBeenCalled();
  });
});

describe('SchoolRostersView markup', () => {
  const blocks = buildSeasonBlocks([
    {
      teamId: 'cur', gameId: 'g1', gameSlug: 'valorant', gameName: 'Valorant', seasonId: 's1',
      seasonName: '2025-26', seasonIsActive: true, rostersLockedAt: new Date('2026-02-01T00:00:00Z'),
      rosters: [{ id: 'r1', name: 'Varsity', division: 'A', players: [
        { id: 'p1', name: 'Ada Lovelace', ign: 'ada#1', discord: 'ada', graduationYear: 2027, role: 'captain' },
      ] }],
    },
    {
      teamId: 'old', gameId: 'g1', gameSlug: 'valorant', gameName: 'Valorant', seasonId: 's0',
      seasonName: '2023-24', seasonIsActive: false, rostersLockedAt: null,
      rosters: [{ id: 'r0', name: 'Old Varsity', division: 'A', players: [] }],
    },
  ]);
  const html = renderToStaticMarkup(<SchoolRostersView schoolName="Test High" blocks={blocks} />);

  it('expands the active season, collapses older ones, newest first', () => {
    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('Old Varsity');
    expect(html.indexOf('2025-26')).toBeLessThan(html.indexOf('2023-24'));
  });

  it('shows the lock status and the missing-JV placeholder', () => {
    expect(html).toContain('Rosters locked');
    expect(html).toContain('No JV team this season');
  });

  it('offers the phone-only division picker and has no edit controls', () => {
    expect(html).toContain('Show on this screen');
    expect(html).toContain('max-md:hidden');
    expect(html).not.toMatch(/Remove|Delete|Add player|Enroll/);
  });
});
