import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPermission, Permissions } from '@/app/lib/roles';

const SEASON = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a01';
const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a02';

const mocks = vi.hoisted(() => ({
  staff: null as null | { permissions: bigint; isOwner: boolean },
  getSeasonSetupData: vi.fn(),
  getSchoolRosterBlocks: vi.fn(),
  getRosterEditOptions: vi.fn(async (..._args: unknown[]) => ({ members: [], games: [], seasons: [] })),
}));

vi.mock('@/app/lib/auth', () => ({
  // Mirror the real helper: League Setup's section permission.
  getStaffForAdminSection: async () =>
    mocks.staff && hasPermission(mocks.staff.permissions, mocks.staff.isOwner, Permissions.MANAGE_LEAGUE) ? mocks.staff : null,
}));
vi.mock('@/app/lib/db/season-setup', () => ({ getSeasonSetupData: mocks.getSeasonSetupData }));
vi.mock('@/app/lib/db/school-rosters', () => ({
  getSchoolRosterBlocks: mocks.getSchoolRosterBlocks,
  getRosterEditOptions: mocks.getRosterEditOptions,
}));
vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/actions', () => ({
  createPlayer: vi.fn(), createRoster: vi.fn(), createTeam: vi.fn(),
  deleteRoster: vi.fn(), deleteRosterMember: vi.fn(), updatePlayer: vi.fn(), updateRoster: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import SeasonSchoolPage from '../[seasonId]/schools/[schoolId]/page';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { buildSeasonBlocks } from '@/app/lib/school-roster-view';

/** Depth-first search of a React element tree for the first element of `type`. */
function findByType(node: unknown, type: unknown): { props: any } | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByType(child, type);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (el.type === type) return el as { props: any };
  return findByType(el.props?.children, type);
}

const params = (seasonId = SEASON, schoolId = SCHOOL) => ({ params: Promise.resolve({ seasonId, schoolId }) });

const setupData = {
  season: {
    id: SEASON, name: '2026-27', isActive: true, standingsFormat: 'divided', rostersLockedAt: null,
    outcomesFinalizedAt: null, gameId: 'g1', gameName: 'Valorant', gameSlug: 'valorant',
  },
  schools: [{
    schoolId: SCHOOL, schoolName: 'Stuyvesant', logoUrl: null, teamId: 't1', missing: ['JV'],
    rosters: [{ id: 'r1', name: 'Varsity', division: 'Varsity', players: [{ id: 'p1', name: 'Ada Lovelace', role: 'captain' }] }],
  }],
  availableSchools: [],
};
const blocks = buildSeasonBlocks([{
  teamId: 't1', gameId: 'g1', gameSlug: 'valorant', gameName: 'Valorant', seasonId: SEASON, seasonName: '2026-27',
  seasonIsActive: true, rostersLockedAt: null,
  rosters: [{ id: 'r1', name: 'Varsity', division: 'A', players: [] }],
}]);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://test';
  mocks.staff = null;
  mocks.getSeasonSetupData.mockResolvedValue(setupData);
  mocks.getSchoolRosterBlocks.mockResolvedValue(blocks);
});

describe('season school page', () => {
  it('denies staff without the League permission before any query', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_ROSTERS, isOwner: false };
    const el = await SeasonSchoolPage(params());
    expect(el.type).toBe(PermissionDenied);
    expect(mocks.getSeasonSetupData).not.toHaveBeenCalled();
  });

  it('404s on malformed ids without touching the database', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_LEAGUE, isOwner: false };
    await expect(SeasonSchoolPage(params('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(SeasonSchoolPage(params(SEASON, 'nope'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getSeasonSetupData).not.toHaveBeenCalled();
  });

  it('404s when the school is not in the season, and never loads roster data for it', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_LEAGUE | Permissions.MANAGE_ROSTERS, isOwner: false };
    mocks.getSeasonSetupData.mockResolvedValue({ ...setupData, schools: [] });
    await expect(SeasonSchoolPage(params())).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getSchoolRosterBlocks).not.toHaveBeenCalled();
  });

  it('loads the full roster data only for staff who also hold MANAGE_ROSTERS', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_LEAGUE, isOwner: false };
    await SeasonSchoolPage(params());
    expect(mocks.getSchoolRosterBlocks).not.toHaveBeenCalled();
    expect(mocks.getRosterEditOptions).not.toHaveBeenCalled();

    mocks.staff = { permissions: Permissions.MANAGE_LEAGUE | Permissions.MANAGE_ROSTERS, isOwner: false };
    await SeasonSchoolPage(params());
    // Both the roster blocks and the editor options are read for this season only.
    expect(mocks.getSchoolRosterBlocks).toHaveBeenCalledWith(SCHOOL, { seasonId: SEASON });
    expect(mocks.getRosterEditOptions).toHaveBeenCalledWith(SCHOOL, { seasonId: SEASON });
  });

  it('passes the client view only this season\'s block and season-scoped editor options, even if the loader returned other games', async () => {
    mocks.staff = { permissions: Permissions.MANAGE_LEAGUE | Permissions.MANAGE_ROSTERS, isOwner: false };
    const otherGame = buildSeasonBlocks([{
      teamId: 't9', gameId: 'g2', gameSlug: 'league-of-legends', gameName: 'League of Legends', seasonId: 'other-season',
      seasonName: '2026-27', seasonIsActive: true, rostersLockedAt: null,
      rosters: [{ id: 'r9', name: 'LoL Varsity', division: 'A', players: [
        { id: 'p9', memberId: 'm9', firstName: 'Zed', lastName: 'Other', name: 'Zed Other', ign: null, discord: null, graduationYear: null, role: 'player' },
      ] }],
    }]);
    mocks.getSchoolRosterBlocks.mockResolvedValue([...blocks, ...otherGame]);
    const scopedOptions = {
      members: [{ id: 'm1', firstName: 'Ada', lastName: 'Lovelace', discord: null, graduationYear: null }],
      games: [{ id: 'g1', slug: 'valorant', name: 'Valorant' }],
      seasons: [{ id: SEASON, gameId: 'g1', name: '2026-27', isActive: true }],
    };
    mocks.getRosterEditOptions.mockResolvedValue(scopedOptions as never);

    const el = await SeasonSchoolPage({ ...params(), searchParams: Promise.resolve({ game: 'league-of-legends' }) } as never);
    const view = findByType(el, SchoolRostersView);
    expect(view).toBeTruthy();
    expect(view!.props.scope).toBe('season');
    expect(view!.props.blocks).toHaveLength(1);
    expect(view!.props.blocks[0].gameSlug).toBe('valorant');
    // The editor options are exactly what the season-scoped loader returned (one game, one season).
    expect(view!.props.options).toEqual(scopedOptions);
    expect(view!.props.initialFilters.game).toBe('');
    expect(JSON.stringify(view!.props)).not.toMatch(/league-of-legends|Zed Other/);
  });
});
