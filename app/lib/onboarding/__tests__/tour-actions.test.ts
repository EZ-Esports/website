import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  getSchoolManagerContext: vi.fn(),
  where: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../manager-auth', () => ({ getSchoolManagerContext: mocks.getSchoolManagerContext }));
vi.mock('@/app/lib/db', () => ({ db: { update: mocks.update } }));

import { completePortalTour } from '../tour-actions';
import * as schema from '@/app/lib/db/schema';

describe('completePortalTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.where.mockResolvedValue(undefined);
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
  });

  it('rejects unauthenticated callers without writing', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue(null);
    await expect(completePortalTour()).rejects.toThrow('Unauthorized');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('stamps tour_completed_at on school_managers', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue({ userId: 'user-1' });
    await expect(completePortalTour()).resolves.toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith(schema.schoolManagers);
    const [values] = mocks.set.mock.calls[0];
    expect(Object.keys(values)).toEqual(['tourCompletedAt']);
    expect(values.tourCompletedAt).toBeInstanceOf(Date);
  });

  it('only touches the session user\'s still-unset rows (idempotent, never another manager\'s)', async () => {
    mocks.getSchoolManagerContext.mockResolvedValue({ userId: 'user-1' });
    await completePortalTour();
    const dialect = new PgDialect();
    const { sql, params } = dialect.sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(sql).toContain('"user_id" = $1');
    expect(sql).toContain('"tour_completed_at" is null');
    expect(params).toEqual(['user-1']);
  });
});
