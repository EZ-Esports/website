import { describe, it, expect } from 'vitest';
import {
  fitSheetWidth,
  previousSpreadStart,
  resolveHandbookLink,
  searchHandbookPages,
  spreadSize,
  spreadStart,
  viewportRectToLink,
  withDownloadName,
} from '../handbook-viewer';

describe('resolveHandbookLink', () => {
  it('allows http(s) in a new tab and mailto in place', () => {
    expect(resolveHandbookLink('https://discord.com/invite/x')).toEqual({ href: 'https://discord.com/invite/x', newTab: true });
    expect(resolveHandbookLink('mailto:a@b.co')).toEqual({ href: 'mailto:a@b.co', newTab: false });
  });

  it('drops script, data, file, protocol-relative and malformed targets', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//evil.example/x', '/relative', 'not a url', '', null, undefined]) {
      expect(resolveHandbookLink(bad)).toBeNull();
    }
  });
});

describe('spread paging', () => {
  it('keeps the cover alone and pairs the rest', () => {
    expect(spreadStart(0, 7, true)).toBe(0);
    expect([1, 2, 3, 4, 5, 6].map((i) => spreadStart(i, 7, true))).toEqual([1, 1, 3, 3, 5, 5]);
    expect(spreadStart(4, 7, false)).toBe(4);
    expect(spreadStart(99, 7, false)).toBe(6);
    expect(spreadSize(0, true)).toBe(1);
    expect(spreadSize(3, true)).toBe(2);
    expect(spreadSize(3, false)).toBe(1);
  });

  it('steps back by a spread', () => {
    expect(previousSpreadStart(3, true)).toBe(1);
    expect(previousSpreadStart(1, true)).toBe(0);
    expect(previousSpreadStart(3, false)).toBe(2);
  });
});

describe('fitSheetWidth', () => {
  it('is limited by height for a tall box and by width for a wide one, then zoomed', () => {
    const aspect = 612 / 792;
    expect(fitSheetWidth({ availableWidth: 2000, availableHeight: 792, count: 1, aspect, zoom: 1 })).toBeCloseTo(612);
    expect(fitSheetWidth({ availableWidth: 400, availableHeight: 2000, count: 1, aspect, zoom: 1 })).toBe(400);
    expect(fitSheetWidth({ availableWidth: 1002, availableHeight: 2000, count: 2, aspect, zoom: 1.5 })).toBe(750);
  });
});

describe('searchHandbookPages', () => {
  const texts = ['Welcome to EZ Esports', 'Key Links and Discord', 'nothing here'];

  it('finds pages case-insensitively with a snippet', () => {
    expect(searchHandbookPages(texts, 'discord')).toEqual([{ page: 1, snippet: 'Key Links and Discord' }]);
  });

  it('returns nothing for blank or missing queries', () => {
    expect(searchHandbookPages(texts, '  ')).toEqual([]);
    expect(searchHandbookPages(texts, 'zzz')).toEqual([]);
  });
});

describe('PDF helpers', () => {
  it('converts viewport rectangles to page percentages in any corner order', () => {
    expect(viewportRectToLink([200, 100, 100, 50], 400, 200)).toEqual({ x: 25, y: 25, w: 25, h: 25 });
  });

  it('adds a download filename without disturbing the URL', () => {
    expect(withDownloadName('https://x.supabase.co/a/b.pdf', 'h.pdf')).toBe('https://x.supabase.co/a/b.pdf?download=h.pdf');
  });
});
