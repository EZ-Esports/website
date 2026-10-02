'use client';

import { HiOutlineShieldCheck } from 'react-icons/hi2';

interface PortalHeaderProps {
  schoolName: string;
}

export function PortalHeader({ schoolName }: PortalHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold tracking-widest text-[#f4cccc]">
            School Operations
          </span>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-xs text-zinc-400 font-medium">{schoolName}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
          Manager Control Deck
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Issue personalized player invitations, review submitted applications, and verify tournament roster gates.
        </p>
      </div>

      {/* Zero-PII Compliance Badge */}
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 self-start md:self-auto">
        <HiOutlineShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="text-left">
          <p className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
            Zero-PII Vault Active
          </p>
          <p className="text-[11px] text-zinc-400">NY § 2-D & FERPA Compliant</p>
        </div>
      </div>
    </div>
  );
}
