'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/app/lib/cx';
import { HANDBOOK_DOWNLOAD_NAME } from '@/app/lib/handbook';
import Button from '@/app/components/ui/Button';
import { BUNDLED_CHAPTERS, BUNDLED_HANDBOOK_PAGES } from '@/app/lib/handbook-pages';
import type { HandbookChapter, HandbookLink, HandbookViewerPage } from '@/app/lib/handbook-viewer-types';
import {
  LETTER_ASPECT,
  SPREAD_MIN_WIDTH,
  fitSheetWidth,
  previousSpreadStart,
  resolveHandbookLink,
  searchHandbookPages,
  spreadSize,
  spreadStart,
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

const ZOOMS = [
  { value: 1, label: 'Fit screen' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2, label: '200%' },
];

const toolbarBase =
  'rounded-lg border px-3 py-2 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-35 disabled:cursor-default cursor-pointer';
const toolbarControl = cx(toolbarBase, 'border-line bg-surface-raised text-foreground hover:border-accent/60');
const toolbarActive = cx(toolbarBase, 'border-accent bg-accent text-on-accent');

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
  const className =
    'absolute block rounded-[2px] hover:bg-accent/25 focus-visible:bg-accent/25 focus-visible:outline-2 focus-visible:outline-accent';
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

export default function HandbookViewer({ pdfUrl, downloadUrl, docsUrl, edition, lastModified }: HandbookViewerProps) {
  const [source, setSource] = useState<Source>(pdfUrl ? 'loading' : 'bundled');
  const [pdf, setPdf] = useState<LoadedHandbookPdf | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [two, setTwo] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [windowWidth, setWindowWidth] = useState(1024);
  const viewerRef = useRef<HTMLDivElement>(null);

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
  const spread = two && windowWidth > SPREAD_MIN_WIDTH;
  const count = spreadSize(current, spread);
  const end = Math.min(current + count, pages.length);

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
        h: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const go = useCallback(
    (index: number) => {
      setCurrent(spreadStart(index, pages.length, spread));
      const el = viewerRef.current;
      if (el) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    },
    [pages.length, spread],
  );

  // Moving between sources (bundled to PDF) or modes can leave `current` out of range or off a spread boundary.
  useEffect(() => {
    setCurrent((c) => spreadStart(c, pages.length, spread));
  }, [pages.length, spread]);

  const next = useCallback(() => go(current + count), [go, current, count]);
  const previous = useCallback(() => go(previousSpreadStart(current, spread)), [go, current, spread]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowRight' && end < pages.length) {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previous();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, previous, end, pages.length]);

  const hits = useMemo(
    () => searchHandbookPages(pages.map((p) => p.text), submittedQuery),
    [pages, submittedQuery],
  );

  const sheetWidth = fitSheetWidth({
    availableWidth: box.w,
    availableHeight: box.h,
    count,
    aspect: pages[current]?.aspect ?? LETTER_ASPECT,
    zoom,
  });

  const visible = pages.slice(current, end).map((page, i) => ({ page, index: current + i }));
  const showPdfButtons = Boolean(pdfUrl);

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-10">
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
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
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
              ? 'absolute inset-x-0 top-0 z-20 block rounded-lg border border-line bg-surface-raised p-4 shadow-2xl'
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
                const active = chapter.page >= current && chapter.page < end;
                return (
                  <button
                    key={`${chapter.label}-${i}`}
                    type="button"
                    aria-current={active}
                    onClick={() => {
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

        <section aria-label="Interactive handbook" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            <span className="mr-auto text-xs sm:text-sm text-foreground-secondary" aria-live="polite">
              {source === 'loading'
                ? 'Loading handbook…'
                : `${count === 1 ? 'Page' : 'Pages'} ${current + 1}${end > current + 1 ? `–${end}` : ''} / ${pages.length}`}
            </span>
            <button
              type="button"
              aria-pressed={two}
              onClick={() => setTwo((t) => !t)}
              className={two ? toolbarActive : toolbarControl}
            >
              Two pages
            </button>
            <label>
              <span className="sr-only">Page zoom</span>
              <select
                aria-label="Page zoom"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className={toolbarControl}
              >
                {ZOOMS.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            ref={viewerRef}
            className="flex h-[min(72dvh,860px)] min-h-[360px] overflow-auto overscroll-contain rounded-xl bg-surface-sunken p-2 sm:p-4 print:h-auto print:overflow-visible print:bg-white print:p-0"
          >
            {source === 'loading' ? (
              <p className="m-auto text-sm text-foreground-secondary">Loading the handbook…</p>
            ) : (
              <div className="m-auto flex w-max min-w-full shrink-0 items-start justify-center gap-0.5 print:block print:w-full">
                {visible.map(({ page, index }) => (
                  <div
                    key={`${source}-${index}`}
                    id={`page-${index + 1}`}
                    className="relative shrink-0 bg-white shadow-xl shadow-black/40 motion-safe:animate-[handbook-arrive_0.22s_ease-out] print:!w-full print:shadow-none print:break-after-page"
                    style={{ width: box.w > 0 ? sheetWidth : 'min(100%, 520px)' }}
                  >
                    {source === 'pdf' && pdf ? (
                      <PdfCanvas pdf={pdf} index={index} width={sheetWidth} label={`Handbook page ${index + 1}`} />
                    ) : (
                      // Plain <img>: static, pre-sized files the browser caches; optimization would only resample the designed pages.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={BUNDLED_HANDBOOK_PAGES[index].image}
                        alt={`Original handbook page ${index + 1}. Full text is available through search.`}
                        width={1224}
                        height={1584}
                        className="block h-auto w-full"
                      />
                    )}
                    {page.links.map((link, i) => (
                      <LinkBox key={i} link={link} onGo={go} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 print:hidden">
            <button type="button" onClick={previous} disabled={current === 0} className={toolbarControl}>
              ← Previous
            </button>
            <span className="hidden text-xs text-foreground-muted sm:inline">Use ← → to turn pages</span>
            <button type="button" onClick={next} disabled={end >= pages.length} className={toolbarControl}>
              Next →
            </button>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden" aria-label="Choose a page" role="group">
            {pages.map((_, i) => {
              const active = i >= current && i < end;
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
        </section>
      </div>
    </div>
  );
}
