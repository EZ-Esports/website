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

function makeRepo(locked: boolean) {
  return {
    findRosterById: vi.fn(async () => ({
      id: 'r1', schoolId: 's1', gameId: 'g1', name: 'Varsity', isActiveSeason: true, isSeasonLocked: locked,
    })),
    findInviteById: vi.fn(async () => ({
      id: 'i1', schoolId: 's1', gameId: 'g1', submissionDraft: { ign: 'x' },
    })),
    isActiveSeasonLocked: vi.fn(async () => locked),
    enrollPlayerToRoster: vi.fn(async () => ({})),
    removePlayerFromRoster: vi.fn(async () => undefined),
    updateRosterPlayerRole: vi.fn(async () => undefined),
    emergencySwapSub: vi.fn(async () => undefined),
    approveInviteAndEnroll: vi.fn(async () => ({ playerId: 'p', memberId: 'm' })),
    revokePlayerInvite: vi.fn(async () => undefined),
  };
}

describe('PortalService season roster lock (hexagonal path)', () => {
  it('refuses every roster mutation and invite approval for a manager while locked', async () => {
    const repo = makeRepo(true);
    const service = new PortalService(repo as any);
    const locked = /locked by EZ Esports staff/;
    await expect(service.enrollPlayerToRoster(baseContext, { rosterId: 'r1', memberId: 'm' })).rejects.toThrow(locked);
    await expect(service.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p' })).rejects.toThrow(locked);
    await expect(service.updateRosterPlayerRole(baseContext, { rosterId: 'r1', playerId: 'p', role: 'sub' })).rejects.toThrow(locked);
    await expect(
      service.emergencySwapSub(baseContext, { rosterId: 'r1', currentStarterId: 'a', substitutePlayerId: 'b' })
    ).rejects.toThrow(locked);
    await expect(service.reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'approved' })).rejects.toThrow(locked);
    await expect(
      service.reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'approved', targetRosterId: 'r1' })
    ).rejects.toThrow(locked);
    expect(repo.enrollPlayerToRoster).not.toHaveBeenCalled();
    expect(repo.removePlayerFromRoster).not.toHaveBeenCalled();
    expect(repo.approveInviteAndEnroll).not.toHaveBeenCalled();
  });

  it('allows the same calls when unlocked, and for a super admin while locked', async () => {
    const unlocked = new PortalService(makeRepo(false) as any);
    await expect(unlocked.removePlayerFromRoster(baseContext, { rosterId: 'r1', playerId: 'p' })).resolves.toEqual({ success: true });
    await expect(unlocked.reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'approved' })).resolves.toMatchObject({ success: true });

    const admin = new PortalService(makeRepo(true) as any);
    const adminCtx = { ...baseContext, isSuperAdmin: true };
    await expect(admin.removePlayerFromRoster(adminCtx, { rosterId: 'r1', playerId: 'p' })).resolves.toEqual({ success: true });
    await expect(admin.reviewPlayerInvite(adminCtx, { inviteId: 'i1', decision: 'approved' })).resolves.toMatchObject({ success: true });
  });

  it('still lets a manager reject while locked', async () => {
    const repo = makeRepo(true);
    await expect(
      new PortalService(repo as any).reviewPlayerInvite(baseContext, { inviteId: 'i1', decision: 'rejected' })
    ).resolves.toEqual({ success: true });
  });
});
