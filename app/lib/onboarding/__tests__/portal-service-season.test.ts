import { describe, it, expect, vi } from 'vitest';
import { PortalService } from '../core/services/portal-service';
import type { SchoolManagerContext } from '../core/domain/types';

const baseContext: SchoolManagerContext = {
  userId: 'u1',
  email: 'coach@school.edu',
  isSuperAdmin: false,
  schoolId: 's1',
  schoolName: 'School',
  schoolSlug: 'school',
  managedGames: null,
  academicYear: '2026-27',
  isPrimaryContact: true,
};

function makeRepo(seasonName: string) {
  return {
    findSchoolById: vi.fn(async () => ({ id: 's1', name: 'School', slug: 'school' })),
    findSchoolRosters: vi.fn(async () => []),
    listSchoolInvites: vi.fn(async () => []),
    listPendingSubmissions: vi.fn(async () => []),
    findRosterById: vi.fn(async () => ({ id: 'r1', schoolId: 's1', gameId: 'g1', name: 'Varsity', seasonName })),
    removePlayerFromRoster: vi.fn(async () => undefined),
    updateRosterPlayerRole: vi.fn(async () => undefined),
  };
}

describe('PortalService season scoping by name (hexagonal path, spec-026)', () => {
  it('asks the repository for the rosters of the manager season name, unrestricted for a super admin', async () => {
    const repo = makeRepo('2026-27');
    const service = new PortalService(repo as any);
    await service.getSchoolPortalData(baseContext);
    expect(repo.findSchoolRosters).toHaveBeenCalledWith('s1', null, { seasonName: '2026-27' });

    await service.getSchoolPortalData({ ...baseContext, isSuperAdmin: true });
    expect(repo.findSchoolRosters).toHaveBeenLastCalledWith('s1', null, { seasonName: undefined });
  });

  it('allows mutations on a roster whose season name matches, even when that season is not active', async () => {
    // The repository reports only the name; whether the season is active is irrelevant.
    const repo = makeRepo('2026-27');
    const service = new PortalService(repo as any);
    await expect(
      service.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p1' })
    ).resolves.toEqual({ success: true });
  });

  it('refuses mutations on a roster of another season for a manager but not for a super admin', async () => {
    const repo = makeRepo('2025-26');
    const service = new PortalService(repo as any);
    await expect(
      service.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p1' })
    ).rejects.toThrow(/different season/);
    expect(repo.removePlayerFromRoster).not.toHaveBeenCalled();

    await expect(
      service.removePlayerFromRoster({ ...baseContext, isSuperAdmin: true }, { rosterId: 'r1', playerId: 'p1' })
    ).resolves.toEqual({ success: true });
  });
});
