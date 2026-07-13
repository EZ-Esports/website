'use client';

import Link from 'next/link';
import { useActionState } from 'react';

const CATEGORIES = ['Announcement', 'Tournament', 'Partnership', 'Recognition', 'Update'];
const inputClass =
  'w-full px-4 py-2.5 bg-surface-sunken border border-line/80 rounded-lg text-white placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all text-sm';

type Result = { success?: boolean; error?: string } | void;

interface NewsPostFormProps {
  action: (formData: FormData) => Promise<Result>;
  /** 'new' for the create page, otherwise the existing post's status. */
  status: 'new' | 'draft' | 'published' | 'archived';
  defaults?: { title?: string; category?: string; excerpt?: string; content?: string };
}

export default function NewsPostForm({ action, status, defaults }: NewsPostFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success?: boolean; error?: string }, formData: FormData) =>
      (await action(formData)) ?? { success: true },
    {},
  );

  const draftBtn = 'px-5 py-2.5 bg-surface-raised border border-line hover:border-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
  const publishBtn = 'px-5 py-2.5 bg-accent text-on-accent hover:bg-accent/80 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label htmlFor="title" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
            Article Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={defaults?.title}
            placeholder="e.g. Spring 2025 Playoffs Schedule"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
            Category
          </label>
          <select id="category" name="category" required defaultValue={defaults?.category} className={`${inputClass} cursor-pointer`}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-surface-raised text-white">
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="excerpt" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
            Excerpt / Short Summary
          </label>
          <input
            id="excerpt"
            name="excerpt"
            type="text"
            defaultValue={defaults?.excerpt ?? ''}
            placeholder="e.g. A brief overview displayed in lists..."
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="content" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
            Content Body
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={12}
            defaultValue={defaults?.content}
            placeholder="Write your article content here..."
            className="w-full px-4 py-3 bg-surface-sunken border border-line/80 rounded-lg text-white placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-400">{state.error}</p>
      )}

      <div className="flex justify-end gap-3 border-t border-surface-raised pt-6 flex-wrap">
        <Link
          href="/admin/news"
          className="px-5 py-2.5 bg-surface-raised border border-line hover:border-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-white transition-all cursor-pointer"
        >
          Cancel
        </Link>

        {(status === 'new' || status === 'draft') && (
          <>
            <button type="submit" name="intent" value="draft" disabled={isPending} className={draftBtn}>
              {isPending ? 'Saving…' : status === 'new' ? 'Save as Draft' : 'Save Draft'}
            </button>
            <button type="submit" name="intent" value="publish" disabled={isPending} className={publishBtn}>
              {isPending ? 'Publishing…' : 'Publish'}
            </button>
          </>
        )}

        {status === 'published' && (
          <button type="submit" name="intent" value="publish" disabled={isPending} className={publishBtn}>
            {isPending ? 'Saving…' : 'Save & Keep Published'}
          </button>
        )}

        {status === 'archived' && (
          <button type="submit" name="intent" value="draft" disabled={isPending} className={draftBtn}>
            {isPending ? 'Saving…' : 'Save as Draft'}
          </button>
        )}
      </div>
    </form>
  );
}
