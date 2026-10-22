/**
 * Client-only bridge to pdf.js for the handbook viewer. pdfjs-dist is imported
 * dynamically so it never reaches the server bundle or the first load of any
 * other page; the worker is a same-origin asset (CSP `worker-src 'self'`).
 */
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { HandbookChapter, HandbookViewerPage } from './handbook-viewer-types';
import { LETTER_ASPECT, joinPdfTextItems, resolveHandbookLink, viewportRectToLink } from './handbook-viewer';

export interface LoadedHandbookPdf {
  pages: HandbookViewerPage[];
  chapters: HandbookChapter[];
  /** Paints page `index` into `canvas` at `cssWidth` CSS pixels wide (sharp on high-DPI screens). */
  renderPage(index: number, canvas: HTMLCanvasElement, cssWidth: number): { promise: Promise<void>; cancel(): void };
  destroy(): void;
}

type PdfModule = typeof import('pdfjs-dist');

let modulePromise: Promise<PdfModule> | null = null;

function loadPdfJs(): Promise<PdfModule> {
  modulePromise ??= import('pdfjs-dist').then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return mod;
  });
  return modulePromise;
}

async function resolveDestPage(pdf: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const target = explicit[0];
    if (typeof target === 'number') return target;
    if (target && typeof target === 'object') return await pdf.getPageIndex(target as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
  } catch {
    // An unresolvable destination just means that link/chapter is not clickable.
  }
  return null;
}

async function readChapters(pdf: PDFDocumentProxy): Promise<HandbookChapter[]> {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline) return [];
  const chapters: HandbookChapter[] = [];
  const walk = async (items: typeof outline, depth: number) => {
    for (const item of items) {
      const page = await resolveDestPage(pdf, item.dest);
      if (page !== null && item.title.trim()) chapters.push({ label: item.title.trim(), page });
      if (depth < 1 && item.items?.length) await walk(item.items, depth + 1);
    }
  };
  await walk(outline, 0);
  return chapters.slice(0, 40);
}

export async function loadHandbookPdf(url: string): Promise<LoadedHandbookPdf> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ url });
  const pdf = await loadingTask.promise;

  const pages: HandbookViewerPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const links: HandbookViewerPage['links'] = [];
    for (const annotation of await page.getAnnotations()) {
      if (annotation.subtype !== 'Link' || !annotation.rect) continue;
      const [x1, y1, x2, y2] = annotation.rect as [number, number, number, number];
      const [ax, ay] = viewport.convertToViewportPoint(x1, y1) as [number, number];
      const [bx, by] = viewport.convertToViewportPoint(x2, y2) as [number, number];
      const box = viewportRectToLink([ax, ay, bx, by], viewport.width, viewport.height);
      const label = annotation.contentsObj?.str || annotation.url || annotation.unsafeUrl || 'Link';
      if (annotation.url && resolveHandbookLink(annotation.url)) {
        links.push({ ...box, label, uri: annotation.url });
      } else if (annotation.dest) {
        const target = await resolveDestPage(pdf, annotation.dest);
        if (target !== null) links.push({ ...box, label: `Go to page ${target + 1}`, page: target });
      }
    }
    const content = await page.getTextContent();
    const text = joinPdfTextItems(content.items.filter((item) => 'str' in item));
    pages.push({ text, links, aspect: viewport.width / viewport.height || LETTER_ASPECT });
  }

  return {
    pages,
    chapters: await readChapters(pdf),
    renderPage(index, canvas, cssWidth) {
      let task: RenderTask | null = null;
      let cancelled = false;
      const promise = (async () => {
        const page = await pdf.getPage(index + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
      })().catch((err: unknown) => {
        // A superseded render is cancelled on purpose; anything else is a real failure.
        if (!(err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException')) throw err;
      });
      return {
        promise,
        cancel() {
          cancelled = true;
          task?.cancel();
        },
      };
    },
    destroy() {
      void loadingTask.destroy();
    },
  };
}
