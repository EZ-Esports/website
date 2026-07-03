'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface SeasonOption {
  name: string;
  isActive: boolean;
}

interface SeasonSelectProps {
  /** Page the selector navigates within, e.g. "/valorant/schedule". */
  basePath: string;
  seasons: SeasonOption[];
  selected: string;
  /** Query params to preserve across season changes (division, sort, ...). */
  extraParams?: Record<string, string>;
}

/** Season dropdown that navigates via the `season` query param. */
export default function SeasonSelect({ basePath, seasons, selected, extraParams = {} }: SeasonSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (season: string) => {
    const params = new URLSearchParams(extraParams);
    params.set('season', season);
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Season</span>
      <select
        value={selected}
        onChange={(e) => navigate(e.target.value)}
        disabled={isPending}
        className="px-3 py-2.5 min-h-[44px] text-sm font-bold rounded-lg bg-slate-900 border border-slate-800/80 text-slate-200 hover:border-slate-700 focus:border-ez-pink/60 focus:outline-none transition-all cursor-pointer disabled:opacity-60"
      >
        {seasons.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name}
            {s.isActive ? ' (current)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
