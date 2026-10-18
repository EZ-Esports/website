import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { getCachedHandbookPdfKey } from '@/app/lib/db/queries';
import { BUCKET, buildPublicObjectUrl } from '@/app/lib/storage-constants';
import {
  HANDBOOK_EDITION,
  HANDBOOK_GOOGLE_DOC_URL,
  HANDBOOK_LAST_MODIFIED,
  HANDBOOK_SECTIONS,
  type HandbookBlock,
  type HandbookInline,
} from '@/app/lib/handbook-content';

export const metadata: Metadata = {
  title: 'Student Handbook | EZ Esports',
  description:
    'The EZ Esports Student Handbook: key links, games, communities, the 2026-27 interschool league timeline, and our number one rule.',
};

const linkClass = 'text-accent underline underline-offset-2 hover:text-accent/80';

function Inline({ parts }: { parts: HandbookInline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return part;
        return part.href.startsWith('/') ? (
          <Link key={i} href={part.href} className={linkClass}>
            {part.text}
          </Link>
        ) : (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {part.text}
          </a>
        );
      })}
    </>
  );
}

function Block({ block }: { block: HandbookBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p>
          <Inline parts={block.content} />
        </p>
      );
    case 'note':
      return (
        <p className="text-sm text-foreground-muted">
          <Inline parts={block.content} />
        </p>
      );
    case 'list':
      return (
        <ul className="list-disc pl-6 space-y-2">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline parts={item} />
            </li>
          ))}
        </ul>
      );
    case 'timeline':
      return (
        <ol className="space-y-5 border-l border-line pl-5">
          {block.items.map((item, i) => (
            <li key={i}>
              <p className="text-sm font-bold text-foreground">{item.when}</p>
              <p className="mt-1">
                <Inline parts={item.content} />
              </p>
            </li>
          ))}
        </ol>
      );
  }
}

function HandbookText() {
  return (
    <div className="space-y-12">
      <nav aria-label="Handbook sections">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground-muted mb-3">Contents</p>
        <ol className="grid gap-2 sm:grid-cols-2 text-sm">
          {HANDBOOK_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-foreground-secondary hover:text-accent transition-colors">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {HANDBOOK_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24 space-y-4">
          <h2 id={`${section.id}-heading`} className="text-xl sm:text-2xl font-bold text-foreground">
            {section.title}
          </h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}

async function getHandbookPdfUrl(): Promise<string | null> {
  try {
    if (!process.env.DATABASE_URL) return null;
    const key = await getCachedHandbookPdfKey();
    return key ? buildPublicObjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, BUCKET, key) : null;
  } catch (error) {
    // The text version still answers the page if the CMS row cannot be read.
    console.error('Failed to load handbook PDF', error);
    return null;
  }
}

/**
 * Public Student Handbook. Staff upload a PDF in the admin content page; when
 * one exists it leads the page (download link + inline viewer) and the built-in
 * text version collapses beneath it. With no PDF the text version is the page.
 */
export default async function HandbookPage() {
  const pdfUrl = await getHandbookPdfUrl();

  return (
    <main>
      <Hero title="Student Handbook" subtitle={HANDBOOK_EDITION} backgroundImage="/images/hero-background.jpg" size="medium" />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-10 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          {pdfUrl ? (
            <>
              <Card padding="md" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-foreground">
                    <span className="font-bold">The current handbook</span> is below. Open it in its own tab or save a copy.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button href={pdfUrl} target="_blank" rel="noopener noreferrer" variant="primary" size="sm">
                      Open PDF
                    </Button>
                    <Button href={pdfUrl} download="EZ-Esports-Student-Handbook.pdf" variant="outline" size="sm">
                      Download PDF
                    </Button>
                  </div>
                </div>
                <iframe
                  src={`${pdfUrl}#view=FitH`}
                  title="EZ Esports Student Handbook (PDF)"
                  className="h-[75vh] min-h-[420px] w-full rounded-lg border border-line bg-surface-sunken"
                />
                <p className="text-xs text-foreground-muted">
                  Can’t see the viewer? Use{' '}
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Open PDF
                  </a>{' '}
                  instead, or{' '}
                  <a href={HANDBOOK_GOOGLE_DOC_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    read it in Google Docs
                  </a>
                  .
                </p>
              </Card>

              <details className="group rounded-2xl border border-line p-5">
                <summary className="cursor-pointer font-semibold text-foreground">Read the text version</summary>
                <p className="mt-3 mb-8 text-xs text-foreground-muted">
                  Text of the handbook as last edited {HANDBOOK_LAST_MODIFIED}. If it differs from the PDF above, the PDF is current.
                </p>
                <HandbookText />
              </details>
            </>
          ) : (
            <>
              <p className="text-xs text-foreground-muted uppercase tracking-wider">Last modified: {HANDBOOK_LAST_MODIFIED}</p>
              <HandbookText />
              <p className="text-xs text-foreground-muted">
                Prefer a document?{' '}
                <a href={HANDBOOK_GOOGLE_DOC_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Open the handbook in Google Docs
                </a>
                .
              </p>
            </>
          )}
        </div>
      </Section>
    </main>
  );
}
