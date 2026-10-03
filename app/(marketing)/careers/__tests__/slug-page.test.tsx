import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CareerDetailPage, { generateMetadata } from '../[slug]/page';

// Mock DB queries
vi.mock('@/app/lib/db/queries', () => ({
  getPublishedCareerPostingBySlug: vi.fn(),
}));

import { getPublishedCareerPostingBySlug } from '@/app/lib/db/queries';

describe('CareerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders role overview, details, and pre-scoped application form', async () => {
    vi.mocked(getPublishedCareerPostingBySlug).mockResolvedValueOnce({
      id: 'pos-1',
      title: 'Broadcast Observer',
      slug: 'broadcast-observer',
      department: 'Productions & Broadcast',
      location: 'Remote (NYC High School League)',
      commitment: '3–5 hours / week',
      employmentType: 'Volunteer / High School Internship',
      summary: 'Operate in-game camera directing for live Valorant streams.',
      description: '### Responsibilities\n- Direct in-game cameras\n- Coordinate with shoutcasters',
      status: 'published',
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const jsx = await CareerDetailPage({ params: Promise.resolve({ slug: 'broadcast-observer' }) });
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Broadcast Observer');
    expect(html).toContain('Productions &amp; Broadcast');
    expect(html).toContain('Operate in-game camera directing for live Valorant streams.');
    expect(html).toContain('Responsibilities');
    expect(html).toContain('Direct in-game cameras');
    expect(html).toContain('Apply for Broadcast Observer');
  });

  it('generates metadata correctly', async () => {
    vi.mocked(getPublishedCareerPostingBySlug).mockResolvedValueOnce({
      id: 'pos-1',
      title: 'Broadcast Observer',
      slug: 'broadcast-observer',
      department: 'Productions & Broadcast',
      location: 'Remote',
      commitment: '3h',
      employmentType: 'Volunteer',
      summary: 'Camera director summary.',
      description: 'Desc',
      status: 'published',
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'broadcast-observer' }) });
    expect(meta.title).toBe('Broadcast Observer | EZ Esports Careers');
    expect(meta.description).toBe('Camera director summary.');
  });
});
