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

function makeRepo(isActiveSeason: boolean) {
  return {
    findSchoolById: vi.fn(async () => ({ id: 's1', name: 'School', slug: 'school' })),
    findSchoolRosters: vi.fn(async () => []),
    listSchoolInvites: vi.fn(async () => []),
    listPendingSubmissions: vi.fn(async () => []),
    findRosterById: vi.fn(async () => ({ id: 'r1', schoolId: 's1', gameId: 'g1', name: 'Varsity', isActiveSeason })),
    removePlayerFromRoster: vi.fn(async () => undefined),
    updateRosterPlayerRole: vi.fn(async () => undefined),
  };
}

describe('PortalService season scoping (hexagonal path)', () => {
  it('asks the repository for active-season rosters only when the actor is a manager', async () => {
    const repo = makeRepo(true);
    const service = new PortalService(repo as any);
    await service.getSchoolPortalData(baseContext);
    expect(repo.findSchoolRosters).toHaveBeenCalledWith('s1', null, { activeSeasonOnly: true });

    await service.getSchoolPortalData({ ...baseContext, isSuperAdmin: true });
    expect(repo.findSchoolRosters).toHaveBeenLastCalledWith('s1', null, { activeSeasonOnly: false });
  });

  it('refuses mutations on a past-season roster for a manager but not for a super admin', async () => {
    const repo = makeRepo(false);
    const service = new PortalService(repo as any);
    await expect(
      service.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p1' })
    ).rejects.toThrow(/past season/);
    expect(repo.removePlayerFromRoster).not.toHaveBeenCalled();

    await expect(
      service.removePlayerFromRoster({ ...baseContext, isSuperAdmin: true }, { rosterId: 'r1', playerId: 'p1' })
    ).resolves.toEqual({ success: true });
  });
});
