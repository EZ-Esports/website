'use client';

import { useState } from 'react';
import { Button as AriaButton, Disclosure, DisclosurePanel } from 'react-aria-components';
import { HiCheck, HiChevronDown, HiOutlineClock } from 'react-icons/hi2';
import { input, listStack, saveBtn, secondaryBtnSm } from '@/app/components/admin/styles';
import { AdminSpinner, PendingLabel } from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import { updatePageContent, restorePageContent } from './actions';

interface HistoryEntry {
  id: string;
  previousContent: string;
  savedAt: Date;
}

interface ContentEditorProps {
  id: string;
  label: string;
  contentKey: string;
  initialContent: string;
  history: HistoryEntry[];
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContentEditor({ id, label, contentKey, initialContent, history }: ContentEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentContent, setCurrentContent] = useState(initialContent);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setRestoreError(null);
    try {
      const res = await updatePageContent(id, formData);
      if (res && !res.success) {
        setSaveError(res.error || 'Save failed. Please try again.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (entry: HistoryEntry) => {
    setRestoringId(entry.id);
    setRestoreError(null);
    setSaveError(null);
    try {
      const res = await restorePageContent(id, entry.id);
      if (res && !res.success) {
        setRestoreError(res.error || 'Restore failed. Please try again.');
        return;
      }
      setCurrentContent(entry.previousContent);
      setShowHistory(false);
      setRestored(true);
      setTimeout(() => setRestored(false), 2000);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed. Please try again.');
    } finally {
      setRestoringId(null);
    }
  };

  // Sort most-recent-first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  const displayedHistory = sortedHistory.slice(0, 10);
  const hasMore = sortedHistory.length > 10;

  return (
    // History opens as a RAC Disclosure so it slides open and closed (same
    // height animation as the sidebar categories) instead of popping in.
    <Disclosure isExpanded={showHistory} onExpandedChange={setShowHistory} className="space-y-3">
      <div>
        {/* h2: each block is a top-level section directly under the page h1. */}
        <h2 id={`content-heading-${id}`} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          {label}
        </h2>
        <p className="mt-0.5 font-mono text-xs text-foreground-secondary">{contentKey}</p>
      </div>
      <form action={handleSubmit}>
        <label htmlFor={`content-${id}`} className="sr-only">
          {label}
        </label>
        <textarea
          id={`content-${id}`}
          name="content"
          value={currentContent}
          onChange={(e) => setCurrentContent(e.target.value)}
          rows={4}
          className={cx(input, 'resize-y leading-relaxed')}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} aria-busy={saving} className={saveBtn}>
            {saving ? (
              <>
                <AdminSpinner className="mr-1.5" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
          {saved && (
            <span role="status" className="admin-fade-in inline-flex items-center gap-1 text-xs font-medium text-success">
              <HiCheck aria-hidden className="h-4 w-4" /> Saved!
            </span>
          )}
          {saveError && (
            <span role="alert" aria-live="polite" className="admin-fade-in text-xs font-medium text-danger-on-tint">{saveError}</span>
          )}
          {restoreError && (
            <span role="alert" aria-live="polite" className="admin-fade-in text-xs font-medium text-danger-on-tint">{restoreError}</span>
          )}
          {restored && (
            <span role="status" className="admin-fade-in inline-flex items-center gap-1 text-xs font-medium text-success">
              <HiCheck aria-hidden className="h-4 w-4" /> Restored!
            </span>
          )}
          {history.length > 0 && (
            <AriaButton
              slot="trigger"
              className={({ isFocusVisible }) =>
                cx(
                  'ml-auto inline-flex items-center gap-1 rounded text-xs text-foreground-secondary hover:text-foreground transition-colors cursor-pointer outline-none',
                  isFocusVisible && 'ring-2 ring-accent/60',
                )
              }
            >
              <HiOutlineClock aria-hidden className="h-3.5 w-3.5" />
              {showHistory ? 'Hide' : 'History'} ({history.length})
              <HiChevronDown
                aria-hidden
                className={cx('h-3.5 w-3.5 transition-[rotate] duration-300 ease-out motion-reduce:transition-none', showHistory && 'rotate-180')}
              />
            </AriaButton>
          )}
        </div>
      </form>

      <DisclosurePanel className="h-(--disclosure-panel-height) overflow-clip transition-[height] duration-300 ease-out motion-reduce:transition-none">
        {displayedHistory.length > 0 && (
          <div className="space-y-2 pt-1">
            {hasMore && <p className="text-right text-xs text-foreground-secondary">Showing 10 most recent</p>}
            <ul className={cx(listStack, 'rounded-xl bg-surface-sunken/70')}>
              {displayedHistory.map((entry) => {
                const preview =
                  entry.previousContent.length > 120
                    ? entry.previousContent.slice(0, 120) + '…'
                    : entry.previousContent;

                return (
                  <li key={entry.id} className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                    <div className="min-w-0 space-y-1">
                      <p className="leading-relaxed text-foreground-secondary line-clamp-2">{preview}</p>
                      <span className="text-foreground-secondary">{formatDate(entry.savedAt)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {restoreError && restoringId === null && (
                        <span role="alert" aria-live="polite" className="text-xs font-medium text-danger-on-tint">
                          {restoreError}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRestore(entry)}
                        disabled={restoringId !== null}
                        aria-busy={restoringId === entry.id}
                        className={secondaryBtnSm}
                      >
                        <PendingLabel pending={restoringId === entry.id} label="Restore" pendingLabel="Restoring…" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </DisclosurePanel>
    </Disclosure>
  );
}
