'use client';

import { useState, useTransition } from 'react';
import { updateApplicationStatus, deleteApplication } from '@/app/(admin)/admin/applications/actions';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';

type Status = 'pending' | 'reviewed' | 'accepted';

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
};

export default function ApplicationRow({ app }: { app: Application }) {
  const [status, setStatus] = useState<Status>(app.status);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const message = app.message ?? '';
  const isLong = message.length > 80;

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{app.applicantName}</td>
      <td className="py-3 pr-4 text-slate-300">{app.schoolName}</td>
      <td className="py-3 pr-4 text-slate-300 capitalize">{app.role}</td>
      <td className="py-3 pr-4">
        <a
          href={`mailto:${app.email}`}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {app.email}
        </a>
      </td>
      <td className="py-3 pr-4 text-slate-400 max-w-[240px]">
        {message ? (
          <>
            {expanded ? message : (isLong ? `${message.slice(0, 80)}` : message)}
            {isLong && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="ml-1 text-slate-500 hover:text-slate-300 transition-colors text-xs cursor-pointer"
              >
                {expanded ? '…less' : '…more'}
              </button>
            )}
          </>
        ) : (
          <span className="text-zinc-600 italic">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="flex gap-1">
          {(['pending', 'reviewed', 'accepted'] as const).map(s => (
            <button
              key={s}
              disabled={isPending || status === s}
              onClick={() => {
                startTransition(() => updateApplicationStatus(app.id, s));
                setStatus(s);
              }}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-all cursor-pointer disabled:cursor-default ${
                status === s
                  ? activeBadgeClass[s]
                  : 'bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:bg-zinc-700/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </td>
      <td className="py-3 text-slate-400 whitespace-nowrap">
        {new Date(app.submittedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </td>
      <td className="py-3 pl-2">
        <ConfirmDeleteButton
          action={deleteApplication.bind(null, app.id)}
          message={`Delete application from ${app.applicantName} (${app.schoolName})? This cannot be undone.`}
          label="Delete"
          className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer whitespace-nowrap"
        />
      </td>
    </tr>
  );
}
