import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permissions } from '@/app/lib/roles';
import { markContentOverrideReviewed } from '../[schoolId]/rosters/override-actions';

const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const OTHER_SCHOOL = '7c2e4d4f-1111-4a52-8f55-2d5d6c1f9a22';
const OVERRIDE = '3f9a2b1c-2222-4a52-8f55-3d5d6c1f9a33';
const MEMBER = '5a6b7c8d-3333-4a52-8f55-4d5d6c1f9a44';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  memberInSchool: vi.fn(),
  revalidatePath: vi.fn(),
  overrideRows: [] as Array<{ id: string; memberId: string }>,
  updateSet: vi.fn(),
  updateWhere: vi.fn(async () => undefined),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/app/lib/db/roster-scope', () => ({ memberInSchool: mocks.memberInSchool }));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.overrideRows }) }) }),
    update: () => ({
      set: (values: unknown) => {
        mocks.updateSet(values);
        return { where: mocks.updateWhere };
      },
    }),
  },
}));

describe('markContentOverrideReviewed', () => {
  beforeEach(() => {
    mocks.requirePermission.mockReset();
    mocks.memberInSchool.mockReset();
    mocks.updateSet.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.overrideRows = [{ id: OVERRIDE, memberId: MEMBER }];
    mocks.requirePermission.mockResolvedValue({ id: 'staff-1', email: 'staff@ez.test', permissions: 0n, isOwner: false, highestRolePosition: 1 });
    mocks.memberInSchool.mockResolvedValue(true);
  });

  it('refuses a user without MANAGE_ROSTERS, before reading or writing anything', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));

    await expect(markContentOverrideReviewed(SCHOOL, OVERRIDE, 'checked')).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.memberInSchool).not.toHaveBeenCalled();
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('records reviewed_at, the staff user id and a trimmed note', async () => {
    const result = await markContentOverrideReviewed(SCHOOL, OVERRIDE, '  checked with the coach  ');

    expect(result).toEqual({ success: true });
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewedAt: expect.any(Date),
        reviewedBy: 'staff-1',
        reviewNote: 'checked with the coach',
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/schools/${SCHOOL}/rosters`);
  });

  it('stores no note when the note is blank, and caps a long note at 500 characters', async () => {
    await markContentOverrideReviewed(SCHOOL, OVERRIDE, '   ');
    expect(mocks.updateSet).toHaveBeenLastCalledWith(expect.objectContaining({ reviewNote: null }));

    await markContentOverrideReviewed(SCHOOL, OVERRIDE, 'x'.repeat(600));
    const last = mocks.updateSet.mock.calls[mocks.updateSet.mock.calls.length - 1][0] as { reviewNote: string };
    expect(last.reviewNote).toHaveLength(500);
  });

  it('refuses an override whose member belongs to another school, and writes nothing', async () => {
    mocks.memberInSchool.mockResolvedValue(false);

    const result = await markContentOverrideReviewed(OTHER_SCHOOL, OVERRIDE, 'note');

    expect(result).toMatchObject({ success: false });
    expect(mocks.memberInSchool).toHaveBeenCalledWith(MEMBER, OTHER_SCHOOL);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('refuses an unknown override id, and writes nothing', async () => {
    mocks.overrideRows = [];

    const result = await markContentOverrideReviewed(SCHOOL, OVERRIDE, 'note');

    expect(result).toMatchObject({ success: false });
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('rejects a malformed school or override id before touching the database', async () => {
    const result = await markContentOverrideReviewed('not-a-uuid', OVERRIDE, 'note');

    expect(result).toMatchObject({ success: false });
    expect(mocks.memberInSchool).not.toHaveBeenCalled();
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });
});
