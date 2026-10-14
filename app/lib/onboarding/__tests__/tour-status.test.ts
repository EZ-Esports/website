import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ where: vi.fn() }));

vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: mocks.where }),
    }),
  },
}));

import { hasCompletedPortalTour } from '../manager-auth';

describe('hasCompletedPortalTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('is false when none of the user\'s manager rows is stamped', async () => {
    mocks.where.mockResolvedValue([{ tourCompletedAt: null }, { tourCompletedAt: null }]);
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(false);
  });

  it('is true when any manager row is stamped, so a new school/year row does not replay it', async () => {
    mocks.where.mockResolvedValue([{ tourCompletedAt: null }, { tourCompletedAt: new Date() }]);
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(true);
  });

  it('skips the tour (true) for a staff admin with no manager row, without throwing', async () => {
    mocks.where.mockResolvedValue([]);
    await expect(hasCompletedPortalTour('admin-1')).resolves.toBe(true);
  });

  it('fails safe: a throwing lookup (e.g. missing column) hides the tour instead of breaking the portal', async () => {
    mocks.where.mockRejectedValue(new Error('column "tour_completed_at" does not exist'));
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});
