'use client';

import { HiOutlineShieldCheck } from 'react-icons/hi2';

interface PortalHeaderProps {
  schoolName: string;
  /** Season(s) the manager is scoped to by their affiliation, e.g. "2026-27". */
  seasonLabel?: string;
  /** True when any of those seasons is a past season, which is view-only (spec-028). */
  hasPastSeason?: boolean;
  /** True when any of those seasons is inactive but upcoming (editable; staff prepare it ahead). */
  hasUpcomingSeason?: boolean;
  /** Page-level controls shown beside the compliance badge (the Tutorial menu). */
  actions?: React.ReactNode;
}

export function PortalHeader({ schoolName, seasonLabel, hasPastSeason, hasUpcomingSeason, actions }: PortalHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs uppercase font-bold tracking-widest text-[#f4cccc]">
            School Operations
          </span>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-xs text-zinc-400 font-medium">{schoolName}</span>
          {seasonLabel ? (
            <>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-xs text-zinc-300 font-medium">Season {seasonLabel}</span>
              {hasPastSeason ? (
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                  Past season &bull; View only
                </span>
              ) : null}
              {hasUpcomingSeason ? (
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
                  Upcoming season
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
          Manager Control Deck
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Issue personalized player invitations, review submitted applications, and verify tournament roster gates.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
        {actions}
        {/* Zero-PII Compliance Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          <HiOutlineShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-left">
            <p className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
              Zero-PII Vault Active
            </p>
            <p className="text-[11px] text-zinc-400">NY § 2-D & FERPA Compliant</p>
          </div>
        </div>
      </div>
    </div>
  );
}
