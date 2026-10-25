'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveReschedule, declineReschedule } from '@/app/(admin)/admin/matches/reschedule-actions';
import { formatNY } from '@/app/lib/dates';
import { MAX_STAFF_NOTE_LENGTH, type StaffRescheduleItem } from '@/app/lib/reschedule-rules';
import { cx } from '@/app/lib/cx';
import { AdminCount, AdminSection } from './AdminUI';
import { dangerBtn, fieldError, input, label, primaryBtn } from './styles';

function when(iso: string): string {
  const date = new Date(iso);
  return `${formatNY(date, 'date-short')}, ${formatNY(date, 'time')}`;
}

function RequestRow({ item }: { item: StaffRescheduleItem }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noteId = `reschedule-note-${item.id}`;

  const decide = (action: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-white">
          {item.homeSchoolName} vs {item.awaySchoolName}
        </p>
        <span className="text-xs text-foreground-secondary">
          {item.gameName} · {item.seasonName}
        </span>
        {item.isLate && (
          <span className="rounded bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            Late request
          </span>
        )}
      </div>
      <p className="text-sm text-foreground-secondary">
        <span className="tabular-nums">{when(item.currentScheduledAt)}</span>
        <span aria-hidden className="px-2">→</span>
        <span className="sr-only"> moves to </span>
        <span className="font-semibold tabular-nums text-white">{when(item.newScheduledAt)}</span>
        <span className="px-2">·</span>
        requested by {item.requestedBySchoolName}, accepted by the other school
      </p>
      <p className="text-sm text-foreground-secondary">
        <span className="font-medium text-white">Reason: </span>
        {item.reason}
      </p>
      <div>
        <label htmlFor={noteId} className={label}>
          Note (required to decline)
        </label>
        <input
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_STAFF_NOTE_LENGTH}
          className={cx(input, 'max-w-xl')}
        />
        {error && (
          <p role="alert" className={fieldError}>
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(() => approveReschedule(item.id, note))}
          className={cx(primaryBtn, 'max-sm:h-11')}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(() => declineReschedule(item.id, note))}
          className={cx(dangerBtn, 'max-sm:h-11')}
        >
          Decline
        </button>
      </div>
    </li>
  );
}

/**
 * Reschedule requests the opponent has accepted and staff still decide. Approving moves the match
 * and tells both managers through the portal; the match keeps its time until then. Renders nothing
 * when the queue is empty so the Matches page stays a work queue for results.
 */
export default function RescheduleQueue({ items }: { items: StaffRescheduleItem[] }) {
  if (items.length === 0) return null;
  return (
    <AdminSection
      id="reschedule-requests"
      title={
        <>
          Reschedule requests<AdminCount>{items.length}</AdminCount>
        </>
      }
      description="Both schools agreed on a new time. Approve to move the match."
    >
      <ul className="divide-y divide-line/50">
        {items.map((item) => (
          <RequestRow key={item.id} item={item} />
        ))}
      </ul>
    </AdminSection>
  );
}
