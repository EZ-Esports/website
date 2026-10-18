/**
 * Pure helpers for the handbook viewer (link safety, page layout, search),
 * kept apart from the component so they can be unit-tested without a DOM.
 */
import type { HandbookLink } from './handbook-viewer-types';

export const LETTER_ASPECT = 612 / 792;

/** Below this viewport width the viewer always shows a single page. */
export const SPREAD_MIN_WIDTH = 760;

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
 * Index of the first page of the spread that contains `index`. Page 0 is the
 * cover and always stands alone; the rest pair up (1-2, 3-4, ...) in two-page mode.
 */
export function spreadStart(index: number, pageCount: number, spread: boolean): number {
  const clamped = Math.max(0, Math.min(pageCount - 1, index));
  if (spread && clamped > 0) return 1 + 2 * Math.floor((clamped - 1) / 2);
  return clamped;
}

export function spreadSize(current: number, spread: boolean): number {
  return spread && current > 0 ? 2 : 1;
}

/** Start of the spread before `current`. */
export function previousSpreadStart(current: number, spread: boolean): number {
  return current - (spread && current > 1 ? 2 : 1);
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
