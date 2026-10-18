'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/app/lib/cx';
import { HANDBOOK_DOWNLOAD_NAME } from '@/app/lib/handbook';
import Button from '@/app/components/ui/Button';
import { BUNDLED_CHAPTERS, BUNDLED_HANDBOOK_PAGES, BUNDLED_TEXT_HEADINGS } from '@/app/lib/handbook-pages';
import type { HandbookChapter, HandbookLink, HandbookViewerPage } from '@/app/lib/handbook-viewer-types';
import {
  LETTER_ASPECT,
  NARROW_MAX_WIDTH,
  fitSheetWidth,
  linkifyText,
  parsePageHash,
  resolveHandbookLink,
  searchHandbookPages,
  structureHandbookText,
  swipeDirection,
  type TextSegment,
} from '@/app/lib/handbook-viewer';
import type { LoadedHandbookPdf } from '@/app/lib/handbook-pdf';

interface HandbookViewerProps {
  /** Public URL of the staff-uploaded PDF, or null to show the bundled pages. */
  pdfUrl: string | null;
  /** Same file with a download-forcing parameter. */
  downloadUrl: string | null;
  docsUrl: string;
  edition: string;
  lastModified: string;
}

type Source = 'loading' | 'pdf' | 'bundled';

const bundledPages: HandbookViewerPage[] = BUNDLED_HANDBOOK_PAGES.map((p) => ({
  text: p.text,
  links: p.links,
  aspect: LETTER_ASPECT,
}));

/**
 * The panel behind the page. A light neutral so the white page reads as a sheet
 * lying on a desk; swap this one class to change it (e.g. 'bg-surface-sunken' for dark).
 */
const VIEWER_BACKDROP = 'bg-[#e9e6e6]';

const toolbarBase =
  'rounded-lg border px-3 py-2 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-35 disabled:cursor-default cursor-pointer';
const toolbarControl = cx(toolbarBase, 'border-line bg-surface-raised text-foreground hover:border-accent/60');
const toolbarActive = cx(toolbarBase, 'border-accent bg-accent text-on-accent');
const linkClass = 'text-accent underline underline-offset-2 hover:text-accent/80';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function PdfCanvas({
  pdf,
  index,
  width,
  label,
}: {
  pdf: LoadedHandbookPdf;
  index: number;
  width: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Whole pixels only: re-rendering for sub-pixel resize noise would repaint constantly.
  const cssWidth = Math.round(width);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const job = pdf.renderPage(index, canvas, cssWidth);
    job.promise.catch((err) => console.error('Handbook page render failed', err));
    return () => job.cancel();
  }, [pdf, index, cssWidth]);

  return <canvas ref={ref} role="img" aria-label={label} className="block h-auto w-full" />;
}

export function LinkBox({ link, onGo }: { link: HandbookLink; onGo: (page: number) => void }) {
  const style = { left: `${link.x}%`, top: `${link.y}%`, width: `${link.w}%`, height: `${link.h}%` };
  // z-[2]: above the page-edge turn zones, so a link near an edge still opens.
  const className =
    'absolute z-[2] block rounded-[2px] hover:bg-accent/25 focus-visible:bg-accent/25 focus-visible:outline-2 focus-visible:outline-accent';
  const resolved = resolveHandbookLink(link.uri);
  if (resolved) {
    return (
      <a
        href={resolved.href}
        {...(resolved.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={link.label}
        title={link.label}
        style={style}
        className={className}
      />
    );
  }
  if (link.page !== undefined) {
    const page = link.page;
    return (
      <a
        href={`#page-${page + 1}`}
        onClick={(e) => {
          e.preventDefault();
          onGo(page);
        }}
        aria-label={link.label}
        title={link.label}
        style={style}
        className={className}
      />
    );
  }
  return null;
}

function Linkified({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === 'string' ? (
          seg
        ) : (
          <a
            key={i}
            href={seg.href}
            {...(seg.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={linkClass}
          >
            {seg.text}
          </a>
        ),
      )}
    </>
  );
}

export default function HandbookViewer({ pdfUrl, downloadUrl, docsUrl, edition, lastModified }: HandbookViewerProps) {
  const [source, setSource] = useState<Source>(pdfUrl ? 'loading' : 'bundled');
  const [pdf, setPdf] = useState<LoadedHandbookPdf | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [textMode, setTextMode] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [windowWidth, setWindowWidth] = useState(1024);
  const viewerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLElement>(null);
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const firstTextRender = useRef(true);

  // Load the uploaded PDF in the browser; any failure falls back to the bundled pages.
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    let loaded: LoadedHandbookPdf | null = null;
    import('@/app/lib/handbook-pdf')
      .then((mod) => mod.loadHandbookPdf(pdfUrl))
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        loaded = doc;
        setPdf(doc);
        setSource('pdf');
      })
      .catch((err) => {
        console.error('Handbook PDF could not be loaded', err);
        if (cancelled) return;
        setPdfFailed(true);
        setSource('bundled');
      });
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [pdfUrl]);

  const pages = source === 'pdf' && pdf ? pdf.pages : bundledPages;
  const chapters: readonly HandbookChapter[] = source === 'pdf' && pdf ? pdf.chapters : BUNDLED_CHAPTERS;
  const narrow = windowWidth <= NARROW_MAX_WIDTH;

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      setBox({
        w: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        // Fit height comes from the viewport, not the element: the viewer grows with zoom and the page scrolls, not the box.
        h: Math.max(360, Math.min(window.innerHeight * 0.72, 860)) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [textMode]);

  // The URL hash is the current page: read on load (and again once a PDF's page count is known) and on hashchange.
  useEffect(() => {
    const apply = () => {
      const index = parsePageHash(window.location.hash, pages.length);
      if (index !== null) setCurrent(index);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [pages.length]);

  // A source swap can leave the page index out of range.
  useEffect(() => {
    setCurrent((c) => Math.min(c, pages.length - 1));
  }, [pages.length]);

  const go = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, index));
      setCurrent(target);
      // replaceState: a long read would otherwise bury the Back button under one entry per page turn.
      window.history.replaceState(window.history.state, '', `#page-${target + 1}`);
      const el = sectionRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top;
        // Keep the top of the new page in view below the site nav and sticky controls.
        if (top < 150) window.scrollTo({ top: window.scrollY + top - 150, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      const viewer = viewerRef.current;
      if (viewer) viewer.scrollLeft = 0;
    },
    [pages.length],
  );

  const last = pages.length - 1;
  const next = useCallback(() => go(current + 1), [go, current]);
  const previous = useCallback(() => go(current - 1), [go, current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (textMode) return;
      if (target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowRight' && current < last) {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' && current > 0) {
        e.preventDefault();
        previous();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, previous, current, last, textMode]);

  // Move focus into the text view when it opens; closing leaves focus on the toggle that was pressed.
  useEffect(() => {
    if (firstTextRender.current) {
      firstTextRender.current = false;
      return;
    }
    if (textMode) textRef.current?.focus();
  }, [textMode]);

  const onTouchStart = (e: React.TouchEvent) => {
    // Two fingers is a pinch, not a swipe; leave it to the browser.
    touchRef.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const viewer = viewerRef.current;
    // When the page is zoomed (pinch or the menu) sideways drags pan; they must not turn the page.
    if ((window.visualViewport?.scale ?? 1) > 1.02 || (viewer && viewer.scrollWidth > viewer.clientWidth + 1)) return;
    const t = e.changedTouches[0];
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t);
    if (dir === -1 && current < last) next();
    if (dir === 1 && current > 0) previous();
  };

  const hits = useMemo(
    () => searchHandbookPages(pages.map((p) => p.text), submittedQuery),
    [pages, submittedQuery],
  );

  const textBlocks = useMemo(() => {
    if (!textMode) return [];
    const headings = source === 'pdf' ? chapters.map((c) => c.label) : [...BUNDLED_TEXT_HEADINGS];
    return structureHandbookText(pages.map((p) => p.text), headings);
  }, [textMode, pages, chapters, source]);

  // Phones fill the width (readable text, pinch to zoom further); larger screens fit the whole page on screen.
  const sheetWidth = fitSheetWidth({
    availableWidth: box.w,
    availableHeight: narrow ? 99999 : box.h,
    count: 1,
    aspect: pages[current]?.aspect ?? LETTER_ASPECT,
    zoom,
  });

  const showPdfButtons = Boolean(pdfUrl);
  const page = pages[current];
  const zoomOptions = [
    { value: 1.5, label: '150%' },
    { value: 1, label: narrow ? 'Fit width' : 'Full page' },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-10">
      <a
        href="#handbook-viewer"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-24 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
      >
        Skip to the handbook
      </a>
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">{edition}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-foreground">Student Handbook</h1>
          <p className="mt-1 text-sm text-foreground-secondary">Published by EZ Esports Leadership</p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          {showPdfButtons && pdfUrl && (
            <Button href={pdfUrl} target="_blank" rel="noopener noreferrer" variant="primary" size="sm">
              Open PDF
            </Button>
          )}
          {showPdfButtons && downloadUrl && (
            <Button href={downloadUrl} download={HANDBOOK_DOWNLOAD_NAME} variant="outline" size="sm">
              Download PDF
            </Button>
          )}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="handbook-contents"
            onClick={() => setMenuOpen((o) => !o)}
            className={cx(toolbarControl, 'md:hidden')}
          >
            Contents &amp; search
          </button>
        </div>
      </header>

      {pdfFailed && (
        <p role="status" className="mb-4 rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-foreground-secondary print:hidden">
          The PDF viewer could not load the uploaded handbook, so the bundled {edition} pages are shown.
          {pdfUrl && (
            <>
              {' '}
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Open the PDF directly
              </a>
              .
            </>
          )}
        </p>
      )}

      <div className="relative grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
        <aside
          id="handbook-contents"
          className={cx(
            'print:hidden md:block md:max-h-[calc(100dvh-8rem)] md:overflow-auto md:pr-2 md:sticky md:top-24 md:self-start',
            menuOpen
              ? 'absolute inset-x-0 top-0 z-40 block rounded-lg border border-line bg-surface-raised p-4 shadow-2xl'
              : 'hidden',
          )}
        >
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 block rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-center text-sm text-foreground hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block text-xs text-foreground-secondary">Having trouble viewing?</span>
            Open in Google Docs ↗
          </a>

          {chapters.length > 0 && (
            <nav aria-label="Handbook sections" className="grid grid-cols-2 gap-1 md:grid-cols-1">
              {chapters.map((chapter, i) => {
                const active = chapter.page === current;
                return (
                  <button
                    key={`${chapter.label}-${i}`}
                    type="button"
                    aria-current={active}
                    onClick={() => {
                      setTextMode(false);
                      go(chapter.page);
                      setMenuOpen(false);
                    }}
                    className={cx(
                      'cursor-pointer border-l-2 px-3 py-2.5 text-left text-xs sm:text-sm leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                      active
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-line text-foreground-secondary hover:bg-surface-raised',
                    )}
                  >
                    {chapter.label}
                  </button>
                );
              })}
            </nav>
          )}

          <form
            role="search"
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedQuery(query);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the handbook"
              placeholder="Search handbook…"
              className="min-w-0 w-full rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <button type="submit" className={toolbarControl}>
              Find
            </button>
          </form>
          <div aria-live="polite" className="mt-3 text-xs leading-relaxed text-foreground-secondary">
            {submittedQuery.trim() && hits.length === 0 && 'No matching pages.'}
            {hits.map((hit) => (
              <button
                key={hit.page}
                type="button"
                onClick={() => {
                  setTextMode(false);
                  go(hit.page);
                  setMenuOpen(false);
                }}
                className="block w-full cursor-pointer py-1.5 text-left text-accent underline underline-offset-2"
              >
                Page {hit.page + 1} · {hit.snippet}…
              </button>
            ))}
          </div>

          <p className="mt-6 hidden text-[11px] leading-relaxed text-foreground-muted md:block">
            Last modified: {lastModified}
            <br />
            This document is property of EZ Esports.
          </p>
        </aside>

        <section id="handbook-viewer" ref={sectionRef} tabIndex={-1} aria-label="Interactive handbook" className="min-w-0 outline-none">
          {/* Pinned under the site nav (88px) so page, zoom and Prev/Next stay reachable while a tall page scrolls. */}
          <div className="sticky top-[88px] z-30 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-surface/95 px-1 py-2 backdrop-blur print:hidden">
            {!textMode && (
              <span className="mr-auto text-xs sm:text-sm text-foreground-secondary">
                {source === 'loading' ? 'Loading handbook…' : `Page ${current + 1} / ${pages.length}`}
              </span>
            )}
            {textMode && <span className="mr-auto text-xs sm:text-sm text-foreground-secondary">Text version</span>}
            {!textMode && (
              <>
                <button type="button" onClick={previous} disabled={current === 0} className={toolbarControl}>
                  ← Previous
                </button>
                <button type="button" onClick={next} disabled={current >= last} className={toolbarControl}>
                  Next →
                </button>
                <label>
                  <span className="sr-only">Page zoom</span>
                  <select
                    aria-label="Page zoom"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className={toolbarControl}
                  >
                    {zoomOptions.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              aria-pressed={textMode}
              aria-controls={textMode ? 'handbook-text' : 'handbook-pages'}
              onClick={() => setTextMode((t) => !t)}
              className={textMode ? toolbarActive : toolbarControl}
            >
              Read as text
            </button>
          </div>

          {/* Announces page turns for screen readers; the visible counter above is not a live region so it is not read twice. */}
          <p role="status" aria-live="polite" className="sr-only">
            {!textMode && source !== 'loading' ? `Page ${current + 1} of ${pages.length}` : ''}
          </p>

          {textMode ? (
            <article
              id="handbook-text"
              ref={textRef}
              tabIndex={-1}
              aria-label="Student Handbook, text version"
              className="space-y-4 rounded-xl border border-line bg-surface-raised p-5 text-sm leading-relaxed text-foreground-secondary outline-none sm:p-8 sm:text-base"
            >
              {textBlocks.map((block, i) => {
                const links = pages[block.page]?.links ?? [];
                if (block.type === 'heading') {
                  return (
                    <h2 key={i} className="pt-4 text-xl font-bold text-foreground sm:text-2xl">
                      {block.text}
                    </h2>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul key={i} className="list-disc space-y-2 pl-6">
                      {block.items.map((item, j) => (
                        <li key={j}>
                          <Linkified segments={linkifyText(item, links)} />
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={i}>
                    <Linkified segments={linkifyText(block.text, links)} />
                  </p>
                );
              })}
            </article>
          ) : (
            <div
              id="handbook-pages"
              ref={viewerRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className={cx(
                'flex min-h-[min(72dvh,860px)] overflow-x-auto rounded-xl p-2 sm:p-4 print:h-auto print:overflow-visible print:bg-white print:p-0',
                VIEWER_BACKDROP,
              )}
            >
              {source === 'loading' ? (
                <p className="m-auto text-sm text-neutral-600">Loading the handbook…</p>
              ) : (
                <div className="m-auto flex w-max min-w-full shrink-0 items-start justify-center print:block print:w-full">
                  <div
                    key={`${source}-${current}`}
                    id={`handbook-page-${current + 1}`}
                    className="relative shrink-0 bg-white shadow-xl shadow-black/30 ring-1 ring-black/10 motion-safe:animate-[handbook-arrive_0.22s_ease-out] print:!w-full print:shadow-none print:break-after-page"
                    style={{ width: box.w > 0 ? sheetWidth : 'min(100%, 520px)' }}
                  >
                    {source === 'pdf' && pdf ? (
                      <PdfCanvas pdf={pdf} index={current} width={sheetWidth} label={`Handbook page ${current + 1}`} />
                    ) : (
                      // Plain <img>: static, pre-sized files the browser caches; optimization would only resample the designed pages.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={BUNDLED_HANDBOOK_PAGES[current].image}
                        alt={`Original handbook page ${current + 1}. Use Read as text for the full text.`}
                        width={1224}
                        height={1584}
                        className="block h-auto w-full"
                      />
                    )}
                    {/* Edge turn zones: tap/click the outer 15% to turn pages. Aria-hidden and unfocusable, since Previous/Next and the arrow keys already cover keyboard and screen reader users. */}
                    {current > 0 && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={previous}
                        className="absolute inset-y-0 left-0 z-[1] w-[15%] cursor-pointer bg-transparent hover:bg-black/5 print:hidden"
                      />
                    )}
                    {current < last && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={next}
                        className="absolute inset-y-0 right-0 z-[1] w-[15%] cursor-pointer bg-transparent hover:bg-black/5 print:hidden"
                      />
                    )}
                    {page.links.map((link, i) => (
                      <LinkBox key={i} link={link} onGo={go} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!textMode && (
            <>
              <div className="mt-3 flex items-center justify-between gap-3 print:hidden">
                <button type="button" onClick={previous} disabled={current === 0} className={toolbarControl}>
                  ← Previous
                </button>
                <span className="hidden text-xs text-foreground-muted sm:inline">Use ← → or tap the page edges to turn pages</span>
                <button type="button" onClick={next} disabled={current >= last} className={toolbarControl}>
                  Next →
                </button>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden" aria-label="Choose a page" role="group">
                {pages.map((_, i) => {
                  const active = i === current;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to page ${i + 1}`}
                      aria-current={active}
                      onClick={() => go(i)}
                      className={cx(
                        'h-8 w-8 cursor-pointer rounded-full border text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                        active ? 'border-accent bg-accent text-on-accent' : 'border-line text-foreground-secondary hover:border-accent/60',
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
