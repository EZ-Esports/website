'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AdminField, AdminFormActions, AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';
import { ghostBtn, input, primaryBtn, secondaryBtn } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';

const CATEGORIES = ['Announcement', 'Tournament', 'Partnership', 'Recognition', 'Update'];
const inputClass = input;

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

  return (
    <form action={formAction} className="space-y-5" aria-busy={isPending}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <AdminField label="Article title" htmlFor="title" required className="md:col-span-2">
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={defaults?.title}
            placeholder="e.g. Spring 2025 Playoffs Schedule"
            className={inputClass}
          />
        </AdminField>

        <AdminField label="Category" htmlFor="category" required>
          <select id="category" name="category" required defaultValue={defaults?.category} className={cx(inputClass, 'cursor-pointer')}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField
          label="Excerpt / short summary"
          htmlFor="excerpt"
          help="Shown under the title in news lists."
          className="md:col-span-2"
        >
          <input
            id="excerpt"
            name="excerpt"
            type="text"
            defaultValue={defaults?.excerpt ?? ''}
            placeholder="e.g. A brief overview displayed in lists..."
            className={inputClass}
          />
        </AdminField>

        <AdminField label="Content body" htmlFor="content" required className="md:col-span-2">
          <textarea
            id="content"
            name="content"
            required
            rows={12}
            defaultValue={defaults?.content}
            placeholder="Write your article content here..."
            className={cx(inputClass, 'resize-y font-mono leading-relaxed')}
          />
        </AdminField>
      </div>

      {state?.error && <AdminNotice tone="danger">{state.error}</AdminNotice>}

      {/* Secondary actions left of the primary one; Cancel is the quietest. */}
      <AdminFormActions>
        <Link href="/admin/news" className={ghostBtn}>
          Cancel
        </Link>

        {(status === 'new' || status === 'draft') && (
          <>
            <button type="submit" name="intent" value="draft" disabled={isPending} className={secondaryBtn}>
              <PendingLabel pending={isPending} label={status === 'new' ? 'Save as draft' : 'Save draft'} pendingLabel="Saving…" />
            </button>
            <button type="submit" name="intent" value="publish" disabled={isPending} className={primaryBtn}>
              <PendingLabel pending={isPending} label="Publish" pendingLabel="Publishing…" />
            </button>
          </>
        )}

        {status === 'published' && (
          <button type="submit" name="intent" value="publish" disabled={isPending} className={primaryBtn}>
            <PendingLabel pending={isPending} label="Save & keep published" pendingLabel="Saving…" />
          </button>
        )}

        {status === 'archived' && (
          <button type="submit" name="intent" value="draft" disabled={isPending} className={primaryBtn}>
            <PendingLabel pending={isPending} label="Save as draft" pendingLabel="Saving…" />
          </button>
        )}
      </AdminFormActions>
    </form>
  );
}
