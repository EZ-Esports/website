/**
 * Shared admin-panel class strings. These were previously copy-pasted per
 * component (RosterExplorer, LeagueSetupClient, ...) and had already started
 * to drift; new admin surfaces should import from here instead.
 */
export const input =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all';

export const primaryBtn =
  'px-4 py-2 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

export const secondaryBtn =
  'px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer';

export const iconBtn =
  'p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer';

export const selectClass =
  'px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 cursor-pointer';
