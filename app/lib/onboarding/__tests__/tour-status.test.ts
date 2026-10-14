import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));

vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.limit }) }),
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

  it('is false when the account has no row', async () => {
    mocks.limit.mockResolvedValue([]);
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(false);
  });

  it('is true when the account has a row', async () => {
    mocks.limit.mockResolvedValue([{ userId: 'u1' }]);
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(true);
  });

  it('fails safe: a throwing lookup hides the tour instead of breaking the portal', async () => {
    mocks.limit.mockRejectedValue(new Error('relation "manager_portal_tours" does not exist'));
    await expect(hasCompletedPortalTour('u1')).resolves.toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});
