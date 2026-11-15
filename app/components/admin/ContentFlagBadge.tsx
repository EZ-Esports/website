'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewContentFlag } from '@/app/(admin)/admin/schools/content-flag-actions';
import { chip, chipDot, secondaryBtnSm } from '@/app/components/admin/styles';
import type { ContentFlagView } from '@/app/lib/db/content-flags';

const LANGUAGE_LABEL = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * "Flagged info - overridden" marker for a person who ticked "This is actually my real information"
 * during onboarding, with the exact fields, values and match reasons behind it and a way to mark it
 * reviewed. `who` is the person's name, because the badge sits on a row that may show an in-game name.
 */
export default function ContentFlagBadge({ flag, who }: { flag: ContentFlagView; who: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reviewed = Boolean(flag.reviewedAt);

  function markReviewed() {
    setError(null);
    startTransition(async () => {
      const res = await reviewContentFlag(flag.id);
      if (!res.success) {
        setError(res.error ?? 'Could not mark this as reviewed.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <details className="group mt-1.5 text-xs">
      <summary
        className={`${chip(reviewed ? 'neutral' : 'warning', 'sm')} cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden`}
      >
        <span aria-hidden className={chipDot} />
        {reviewed ? 'Flagged info - reviewed' : 'Flagged info - overridden'}
      </summary>
      <div className="mt-2 space-y-2 rounded-lg bg-surface-raised p-3 text-foreground-secondary">
        <p>
          <span className="font-medium text-foreground">{who}</span> was warned that the following looked
          offensive and confirmed it is their real information on {formatWhen(flag.createdAt)} ({flag.inviteKind}{' '}
          onboarding).
        </p>
        <ul className="space-y-1">
          {flag.fields.map((f) => (
            <li key={f.field} className="break-words">
              <span className="font-medium text-foreground">{f.label}:</span> &ldquo;{f.value}&rdquo;
              {f.matchedTerms.length > 0 && (
                <span>
                  {' '}
                  (matched {f.matchedTerms.map((t) => `"${t}"`).join(', ')}
                  {f.languages.length > 0 ? `; ${f.languages.map(LANGUAGE_LABEL).join(', ')}` : ''})
                </span>
              )}
            </li>
          ))}
        </ul>
        {reviewed ? (
          <p>
            Reviewed{flag.reviewedBy ? ` by ${flag.reviewedBy}` : ''}
            {flag.reviewedAt ? ` on ${formatWhen(flag.reviewedAt)}` : ''}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={secondaryBtnSm} onClick={markReviewed} disabled={pending}>
              {pending ? 'Saving...' : 'Mark reviewed'}
            </button>
            {error && (
              <span role="alert" className="text-danger-on-tint">
                {error}
              </span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
