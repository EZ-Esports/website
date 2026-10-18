import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { getCachedHandbookPdfKey } = vi.hoisted(() => ({ getCachedHandbookPdfKey: vi.fn() }));
vi.mock('@/app/lib/db/queries', () => ({ getCachedHandbookPdfKey }));

import HandbookPage, { metadata } from '../page';

async function render() {
  return renderToStaticMarkup(await HandbookPage());
}

describe('Student Handbook page (/handbook)', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://local/test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    getCachedHandbookPdfKey.mockReset();
  });

  it('exports metadata', () => {
    expect(metadata.title).toBe('Student Handbook | EZ Esports');
  });

  it('shows the built-in text and no viewer when no PDF is uploaded', async () => {
    getCachedHandbookPdfKey.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('0. Key Links');
    expect(html).toContain('5. Our #1 Rule');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('Download PDF');
  });

  it('leads with the PDF viewer and download link when one is uploaded, keeping the text collapsed', async () => {
    getCachedHandbookPdfKey.mockResolvedValue('handbook/1760000000000.pdf');
    const html = await render();
    const url = 'https://x.supabase.co/storage/v1/object/public/admin-uploads/handbook/1760000000000.pdf';
    expect(html).toContain('<iframe');
    expect(html).toContain(`src="${url}#view=FitH"`);
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('Download PDF');
    expect(html).toContain('<details');
    expect(html).toContain('0. Key Links');
  });

  it('falls back to the text version when the CMS lookup fails', async () => {
    getCachedHandbookPdfKey.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = await render();
    expect(html).not.toContain('<iframe');
    expect(html).toContain('1. Who and what is EZ Esports?');
  });
});
