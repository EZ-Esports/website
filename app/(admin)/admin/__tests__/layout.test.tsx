import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/app/lib/auth', () => {
  class StaffSetupError extends Error {}
  return {
    getStaff: vi.fn(),
    isPortalOnlyManager: vi.fn(),
    StaffSetupError,
  };
});

vi.mock('../AdminShell', () => ({ default: () => null }));
vi.mock('@/app/components/admin/StaffSetupProblem', () => ({ default: () => null }));

import { getStaff, isPortalOnlyManager } from '@/app/lib/auth';
import AdminLayout from '../layout';

describe('AdminLayout access gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a signed-in school manager without a staff row to /portal', async () => {
    vi.mocked(getStaff).mockResolvedValue(null);
    vi.mocked(isPortalOnlyManager).mockResolvedValue(true);

    await expect(AdminLayout({ children: null })).rejects.toThrow('REDIRECT:/portal');
  });

  it('sends an unauthenticated visitor to /login', async () => {
    vi.mocked(getStaff).mockResolvedValue(null);
    vi.mocked(isPortalOnlyManager).mockResolvedValue(false);

    await expect(AdminLayout({ children: null })).rejects.toThrow('REDIRECT:/login');
  });
});
