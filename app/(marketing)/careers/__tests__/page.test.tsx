import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CareersPage from '../page';

// Mock DB queries
vi.mock('@/app/lib/db/queries', () => ({
  getPublishedCareerPostings: vi.fn(),
}));

import { getPublishedCareerPostings } from '@/app/lib/db/queries';

describe('CareersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders hero, culture perks, and open application card', async () => {
    vi.mocked(getPublishedCareerPostings).mockResolvedValueOnce([]);

    const jsx = await CareersPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Careers &amp; Opportunities');
    expect(html).toContain('Real-World Experience');
    expect(html).toContain('Volunteer Credit &amp; Recommendations');
    expect(html).toContain('Submit Open Application');
    expect(html).toContain('Don&#x27;t see your specific role?');
  });

  it('renders postings when available', async () => {
    vi.mocked(getPublishedCareerPostings).mockResolvedValueOnce([
      {
        id: 'pos-1',
        title: 'Lead Software Engineer',
        slug: 'lead-software-engineer',
        department: 'Software Engineering',
        location: 'Remote',
        commitment: '5–10 hours / week',
        employmentType: 'Volunteer',
        summary: 'Build high-impact web apps for high school esports.',
        status: 'published',
        displayOrder: 0,
        createdAt: new Date(),
      },
    ]);

    const jsx = await CareersPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Lead Software Engineer');
    expect(html).toContain('Software Engineering');
    expect(html).toContain('Build high-impact web apps for high school esports.');
    expect(html).toContain('href="/careers/lead-software-engineer"');
  });
});
