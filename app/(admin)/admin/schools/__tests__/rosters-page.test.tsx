import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasPermission, Permissions } from '@/app/lib/roles';

const mocks = vi.hoisted(() => ({
  staff: null as null | { permissions: bigint; isOwner: boolean },
  getSchoolForRosterView: vi.fn(async (id: string) => ({ id, name: 'Test High' })),
  getSchoolRosterBlocks: vi.fn(async (_id: string) => [] as unknown[]),
  getRosterEditOptions: vi.fn(async (_id: string) => ({ members: [], games: [], seasons: [] })),
}));
vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/actions', () => ({
  createPlayer: vi.fn(), createRoster: vi.fn(), createTeam: vi.fn(),
  deleteRoster: vi.fn(), deleteRosterMember: vi.fn(), updatePlayer: vi.fn(), updateRoster: vi.fn(),
}));

// Mirror the real helper: resolve the identity only when it holds the permission.
vi.mock('@/app/lib/auth', () => ({
  getStaffWithPermission: async (permission: bigint) =>
    mocks.staff && hasPermission(mocks.staff.permissions, mocks.staff.isOwner, permission) ? mocks.staff : null,
}));
vi.mock('@/app/lib/db/school-rosters', () => ({
  getSchoolForRosterView: mocks.getSchoolForRosterView,
  getSchoolRosterBlocks: mocks.getSchoolRosterBlocks,
  getRosterEditOptions: mocks.getRosterEditOptions,
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
const NO_OPTIONS = { members: [], games: [], seasons: [] };
const DEFAULT_FILTERS = { game: '', division: 'both' as const, phone: 'Varsity' as const };
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
    expect(mocks.getRosterEditOptions).not.toHaveBeenCalled();
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

  it('validates URL filters server-side: valid ones are restored, unknown ones ignored', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_ROSTERS, isOwner: false };
    mocks.getSchoolRosterBlocks.mockResolvedValueOnce(
      buildSeasonBlocks([{
        teamId: 't', gameId: 'g', gameSlug: 'minecraft', gameName: 'Minecraft', seasonId: 's',
        seasonName: '2025-26', seasonIsActive: true, rostersLockedAt: null, rosters: [],
      }]),
    );
    const el = await SchoolRostersPage({
      ...params(SCHOOL_ID),
      searchParams: Promise.resolve({ game: 'minecraft', division: 'jv', phone: 'bogus' }),
    });
    const section = (el.props.children as unknown[])[1] as { props: { children: { props: { initialFilters: unknown } } } };
    expect(section.props.children.props.initialFilters).toEqual({ game: 'minecraft', division: 'JV', phone: 'Varsity' });
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
        { id: 'p1', memberId: 'm1', firstName: 'Ada', lastName: 'Lovelace', name: 'Ada Lovelace', ign: 'ada#1', discord: 'ada', graduationYear: 2027, role: 'captain' },
      ] }],
    },
    {
      teamId: 'old', gameId: 'g1', gameSlug: 'valorant', gameName: 'Valorant', seasonId: 's0',
      seasonName: '2023-24', seasonIsActive: false, rostersLockedAt: null,
      rosters: [{ id: 'r0', name: 'Old Varsity', division: 'A', players: [] }],
    },
  ]);
  const html = renderToStaticMarkup(<SchoolRostersView schoolId={SCHOOL_ID} schoolName="Test High" blocks={blocks} options={NO_OPTIONS} initialFilters={DEFAULT_FILTERS} />);

  it('expands the active season, collapses older ones, newest first', () => {
    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('Old Varsity');
    expect(html.indexOf('2025-26')).toBeLessThan(html.indexOf('2023-24'));
  });

  it('shows the lock status and the missing-JV placeholder', () => {
    expect(html).toContain('Rosters locked');
    expect(html).toContain('No JV team this season');
  });

  it('offers the phone-only division picker', () => {
    expect(html).toContain('Show on this screen');
    expect(html).toContain('max-md:hidden');
  });

  it('shows staff edit controls even on a locked season', () => {
    expect(html).toContain('Add player');
    expect(html).toContain('Edit roster Varsity');
    expect(html).toContain('Delete roster Varsity');
    expect(html).toContain('Remove player Ada Lovelace');
    expect(html).toContain('Register team');
    expect(html).toContain('Staff edits here still go through');
    expect(html).not.toMatch(/read-only/i);
  });

  it('renders a no-JV game with a Varsity column and a "No JV for this season" placeholder', () => {
    const mc = buildSeasonBlocks([{
      teamId: 'mc', gameId: 'g2', gameSlug: 'minecraft', gameName: 'Minecraft', seasonId: 's2',
      seasonName: '2025-26', seasonIsActive: true, rostersLockedAt: null,
      rosters: [{ id: 'm', name: 'Main', division: 'All', players: [] }],
    }]);
    const out = renderToStaticMarkup(
      <SchoolRostersView schoolId={SCHOOL_ID} schoolName="Test High" blocks={mc} options={NO_OPTIONS} initialFilters={DEFAULT_FILTERS} />,
    );
    expect(out).toContain('No JV for this season');
    expect(out).toContain('Main');
    expect(out).not.toContain('No JV team this season');
    expect(out).not.toContain('has no JV division');
  });

  it('hides the JV "Add roster" button for a no-JV game even when it has a legacy JV roster', () => {
    const render = (gameSlug: string, gameName: string, rosters: { id: string; name: string; division: string; players: [] }[]) =>
      renderToStaticMarkup(
        <SchoolRostersView
          schoolId={SCHOOL_ID}
          schoolName="Test High"
          blocks={buildSeasonBlocks([{
            teamId: 't', gameId: 'g', gameSlug, gameName, seasonId: 's', seasonName: '2025-26',
            seasonIsActive: true, rostersLockedAt: null, rosters,
          }])}
          options={NO_OPTIONS}
          initialFilters={DEFAULT_FILTERS}
        />,
      );
    const count = (s: string) => s.split('Add roster').length - 1;
    const legacy = render('minecraft', 'Minecraft', [
      { id: 'a', name: 'Main', division: 'A', players: [] },
      { id: 'b', name: 'Old JV', division: 'B', players: [] },
    ]);
    expect(legacy).toContain('Old JV');
    expect(count(legacy)).toBe(1); // Varsity only
    // A game with a JV split keeps both buttons.
    const split = render('valorant', 'Valorant', [
      { id: 'a', name: 'Varsity', division: 'A', players: [] },
      { id: 'b', name: 'JV', division: 'B', players: [] },
    ]);
    expect(count(split)).toBe(2);
  });
});
