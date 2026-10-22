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

function makeRepo(seasonName: string, isSeasonPast = false) {
  return {
    findSchoolById: vi.fn(async () => ({ id: 's1', name: 'School', slug: 'school' })),
    findSchoolRosters: vi.fn(async () => []),
    listSchoolInvites: vi.fn(async () => []),
    listPendingSubmissions: vi.fn(async () => []),
    findRosterById: vi.fn(async () => ({ id: 'r1', schoolId: 's1', gameId: 'g1', name: 'Varsity', seasonName, isSeasonPast })),
    removePlayerFromRoster: vi.fn(async () => undefined),
    updateRosterPlayerRole: vi.fn(async () => undefined),
    emergencySwapSub: vi.fn(async () => undefined),
    enrollPlayerToRoster: vi.fn(async () => ({})),
    findSchoolPlayerPool: vi.fn(async () => []),
    findGameById: vi.fn(async () => ({ id: 'g1', slug: 'valorant', displayName: 'Valorant' })),
    createPlayerInvite: vi.fn(async () => ({ id: 'i1' })),
    findInviteById: vi.fn(async () => ({ id: 'i1', schoolId: 's1', gameId: 'g1', submissionDraft: { ign: 'x' } })),
    revokePlayerInvite: vi.fn(async () => undefined),
    approveInviteAndEnroll: vi.fn(async () => ({ playerId: 'p', memberId: 'm' })),
    isSeasonPastByName: vi.fn(async () => isSeasonPast),
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
  describe('past seasons are view-only (spec-028)', () => {
    const VIEW_ONLY = /2026-27 is a past season and is view-only/;

    it('refuses every roster mutation and invite write for a manager on a past season, with no repository write', async () => {
      const repo = makeRepo('2026-27', true);
      const service = new PortalService(repo as any);
      await expect(service.enrollPlayerToRoster(baseContext, { rosterId: 'r1', memberId: 'm' })).rejects.toThrow(VIEW_ONLY);
      await expect(service.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p' })).rejects.toThrow(VIEW_ONLY);
      await expect(service.updateRosterPlayerRole(baseContext, { rosterId: 'r1', playerId: 'p', role: 'sub' })).rejects.toThrow(VIEW_ONLY);
      await expect(
        service.emergencySwapSub(baseContext, { rosterId: 'r1', currentStarterId: 'a', substitutePlayerId: 'b' })
      ).rejects.toThrow(VIEW_ONLY);
      await expect(
        service.createPlayerInvite(baseContext, { gameId: 'g1', intendedFirstName: 'A', intendedLastName: 'B' })
      ).rejects.toThrow(VIEW_ONLY);
      await expect(service.reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'approved' })).rejects.toThrow(VIEW_ONLY);
      await expect(service.reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'rejected' })).rejects.toThrow(VIEW_ONLY);
      await expect(service.revokePlayerInvite(baseContext, 'i1')).rejects.toThrow(VIEW_ONLY);
      for (const fn of [
        repo.enrollPlayerToRoster, repo.removePlayerFromRoster, repo.updateRosterPlayerRole, repo.emergencySwapSub,
        repo.createPlayerInvite, repo.revokePlayerInvite, repo.approveInviteAndEnroll,
      ]) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it('allows reads and an upcoming (non-past) season, and exempts a super admin', async () => {
      const past = new PortalService(makeRepo('2026-27', true) as any);
      await expect(past.getSchoolPortalData(baseContext)).resolves.toMatchObject({ schoolId: 's1' });
      await expect(past.getSchoolPlayerPool(baseContext)).resolves.toBeDefined();

      const upcoming = new PortalService(makeRepo('2026-27', false) as any);
      await expect(upcoming.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p' })).resolves.toEqual({ success: true });
      await expect(
        upcoming.createPlayerInvite(baseContext, { gameId: 'g1', intendedFirstName: 'A', intendedLastName: 'B' })
      ).resolves.toMatchObject({ success: true });

      const admin = new PortalService(makeRepo('2026-27', true) as any);
      await expect(
        admin.removePlayerFromRoster({ ...baseContext, isSuperAdmin: true }, { rosterId: 'r1', playerId: 'p' })
      ).resolves.toEqual({ success: true });
    });

    it('asks the repository about the manager own season name for season-level writes', async () => {
      const repo = makeRepo('2026-27', false);
      await new PortalService(repo as any).reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'rejected' });
      expect(repo.isSeasonPastByName).toHaveBeenCalledWith('g1', '2026-27');
    });
  });
});
