import type { Metadata } from 'next';
import HandbookViewer from '@/app/components/handbook/HandbookViewer';
import { getCachedHandbookPdfKey } from '@/app/lib/db/queries';
import { BUCKET, buildPublicObjectUrl } from '@/app/lib/storage-constants';
import { withDownloadName } from '@/app/lib/handbook-viewer';
import { HANDBOOK_DOWNLOAD_NAME } from '@/app/lib/handbook';
import { HANDBOOK_EDITION, HANDBOOK_GOOGLE_DOC_URL, HANDBOOK_LAST_MODIFIED } from '@/app/lib/handbook-pages';

// Layout appends the site name, so the title is just the page name.
export const metadata: Metadata = {
  title: 'Student Handbook',
  description:
    'The EZ Esports Student Handbook: key links, games, communities, the 2026-27 interschool league timeline, and our number one rule.',
};

// Re-render at most once a minute so a transient DB failure (which renders the
// bundled pages) cannot freeze this page until the next deploy.
export const revalidate = 60;

async function getHandbookPdfUrl(): Promise<string | null> {
  try {
    if (!process.env.DATABASE_URL) return null;
    const key = await getCachedHandbookPdfKey();
    return key ? buildPublicObjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, BUCKET, key) : null;
  } catch (error) {
    console.error('Failed to load handbook PDF', error);
    return null;
  }
}

/**
 * Public Student Handbook: a page viewer in the style of the leadership
 * pamphlet. Staff-uploaded PDF when one exists (rendered client-side with
 * pdf.js), otherwise the bundled 2026-27 pages.
 */
export default async function HandbookPage() {
  const pdfUrl = await getHandbookPdfUrl();

  return (
    <div className="bg-surface pt-6">
      <HandbookViewer
        pdfUrl={pdfUrl}
        downloadUrl={pdfUrl ? withDownloadName(pdfUrl, HANDBOOK_DOWNLOAD_NAME) : null}
        docsUrl={HANDBOOK_GOOGLE_DOC_URL}
        edition={HANDBOOK_EDITION}
        lastModified={HANDBOOK_LAST_MODIFIED}
      />
    </div>
  );
}
