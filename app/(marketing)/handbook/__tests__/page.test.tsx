import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { getCachedHandbookPdfKey } = vi.hoisted(() => ({ getCachedHandbookPdfKey: vi.fn() }));
vi.mock('@/app/lib/db/queries', () => ({ getCachedHandbookPdfKey }));

import { LinkBox } from '@/app/components/handbook/HandbookViewer';
import HandbookPage, { metadata, revalidate } from '../page';

async function render() {
  return renderToStaticMarkup(await HandbookPage());
}

const URL_BASE = 'https://x.supabase.co/storage/v1/object/public/admin-uploads/handbook/1760000000000.pdf';

describe('Student Handbook page (/handbook)', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://local/test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    getCachedHandbookPdfKey.mockReset();
  });

  it('uses a bare title (the layout adds the site name) and revalidates', () => {
    expect(metadata.title).toBe('Student Handbook');
    expect(revalidate).toBe(60);
  });

  it('shows the bundled pamphlet pages and viewer chrome, with no PDF buttons, when nothing is uploaded', async () => {
    getCachedHandbookPdfKey.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('src="/handbook/page-1.jpg"');
    expect(html).toContain('Open in Google Docs');
    expect(html).toContain('Search the handbook');
    expect(html).toContain('Page zoom');
    expect(html).toContain('100%');
    expect(html).toContain('Go to page 7');
    expect(html).toContain('4. Key Dates and Timeline');
    expect(html).toContain('href="#page-2"');
    expect(html).not.toContain('Download PDF');
    expect(html).not.toContain('Open PDF');
    expect(html).not.toContain('<iframe');
  });

  it('has a skip link, a live page announcement, a Read as text toggle and edge turn zones', async () => {
    getCachedHandbookPdfKey.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('href="#handbook-viewer"');
    expect(html).toContain('Skip to the handbook');
    expect(html).toContain('id="handbook-viewer"');
    expect(html).toMatch(/role="status" aria-live="polite" class="sr-only">Page 1 of 7</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Read as text</);
    // First page: only a "next" zone.
    expect(html.match(/tabindex="-1" aria-hidden="true"/g)).toHaveLength(1);
    expect(html).toContain('right-0 z-[1] w-[15%]');
    expect(html).not.toContain('left-0 z-[1] w-[15%]');
    expect(html).not.toContain('-resize');
  });

  it('renders mailto link boxes in place and web link boxes in a new tab with noopener', () => {
    const box = { x: 1, y: 2, w: 3, h: 4, label: 'x' };
    const mail = renderToStaticMarkup(<LinkBox link={{ ...box, uri: 'mailto:ezesportsleague@gmail.com' }} onGo={() => {}} />);
    expect(mail).toContain('href="mailto:ezesportsleague@gmail.com"');
    expect(mail).not.toContain('target=');
    const web = renderToStaticMarkup(<LinkBox link={{ ...box, uri: 'https://discord.com/invite/RajSZqNyvu' }} onGo={() => {}} />);
    expect(web).toContain('target="_blank"');
    expect(web).toContain('rel="noopener noreferrer"');
    const bad = renderToStaticMarkup(<LinkBox link={{ ...box, uri: 'javascript:alert(1)' }} onGo={() => {}} />);
    expect(bad).toBe('');
  });

  it('offers Open and Download buttons (download forced via Supabase param) when a PDF is uploaded', async () => {
    getCachedHandbookPdfKey.mockResolvedValue('handbook/1760000000000.pdf');
    const html = await render();
    expect(html).toContain('Open PDF');
    expect(html).toContain(`href="${URL_BASE}"`);
    expect(html).toContain('Download PDF');
    expect(html).toContain(`href="${URL_BASE}?download=EZ-Esports-Student-Handbook.pdf"`);
    expect(html).not.toContain('<iframe');
  });

  it('falls back to the bundled pages when the CMS lookup fails', async () => {
    getCachedHandbookPdfKey.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = await render();
    expect(html).toContain('src="/handbook/page-1.jpg"');
    expect(html).not.toContain('Download PDF');
  });
});
