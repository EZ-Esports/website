/**
 * Pure helpers for the handbook viewer (link safety, page layout, search),
 * kept apart from the component so they can be unit-tested without a DOM.
 */
import type { HandbookLink } from './handbook-viewer-types';

export const LETTER_ASPECT = 612 / 792;

/** Viewports this wide or narrower fit the page to the screen width, not its height, and show one page at a time. */
export const NARROW_MAX_WIDTH = 767;

/** Narrowest viewer box (px) that still shows two pages side by side at a legible size (about 280 px each). */
export const SPREAD_MIN_BOX_WIDTH = 560;

/** Two pages at once only on non-phone screens whose viewer box can hold both legibly. */
export function canShowSpread(viewportWidth: number, boxWidth: number): boolean {
  return viewportWidth > NARROW_MAX_WIDTH && boxWidth >= SPREAD_MIN_BOX_WIDTH;
}

export interface ResolvedHandbookLink {
  href: string;
  /** http(s) links open in a new tab; mailto hands off to the mail client in place. */
  newTab: boolean;
}

/**
 * Turns a link target taken from a document (pamphlet data or a PDF annotation,
 * both untrusted) into something safe to put in an `href`. Anything that is not
 * http(s) or mailto (javascript:, data:, file:, protocol-relative ...) is dropped.
 */
export function resolveHandbookLink(uri: string | undefined | null): ResolvedHandbookLink | null {
  if (!uri) return null;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') return { href: url.href, newTab: true };
  if (url.protocol === 'mailto:') return { href: url.href, newTab: false };
  return null;
}

/** Page width in px so that `count` pages fit the available box, scaled by the zoom factor. */
export function fitSheetWidth(opts: {
  availableWidth: number;
  availableHeight: number;
  count: number;
  aspect: number;
  zoom: number;
  gap?: number;
}): number {
  const { availableWidth, availableHeight, count, aspect, zoom, gap = 2 } = opts;
  const w = Math.max(20, availableWidth);
  const h = Math.max(20, availableHeight);
  return Math.max(10, Math.min((w - (count - 1) * gap) / count, h * aspect)) * zoom;
}

/**
 * Index of the first page of the spread that contains `index`. Page 0 (the cover)
 * stands alone; the rest pair up (1-2, 3-4, ...) in two-page mode.
 */
export function spreadStart(index: number, pageCount: number, spread: boolean): number {
  const clamped = Math.max(0, Math.min(pageCount - 1, index));
  if (spread && clamped > 0) return 1 + 2 * Math.floor((clamped - 1) / 2);
  return clamped;
}

/** Pages shown by the spread starting at `start`: the cover and an odd last page stand alone. */
export function spreadSize(start: number, pageCount: number, spread: boolean): 1 | 2 {
  return spread && start > 0 && start + 1 < pageCount ? 2 : 1;
}

/** Start of the spread before the one starting at `start`. */
export function previousSpreadStart(start: number, spread: boolean): number {
  return Math.max(0, start - (spread && start > 1 ? 2 : 1));
}

/** Visible counter text: 'Page 1 / 7' or 'Pages 2–3 / 7'. */
export function spreadCounterLabel(start: number, size: number, total: number): string {
  return size > 1 ? `Pages ${start + 1}–${start + size} / ${total}` : `Page ${start + 1} / ${total}`;
}

/** Screen-reader text for the live region: 'Page 1 of 7' or 'Pages 2 and 3 of 7'. */
export function spreadAnnouncement(start: number, size: number, total: number): string {
  return size > 1 ? `Pages ${start + 1} and ${start + size} of ${total}` : `Page ${start + 1} of ${total}`;
}

export interface HandbookSearchHit {
  page: number;
  snippet: string;
}

/** Case-insensitive page search with a short context snippet, as the pamphlet did. */
export function searchHandbookPages(texts: readonly string[], query: string): HandbookSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: HandbookSearchHit[] = [];
  texts.forEach((text, page) => {
    const pos = text.toLowerCase().indexOf(q);
    if (pos === -1) return;
    const snippet = text
      .slice(Math.max(0, pos - 25), pos + q.length + 55)
      .replace(/\s+/g, ' ')
      .trim();
    hits.push({ page, snippet });
  });
  return hits;
}

/**
 * Converts a rectangle in viewport pixels (any corner order) to a percentage box
 * over a page of the given pixel size.
 */
export function viewportRectToLink(
  rect: readonly [number, number, number, number],
  width: number,
  height: number,
): Pick<HandbookLink, 'x' | 'y' | 'w' | 'h'> {
  const [ax, ay, bx, by] = rect;
  const left = Math.min(ax, bx);
  const top = Math.min(ay, by);
  return {
    x: (left / width) * 100,
    y: (top / height) * 100,
    w: (Math.abs(bx - ax) / width) * 100,
    h: (Math.abs(by - ay) / height) * 100,
  };
}

/** Supabase serves an object as an attachment when `download=<filename>` is on its URL. */
export function withDownloadName(url: string, filename: string): string {
  const u = new URL(url);
  u.searchParams.set('download', filename);
  return u.toString();
}

export type HandbookTextBlock =
  | { type: 'heading'; text: string; page: number }
  | { type: 'paragraph'; text: string; page: number }
  | { type: 'list'; items: string[]; page: number };

const BULLETS = /[●❖•]/;

/**
 * Turns per-page extracted text into headings, paragraphs and lists for the
 * "Read as text" view. The extraction keeps no layout, so structure comes from
 * what is recoverable: known section headings (when given), bullet glyphs and
 * the leading page number.
 */
export function structureHandbookText(pageTexts: readonly string[], headings: readonly string[] = []): HandbookTextBlock[] {
  const blocks: HandbookTextBlock[] = [];
  pageTexts.forEach((raw, page) => {
    let rest = raw.replace(/\s+/g, ' ').trim().replace(/^\d{1,3}\s+/, '');
    const emit = (segment: string) => {
      const parts = segment.split(BULLETS).map((s) => s.trim());
      if (parts[0]) blocks.push({ type: 'paragraph', text: parts[0], page });
      const items = parts.slice(1).filter(Boolean);
      if (items.length) blocks.push({ type: 'list', items, page });
    };
    for (;;) {
      let best: { at: number; heading: string } | null = null;
      for (const heading of headings) {
        const at = rest.indexOf(heading);
        if (at !== -1 && (!best || at < best.at)) best = { at, heading };
      }
      if (!best) break;
      emit(rest.slice(0, best.at));
      blocks.push({ type: 'heading', text: best.heading, page });
      rest = rest.slice(best.at + best.heading.length);
    }
    emit(rest);
  });
  return blocks;
}

export type TextSegment = string | { text: string; href: string; newTab: boolean };

/** Wraps the first occurrence of each safe link label in `text` so the text view keeps the pamphlet's links. */
export function linkifyText(text: string, links: readonly HandbookLink[]): TextSegment[] {
  let segments: TextSegment[] = [text];
  const candidates = links
    .map((l) => ({ label: l.label.replace(/\s+/g, ' ').trim(), resolved: resolveHandbookLink(l.uri) }))
    .filter((l): l is { label: string; resolved: ResolvedHandbookLink } => Boolean(l.label && l.resolved))
    .sort((a, b) => b.label.length - a.label.length);
  const used = new Set<string>();
  for (const { label, resolved } of candidates) {
    if (used.has(label)) continue;
    const next: TextSegment[] = [];
    let done = false;
    for (const seg of segments) {
      const at = typeof seg === 'string' && !done ? seg.indexOf(label) : -1;
      if (typeof seg !== 'string' || at === -1) {
        next.push(seg);
        continue;
      }
      done = true;
      if (at > 0) next.push(seg.slice(0, at));
      next.push({ text: label, href: resolved.href, newTab: resolved.newTab });
      if (at + label.length < seg.length) next.push(seg.slice(at + label.length));
    }
    if (done) used.add(label);
    segments = next;
  }
  return segments;
}

/** `#page-3` is page index 2 (clamped to the document); anything else is null. */
export function parsePageHash(hash: string, pageCount: number): number | null {
  const m = /^#page-(\d{1,4})$/.exec(hash);
  if (!m || pageCount < 1) return null;
  const n = Number(m[1]);
  if (n < 1) return null;
  return Math.min(n, pageCount) - 1;
}

/** Swipe test: far enough, clearly more sideways than vertical, and quick. -1 = next page, 1 = previous, 0 = not a page swipe. */
export function swipeDirection(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (ms > 800 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? -1 : 1;
}

/** Typographic ligature code points (U+FB00-FB06) and their plain-letter spellings. */
const LIGATURES: Record<string, string> = {
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'ﬅ': 'st',
  'ﬆ': 'st',
};

/** Expands ligature glyphs so search and reading see ordinary letters. */
export function normalizeLigatures(text: string): string {
  return text.replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c);
}

/** The slice of a pdf.js TextItem needed to decide where words break. */
export interface PdfTextItemLike {
  str: string;
  /** Affine transform [a, b, c, d, e, f]; e/f are the baseline origin. */
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

/** A gap wider than this fraction of the font height counts as a real word space. */
const WORD_GAP_RATIO = 0.15;

/**
 * Joins pdf.js text items into one page string. pdf.js emits a new item per
 * font/style run (and often around ligature glyphs), so blindly joining with a
 * space turned "modified" into "modi fi ed". A space is inserted only at a real
 * gap, a line change, or an end-of-line marker; ligatures are expanded.
 */
export function joinPdfTextItems(items: readonly PdfTextItemLike[]): string {
  let out = '';
  let prev: PdfTextItemLike | null = null;
  let breakPending = false;
  for (const item of items) {
    const str = item.str ?? '';
    if (str === '') {
      if (item.hasEOL) breakPending = true;
      continue;
    }
    if (prev && out) {
      let space = breakPending || !!prev.hasEOL;
      if (!space) {
        if (prev.transform && item.transform) {
          const px = prev.transform[4];
          const py = prev.transform[5];
          const x = item.transform[4];
          const y = item.transform[5];
          const size = Math.max(prev.height || 0, item.height || 0) || 10;
          if (Math.abs(y - py) > size * 0.5) space = true;
          else if (x - (px + (prev.width ?? 0)) > size * WORD_GAP_RATIO) space = true;
        } else {
          space = true; // no geometry: keep the old, safe behaviour
        }
      }
      if (space) out += ' ';
    }
    out += str;
    breakPending = false;
    prev = item;
  }
  return normalizeLigatures(out).replace(/\s+/g, ' ').trim();
}
