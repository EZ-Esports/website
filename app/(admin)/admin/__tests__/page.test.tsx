import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Permissions } from '@/app/lib/roles';

vi.mock('@/app/lib/auth', () => ({
  getStaff: vi.fn(),
}));

vi.mock('@/app/lib/db/queries', () => ({
  countPendingResults: vi.fn().mockResolvedValue(0),
  countPublishedNews: vi.fn().mockResolvedValue(0),
  countScheduledMatches: vi.fn().mockResolvedValue(0),
  countTeamsWithoutRoster: vi.fn().mockResolvedValue(0),
  getCachedGames: vi.fn().mockResolvedValue([]),
  getCachedTeams: vi.fn().mockResolvedValue([]),
}));

import { getStaff } from '@/app/lib/auth';
import AdminDashboardPage from '../page';

function staffWith(permissions: bigint, isOwner = false) {
  return {
    id: 'staff-1',
    email: 'staff@example.com',
    permissions,
    isOwner,
    highestRolePosition: 1,
  };
}

async function renderOverview() {
  const jsx = await AdminDashboardPage();
  return renderToStaticMarkup(jsx ?? <></>);
}

describe('AdminDashboardPage control panel', () => {
  beforeEach(() => {
    vi.mocked(getStaff).mockReset();
  });

  it('shows only the permitted category and sections', async () => {
    vi.mocked(getStaff).mockResolvedValue(staffWith(Permissions.MANAGE_NEWS));
    const html = await renderOverview();

    expect(html).toContain('Control Panel');
    expect(html).toContain('Website Content');
    expect(html).toContain('News &amp; Announcements');

    expect(html).not.toContain('People &amp; Staffing');
    expect(html).not.toContain('League Operations');
    expect(html).not.toContain('href="/admin/team"');
    expect(html).not.toContain('href="/admin/applications');
    expect(html).not.toContain('href="/admin/matches"');
    expect(html).not.toContain('href="/admin/gallery"');
  });

  it('shows every category and section for an owner', async () => {
    vi.mocked(getStaff).mockResolvedValue(staffWith(BigInt(0), true));
    const html = await renderOverview();

    for (const label of ['People &amp; Staffing', 'League Operations', 'Website Content']) {
      expect(html).toContain(label);
    }
    for (const href of ['/admin/applications', '/admin/team', '/admin/matches', '/admin/schools', '/admin/content']) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it('keeps the awaiting-role state and renders no control panel without permissions', async () => {
    vi.mocked(getStaff).mockResolvedValue(staffWith(BigInt(0)));
    const html = await renderOverview();

    expect(html).toContain('Awaiting role assignment');
    expect(html).not.toContain('Control Panel');
  });
});
