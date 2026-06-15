'use client';

import { useState } from 'react';
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
  const [showHistory, setShowHistory] = useState(false);
  const [currentContent, setCurrentContent] = useState(initialContent);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await updatePageContent(id, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Sort most-recent-first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  const displayedHistory = sortedHistory.slice(0, 10);
  const hasMore = sortedHistory.length > 10;

  return (
    <div className="bg-[#1a1a1a]/80 border border-zinc-800/80 rounded-2xl p-5 space-y-3 hover:border-zinc-700 transition-all duration-300">
      <div>
        <h3 className="font-bold text-white text-sm">{label}</h3>
        <p className="text-zinc-500 text-xs mt-0.5 font-mono">{contentKey}</p>
      </div>
      <form action={handleSubmit}>
        <textarea
          name="content"
          value={currentContent}
          onChange={(e) => setCurrentContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all resize-y font-sans leading-relaxed"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-ez-pink text-ez-black rounded-lg font-bold text-xs hover:bg-ez-pink/80 transition-all duration-300 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span className="text-green-400 text-xs font-semibold">Saved!</span>
          )}
          {saveError && (
            <span className="text-red-400 text-xs font-semibold">{saveError}</span>
          )}
          {restored && (
            <span className="text-green-400 text-xs font-semibold">Restored!</span>
          )}
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors underline-offset-2 hover:underline"
            >
              {showHistory ? 'Hide' : 'History'} ({history.length})
            </button>
          )}
        </div>
      </form>

      {showHistory && displayedHistory.length > 0 && (
        <div className="space-y-2 pt-1">
          {hasMore && (
            <p className="text-xs text-zinc-600 text-right">Showing 10 most recent</p>
          )}
          {displayedHistory.map((entry) => {
            const preview =
              entry.previousContent.length > 120
                ? entry.previousContent.slice(0, 120) + '…'
                : entry.previousContent;

            const restoreBound = restorePageContent.bind(null, id, entry.id);

            const handleRestore = async () => {
              try {
                await restoreBound();
                setCurrentContent(entry.previousContent);
                setShowHistory(false);
                setRestored(true);
                setTimeout(() => setRestored(false), 2000);
              } catch {
                // Server action failed — don't update UI state
              }
            };

            return (
              <div
                key={entry.id}
                className="bg-[#111111] border border-zinc-800/60 rounded-lg p-3 text-xs space-y-2"
              >
                <p className="text-zinc-400 font-mono leading-relaxed line-clamp-2">{preview}</p>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">{formatDate(entry.savedAt)}</span>
                  <button
                    type="button"
                    onClick={handleRestore}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-ez-pink/40 hover:text-ez-pink text-zinc-400 rounded text-xs font-bold transition-all cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
