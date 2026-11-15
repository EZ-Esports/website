import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOrphanUploads: vi.fn(),
  deleteUploadRows: vi.fn(),
  removeStudentIds: vi.fn(),
}));

vi.mock('@/app/lib/db/student-ids', () => ({
  findOrphanUploads: mocks.findOrphanUploads,
  deleteUploadRows: mocks.deleteUploadRows,
}));
vi.mock('../student-id-storage', () => ({ removeStudentIds: mocks.removeStudentIds }));

const { sweepOrphanStudentIds } = await import('../student-id-sweep');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.removeStudentIds.mockResolvedValue(true);
});

describe('sweepOrphanStudentIds', () => {
  it('removes the objects first and the rows second', async () => {
    mocks.findOrphanUploads.mockResolvedValue([{ id: 'r1', storageKey: 'a.jpg' }, { id: 'r2', storageKey: 'b.png' }]);
    const order: string[] = [];
    mocks.removeStudentIds.mockImplementation(async () => { order.push('objects'); return true; });
    mocks.deleteUploadRows.mockImplementation(async () => { order.push('rows'); });
    expect(await sweepOrphanStudentIds()).toBe(2);
    expect(order).toEqual(['objects', 'rows']);
    expect(mocks.removeStudentIds).toHaveBeenCalledWith(['a.jpg', 'b.png']);
    expect(mocks.deleteUploadRows).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('keeps the rows (the only pointers to the objects) when Storage refuses, so the next sweep retries', async () => {
    mocks.findOrphanUploads.mockResolvedValue([{ id: 'r1', storageKey: 'a.jpg' }]);
    mocks.removeStudentIds.mockResolvedValue(false);
    expect(await sweepOrphanStudentIds()).toBe(0);
    expect(mocks.deleteUploadRows).not.toHaveBeenCalled();
  });

  it('does nothing when there is nothing to sweep', async () => {
    mocks.findOrphanUploads.mockResolvedValue([]);
    expect(await sweepOrphanStudentIds()).toBe(0);
    expect(mocks.removeStudentIds).not.toHaveBeenCalled();
  });

  it('never throws, and logs the failure', async () => {
    mocks.findOrphanUploads.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(sweepOrphanStudentIds()).resolves.toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
