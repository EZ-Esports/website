import { describe, it, expect } from 'vitest';
import {
  canShowSpread,
  fitSheetWidth,
  previousSpreadStart,
  spreadAnnouncement,
  spreadCounterLabel,
  spreadSize,
  spreadStart,
  linkifyText,
  parsePageHash,
  structureHandbookText,
  swipeDirection,
  resolveHandbookLink,
  searchHandbookPages,
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

describe('fitSheetWidth', () => {
  it('is limited by height for a tall box and by width for a wide one, then zoomed', () => {
    const aspect = 612 / 792;
    expect(fitSheetWidth({ availableWidth: 2000, availableHeight: 792, count: 1, aspect, zoom: 1 })).toBeCloseTo(612);
    expect(fitSheetWidth({ availableWidth: 400, availableHeight: 2000, count: 1, aspect, zoom: 1 })).toBe(400);
    expect(fitSheetWidth({ availableWidth: 400, availableHeight: 99999, count: 1, aspect, zoom: 1.5 })).toBe(600);
  });
});

describe('fitSheetWidth for a spread', () => {
  it('fits both pages inside the box, by width or by height', () => {
    const aspect = 612 / 792;
    expect(fitSheetWidth({ availableWidth: 1000, availableHeight: 5000, count: 2, aspect, zoom: 1, gap: 2 })).toBe(499);
    expect(fitSheetWidth({ availableWidth: 3000, availableHeight: 792, count: 2, aspect, zoom: 1, gap: 2 })).toBeCloseTo(612);
    expect(fitSheetWidth({ availableWidth: 1000, availableHeight: 5000, count: 2, aspect, zoom: 2, gap: 2 })).toBe(998);
  });
});

describe('spreads', () => {
  it('shows the cover alone, then pairs, with an odd last page alone', () => {
    // 7 pages: [0] [1 2] [3 4] [5 6]
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => spreadStart(i, 7, true))).toEqual([0, 1, 1, 3, 3, 5, 5]);
    expect([0, 1, 3, 5].map((s) => spreadSize(s, 7, true))).toEqual([1, 2, 2, 2]);
    // 6 pages: the last page (index 5) stands alone.
    expect(spreadStart(5, 6, true)).toBe(5);
    expect(spreadSize(5, 6, true)).toBe(1);
  });

  it('is one page at a time when spreads are off, and clamps out-of-range indexes', () => {
    expect(spreadStart(4, 7, false)).toBe(4);
    expect(spreadSize(4, 7, false)).toBe(1);
    expect(spreadStart(99, 7, true)).toBe(5);
    expect(spreadStart(-3, 7, true)).toBe(0);
  });

  it('steps back by a spread, landing on the cover from the first pair', () => {
    expect(previousSpreadStart(5, true)).toBe(3);
    expect(previousSpreadStart(1, true)).toBe(0);
    expect(previousSpreadStart(0, true)).toBe(0);
    expect(previousSpreadStart(5, false)).toBe(4);
  });

  it('handles one- and two-page documents', () => {
    expect(spreadSize(0, 1, true)).toBe(1);
    expect(spreadSize(0, 2, true)).toBe(1);
    expect(spreadSize(1, 2, true)).toBe(1);
    expect(spreadStart(1, 2, true)).toBe(1);
  });

  it('needs a non-phone screen and a roomy enough box', () => {
    expect(canShowSpread(1280, 900)).toBe(true);
    expect(canShowSpread(767, 900)).toBe(false);
    expect(canShowSpread(1024, 430)).toBe(false);
  });

  it('words the counter and the announcement for one or two pages', () => {
    expect(spreadCounterLabel(0, 1, 7)).toBe('Page 1 / 7');
    expect(spreadCounterLabel(1, 2, 7)).toBe('Pages 2–3 / 7');
    expect(spreadAnnouncement(0, 1, 7)).toBe('Page 1 of 7');
    expect(spreadAnnouncement(3, 2, 7)).toBe('Pages 4 and 5 of 7');
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

describe('structureHandbookText', () => {
  it('splits known headings, paragraphs and bullet lists, dropping the page number', () => {
    const blocks = structureHandbookText(
      ['3  ❖ osu! ❖ Tetr.io 1. Who we are Intro text ● First ● Second', '4 more'],
      ['1. Who we are'],
    );
    expect(blocks).toEqual([
      { type: 'list', items: ['osu!', 'Tetr.io'], page: 0 },
      { type: 'heading', text: '1. Who we are', page: 0 },
      { type: 'paragraph', text: 'Intro text', page: 0 },
      { type: 'list', items: ['First', 'Second'], page: 0 },
      { type: 'paragraph', text: 'more', page: 1 },
    ]);
  });
});

describe('linkifyText', () => {
  const box = { x: 0, y: 0, w: 1, h: 1 };

  it('links the first occurrence of each safe label and ignores unsafe ones', () => {
    const out = linkifyText('Join our Discord today, Discord rocks. Bad link here', [
      { ...box, label: 'Discord', uri: 'https://discord.com/invite/x' },
      { ...box, label: 'Bad link', uri: 'javascript:alert(1)' },
      { ...box, label: 'Key Links 2', page: 1 },
    ]);
    expect(out).toEqual([
      'Join our ',
      { text: 'Discord', href: 'https://discord.com/invite/x', newTab: true },
      ' today, Discord rocks. Bad link here',
    ]);
  });
});

describe('parsePageHash', () => {
  it('reads #page-N, clamps to the document, and rejects anything else', () => {
    expect(parsePageHash('#page-3', 7)).toBe(2);
    expect(parsePageHash('#page-99', 7)).toBe(6);
    for (const bad of ['#page-0', '#page-x', '#other', '', '#page-3x']) expect(parsePageHash(bad, 7)).toBeNull();
    expect(parsePageHash('#page-1', 0)).toBeNull();
  });
});

describe('swipeDirection', () => {
  it('turns pages only for quick, mostly horizontal swipes', () => {
    expect(swipeDirection(-120, 10, 200)).toBe(-1);
    expect(swipeDirection(120, 10, 200)).toBe(1);
    expect(swipeDirection(-120, 200, 200)).toBe(0);
    expect(swipeDirection(-30, 0, 100)).toBe(0);
    expect(swipeDirection(-120, 0, 2000)).toBe(0);
  });
});
