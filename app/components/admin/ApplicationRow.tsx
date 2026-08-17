'use client';

import { useState, useTransition } from 'react';
import { updateApplicationStatus } from '@/app/(admin)/admin/applications/actions';

type Status = 'pending' | 'reviewed' | 'accepted' | 'rejected';
type StatusFilter = 'all' | Status;

interface Application {
  id: string;
  applicantName: string;
  schoolName: string;
  role: string;
  email: string;
  message: string | null;
  status: Status;
  submittedAt: Date;
}

const activeBadgeClass: Record<Status, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  reviewed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  accepted: 'bg-green-500/10 text-green-400 border border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function ApplicationRow({ app, activeFilter = 'all' }: { app: Application; activeFilter?: StatusFilter }) {
  const [status, setStatus] = useState<Status>(app.status);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const message = app.message ?? '';
  const isLong = message.length > 80;

  if (removed) return null;

  const handleStatusChange = (s: Status) => {
    const prev = status;
    setStatus(s);
    setActionError(null);
    startTransition(async () => {
      try {
        await updateApplicationStatus(app.id, s);
        if (activeFilter !== 'all' && s !== activeFilter) setRemoved(true);
      } catch {
        setStatus(prev);
        setActionError('Failed to update status. Please try again.');
      }
    });
  };

  return (
    <tr className="hover:bg-surface-raised/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{app.applicantName}</td>
      <td className="py-3 pr-4 text-foreground-secondary">{app.schoolName}</td>
      <td className="py-3 pr-4 text-foreground-secondary capitalize">{app.role}</td>
      <td className="py-3 pr-4">
        <a
          href={`mailto:${app.email}`}
          className="text-foreground-secondary hover:text-white transition-colors"
        >
          {app.email}
        </a>
      </td>
      <td className="py-3 pr-4 text-foreground-secondary max-w-[240px] whitespace-pre-line">
        {message ? (
          <>
            {expanded ? message : (isLong ? `${message.slice(0, 80)}…` : message)}
            {isLong && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="ml-1 text-foreground-muted hover:text-foreground-secondary transition-colors text-xs cursor-pointer"
              >
                {expanded ? '…less' : '…more'}
              </button>
            )}
          </>
        ) : (
          <span className="text-foreground-muted italic">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="flex gap-1">
          {(['pending', 'reviewed', 'accepted', 'rejected'] as const).map(s => (
            <button
              key={s}
              disabled={isPending || status === s}
              onClick={() => handleStatusChange(s)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-all cursor-pointer disabled:cursor-default ${
                status === s
                  ? activeBadgeClass[s]
                  : 'bg-line/50 text-foreground-muted border border-line hover:bg-line/50'
              }`}
            >
              {s}
            </button>
          ))}
          {actionError && (
            <span className="text-[10px] text-red-400 ml-1">{actionError}</span>
          )}
        </div>
      </td>
      <td className="py-3 text-foreground-secondary whitespace-nowrap">
        {new Date(app.submittedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </td>

    </tr>
  );
}
