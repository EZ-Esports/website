import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSchoolManagerContext: vi.fn(),
  onConflictDoNothing: vi.fn(),
  values: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../manager-auth', () => ({ getSchoolManagerContext: mocks.getSchoolManagerContext }));
vi.mock('@/app/lib/db', () => ({ db: { insert: mocks.insert } }));

import { completePortalTour } from '../tour-actions';
import * as schema from '@/app/lib/db/schema';

describe('completePortalTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.values.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
    mocks.insert.mockReturnValue({ values: mocks.values });
  });

  it('rejects unauthenticated callers without writing', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue(null);
    await expect(completePortalTour()).rejects.toThrow('Unauthorized');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('records dismissal against the session account, never a client-supplied id', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue({ userId: 'user-1' });
    await expect(completePortalTour()).resolves.toEqual({ success: true });
    expect(mocks.insert).toHaveBeenCalledWith(schema.managerPortalTours);
    expect(mocks.values).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('is idempotent via ON CONFLICT DO NOTHING so the first completion time is kept', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue({ userId: 'user-1' });
    await completePortalTour();
    expect(mocks.onConflictDoNothing).toHaveBeenCalledWith({
      target: schema.managerPortalTours.userId,
    });
  });
});
