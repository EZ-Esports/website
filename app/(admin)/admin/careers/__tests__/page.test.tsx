import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CareersAdminPage from '../page';

// Mock auth module
vi.mock('@/app/lib/auth', () => ({
  getStaffForAdminSection: vi.fn(),
}));

// Mock DB queries
vi.mock('@/app/lib/db/queries', () => ({
  getAllCareerPostingsAdmin: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { getStaffForAdminSection } from '@/app/lib/auth';
import { getAllCareerPostingsAdmin } from '@/app/lib/db/queries';

describe('CareersAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PermissionDenied when staff lacks access', async () => {
    vi.mocked(getStaffForAdminSection).mockResolvedValueOnce(null);

    const jsx = await CareersAdminPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Permission required');
  });

  it('renders career management dashboard when authorized', async () => {
    vi.mocked(getStaffForAdminSection).mockResolvedValueOnce({
      id: 'staff-1',
      email: 'admin@ezesports.org',
      permissions: BigInt(0xffffffff),
      isOwner: true,
      highestRolePosition: 1,
    });

    vi.mocked(getAllCareerPostingsAdmin).mockResolvedValueOnce([
      {
        id: 'post-1',
        title: 'Lead Software Engineer',
        slug: 'lead-software-engineer',
        department: 'Software Engineering',
        location: 'Remote',
        commitment: '5h',
        employmentType: 'Volunteer',
        summary: 'Summary',
        description: 'Desc',
        status: 'published',
        displayOrder: 0,
        applicantCount: 3,
        pendingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const jsx = await CareersAdminPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Career openings');
    expect(html).toContain('Lead Software Engineer');
    expect(html).toContain('Software Engineering');
    expect(html).toContain('New opening');
    expect(html).toContain('/admin/applications?posting=post-1');
  });
});
