import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPermission, Permissions } from '@/app/lib/roles';

const SEASON = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a01';
const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a02';

const mocks = vi.hoisted(() => ({
  staff: null as null | { permissions: bigint; isOwner: boolean },
  getSeasonSetupData: vi.fn(),
  getSchoolRosterBlocks: vi.fn(),
  getRosterEditOptions: vi.fn(async () => ({ members: [], games: [], seasons: [] })),
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
import { buildSeasonBlocks } from '@/app/lib/school-roster-view';

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
    expect(mocks.getSchoolRosterBlocks).toHaveBeenCalledWith(SCHOOL);
    expect(mocks.getRosterEditOptions).toHaveBeenCalledWith(SCHOOL);
  });
});
