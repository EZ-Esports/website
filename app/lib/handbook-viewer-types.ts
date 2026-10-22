/** A clickable box over a handbook page, in percent of the page's width/height. */
export interface HandbookLink {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Accessible name for the box (the link's visible text). */
  label: string;
  /** External target. Only http(s) and mailto are ever rendered; see `resolveHandbookLink`. */
  uri?: string;
  /** Zero-based page index for an in-document jump. */
  page?: number;
}

/** What the viewer needs to know about one page, whichever source produced it. */
export interface HandbookViewerPage {
  text: string;
  links: HandbookLink[];
  /** Width / height. Defaults to US Letter (612/792). */
  aspect: number;
}

export interface HandbookChapter {
  label: string;
  /** Zero-based page index. */
  page: number;
}
