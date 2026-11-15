import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permissions } from '@/app/lib/roles';

const mocks = vi.hoisted(() => {
  const repo = {
    findManagerById: vi.fn(),
    updateActiveSchoolManagerAccess: vi.fn(),
    writeStaffAuditLog: vi.fn(),
  };
  return {
    repo,
    requirePermission: vi.fn(),
    updateTag: vi.fn(),
    revalidatePath: vi.fn(),
    games: [{ slug: 'valorant' }, { slug: 'league-of-legends' }] as Array<{ slug: string }>,
  };
});

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));
vi.mock('@/app/lib/db', () => ({ db: { select: () => ({ from: async () => mocks.games }) } }));
vi.mock('@/app/lib/onboarding/adapters/db/drizzle-onboarding-repository', () => ({
  DrizzleOnboardingRepository: class {
    findManagerById = mocks.repo.findManagerById;
    updateActiveSchoolManagerAccess = mocks.repo.updateActiveSchoolManagerAccess;
    writeStaffAuditLog = mocks.repo.writeStaffAuditLog;
  },
}));
vi.mock('@/app/lib/onboarding/student-id-sweep', () => ({ sweepOrphanStudentIds: vi.fn() }));

import { updateSchoolManagerAccess } from '@/app/(admin)/admin/schools/manager-actions';

const existing = {
  id: 'm1',
  schoolId: 's1',
  userId: 'u1',
  memberId: 'mem1',
  academicYear: '2026-27',
  managedGames: null as string[] | null,
  isPrimaryContact: false,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ id: 'staff1', email: 'staff@example.com' });
  mocks.repo.findManagerById.mockResolvedValue(existing);
  mocks.repo.updateActiveSchoolManagerAccess.mockImplementation(async (p) => ({ ...existing, ...p }));
});

describe('updateSchoolManagerAccess', () => {
  it('requires MANAGE_SCHOOLS and changes nothing when denied', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(updateSchoolManagerAccess({ managerId: 'm1', managedGames: null, isPrimaryContact: false })).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_SCHOOLS);
    expect(mocks.repo.updateActiveSchoolManagerAccess).not.toHaveBeenCalled();
  });

  it('scopes a manager to specific games, keeps their identity, audits and refreshes caches', async () => {
    const res = await updateSchoolManagerAccess({ managerId: 'm1', managedGames: ['valorant', 'valorant'], isPrimaryContact: true });
    expect(res.success).toBe(true);
    expect(mocks.repo.updateActiveSchoolManagerAccess).toHaveBeenCalledWith('m1', {
      managedGames: ['valorant'],
      isPrimaryContact: true,
    });
    expect(mocks.repo.writeStaffAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'update_school_manager_access', userId: 'staff1' }),
    );
    expect(mocks.updateTag).toHaveBeenCalledWith('schools');
    expect(mocks.updateTag).toHaveBeenCalledWith('teams');
  });

  it('null means all games', async () => {
    mocks.repo.findManagerById.mockResolvedValue({ ...existing, managedGames: ['valorant'] });
    await updateSchoolManagerAccess({ managerId: 'm1', managedGames: null, isPrimaryContact: false });
    expect(mocks.repo.updateActiveSchoolManagerAccess).toHaveBeenCalledWith('m1', expect.objectContaining({ managedGames: null }));
  });

  it('a removal that lands between the check and the write is not undone', async () => {
    // The pre-check still sees an active manager; the conditional write finds none.
    mocks.repo.updateActiveSchoolManagerAccess.mockResolvedValue(null);
    const res = await updateSchoolManagerAccess({ managerId: 'm1', managedGames: null, isPrimaryContact: false });
    expect(res).toMatchObject({ success: false });
    expect(mocks.repo.writeStaffAuditLog).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('rejects an empty selection and unknown games before writing', async () => {
    expect(await updateSchoolManagerAccess({ managerId: 'm1', managedGames: [], isPrimaryContact: false })).toMatchObject({ success: false });
    expect(await updateSchoolManagerAccess({ managerId: 'm1', managedGames: ['nope'], isPrimaryContact: false })).toEqual({ success: false, error: 'Unknown game.' });
    expect(mocks.repo.updateActiveSchoolManagerAccess).not.toHaveBeenCalled();
  });

  it('refuses a removed manager so the upsert cannot reactivate them', async () => {
    mocks.repo.findManagerById.mockResolvedValue({ ...existing, isActive: false });
    const res = await updateSchoolManagerAccess({ managerId: 'm1', managedGames: null, isPrimaryContact: false });
    expect(res.success).toBe(false);
    expect(mocks.repo.updateActiveSchoolManagerAccess).not.toHaveBeenCalled();
  });

  it('reports an unknown manager', async () => {
    mocks.repo.findManagerById.mockResolvedValue(null);
    expect(await updateSchoolManagerAccess({ managerId: 'x', managedGames: null, isPrimaryContact: false })).toMatchObject({ success: false, error: 'School manager not found.' });
  });
});
