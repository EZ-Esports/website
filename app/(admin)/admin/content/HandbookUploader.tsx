'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiCheck } from 'react-icons/hi2';
import { AdminSpinner } from '@/app/components/admin/AdminUI';
import { input, saveBtn } from '@/app/components/admin/styles';
import { checkHandbookFile, HANDBOOK_ACCEPT } from '@/app/lib/handbook';
import { cx } from '@/app/lib/cx';
import { saveHandbookPdf } from './actions';

interface HandbookUploaderProps {
  /** Public URL of the live handbook PDF, or null when none has been uploaded. */
  currentUrl: string | null;
}

/**
 * Replace-in-place PDF upload for the public /handbook page. Two steps, same
 * shape as gallery images: the file goes to /api/handbook (storage), then a
 * server action records it as live, so a failed upload never clobbers the
 * current handbook.
 */
export default function HandbookUploader({ currentUrl }: HandbookUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0] ?? null;
    setDone(false);
    const problem = checkHandbookFile(file);
    if (problem || !file) {
      setError(problem ?? 'Choose a PDF to upload.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/handbook', { method: 'POST', body });
      const json = (await res.json().catch(() => ({}))) as { storageKey?: string; error?: string };
      if (!res.ok || !json.storageKey) {
        setError(json.error ?? 'Upload failed. Please try again.');
        return;
      }
      const saved = await saveHandbookPdf(json.storageKey);
      if (!saved.success) {
        setError(saved.error || 'Save failed. Please try again.');
        return;
      }
      if (inputRef.current) inputRef.current.value = '';
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <h2 id="handbook-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          Student Handbook PDF
        </h2>
        <p className="mt-0.5 text-xs text-foreground-secondary">
          Export the handbook document as a PDF (4 MB max) and upload it. It replaces the previous file and appears on{' '}
          <span className="font-medium text-accent">the Student Handbook page</span> as a page viewer (with search, zoom and Download PDF).
          Until one is uploaded, that page shows the bundled 2026-27 pages.
        </p>
      </div>

      <p className="text-sm text-foreground-secondary">
        {currentUrl ? (
          <>
            Current file:{' '}
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
              Open live PDF
            </a>
          </>
        ) : (
          'No PDF uploaded yet. The page is showing the bundled 2026-27 pages.'
        )}
      </p>

      <div>
        <label htmlFor="handbook-file" className="sr-only">
          Handbook PDF file
        </label>
        <input
          ref={inputRef}
          id="handbook-file"
          type="file"
          accept={HANDBOOK_ACCEPT}
          onChange={() => {
            setError(null);
            setDone(false);
          }}
          className={cx(input, 'cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent/15 file:px-3 file:py-1 file:text-xs file:font-medium file:text-accent')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={saveBtn}>
          {busy ? (
            <>
              <AdminSpinner className="mr-1.5" />
              Uploading…
            </>
          ) : currentUrl ? (
            'Replace PDF'
          ) : (
            'Upload PDF'
          )}
        </button>
        {done && (
          <span role="status" className="admin-fade-in inline-flex items-center gap-1 text-xs font-medium text-success">
            <HiCheck aria-hidden className="h-4 w-4" /> Published!
          </span>
        )}
        {error && (
          <span role="alert" className="admin-fade-in text-xs font-medium text-danger-on-tint">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
