'use client';

import type { TournamentMatch } from '@/app/types/tournament';
import Badge from '@/app/components/ui/Badge';
import { formatNY } from '@/app/lib/dates';
import { Overlay, Modal, Dialog } from '@/app/components/ui/overlay';
import { FiCalendar, FiClock, FiX, FiAward } from 'react-icons/fi';

interface BracketMatchModalProps {
  match: TournamentMatch | null;
  onClose: () => void;
}

export function BracketMatchModal({ match, onClose }: BracketMatchModalProps) {
  if (!match) return null;

  const isCompleted = match.status.toLowerCase() === 'completed' || match.isForfeit;
  const isScheduled = match.status.toLowerCase() === 'scheduled';

  const dateStr = formatNY(match.scheduledAt, 'date-long');
  const timeStr = formatNY(match.scheduledAt, 'time');

  return (
    <Overlay isOpen={true} onOpenChange={(open) => !open && onClose()} isDismissable>
      <Modal>
        <Dialog className="w-full max-w-lg rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-accent">
                  {match.roundName}
                </span>
                {match.bracketGroup && (
                  <span className="text-[11px] text-foreground-muted font-bold">
                    • {match.bracketGroup}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-foreground tracking-tight">Match Details</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors cursor-pointer"
              aria-label="Close match details"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="my-6 space-y-3">
            {[match.home, match.away].map((p, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                  p.isWinner
                    ? 'border-accent/40 bg-accent/10 shadow-sm'
                    : 'border-line/70 bg-surface-sunken/40'
                }`}
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-black truncate ${p.isWinner ? 'text-accent' : 'text-foreground'}`}>
                      {p.playerTitle}
                    </span>
                    {p.isWinner && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent px-1.5 py-0.5 rounded bg-accent/20">
                        <FiAward className="w-3 h-3" /> Winner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-muted font-medium truncate mt-0.5">
                    {p.schoolName || 'Independent Participant'}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {p.score !== null ? (
                    <span
                      className={`inline-block px-3 py-1 rounded-lg text-sm font-black tabular-nums ${
                        p.isWinner
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-surface-raised border border-line text-foreground-secondary'
                      }`}
                    >
                      {p.score}
                    </span>
                  ) : (
                    <span className="text-xs text-foreground-muted font-bold">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-line/70 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <FiCalendar className="w-3.5 h-3.5 text-foreground-muted" />
                {dateStr}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <FiClock className="w-3.5 h-3.5 text-foreground-muted" />
                {timeStr}
              </span>
            </div>

            <div>
              {match.isForfeit ? (
                <Badge variant="warning" size="sm">Forfeited</Badge>
              ) : isCompleted ? (
                <Badge variant="neutral" size="sm">Final</Badge>
              ) : isScheduled ? (
                <Badge variant="accent" size="sm">Scheduled</Badge>
              ) : (
                <Badge variant="neutral" size="sm">{match.status}</Badge>
              )}
            </div>
          </div>

          {match.notes && (
            <div className="mt-4 p-3 rounded-xl bg-surface-sunken/40 border border-line/50 text-xs text-foreground-secondary">
              <span className="font-bold text-foreground-muted uppercase tracking-wider text-[10px] block mb-1">
                Notes
              </span>
              {match.notes}
            </div>
          )}
        </Dialog>
      </Modal>
    </Overlay>
  );
}

/**
 * Lightweight fixture card for group stage round-robin matches.
 */
export function GroupFixtureCard({
  match,
  onSelect,
}: {
  match: TournamentMatch;
  onSelect: (match: TournamentMatch) => void;
}) {
  return (
    <div
      onClick={() => onSelect(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(match);
        }
      }}
      className="p-3.5 rounded-xl border border-line bg-surface-raised/60 hover:bg-surface-raised hover:border-accent/40 transition-all cursor-pointer select-none space-y-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted">
        <span>{match.roundName}</span>
        {match.isForfeit ? (
          <Badge variant="warning" size="sm">Forfeit</Badge>
        ) : (
          <span className="text-foreground-secondary">Final</span>
        )}
      </div>

      <div className="space-y-1.5">
        {[match.home, match.away].map((p, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="min-w-0 pr-2">
              <span className={`font-black truncate block ${p.isWinner ? 'text-accent' : 'text-foreground'}`}>
                {p.playerTitle}
              </span>
              <span className="text-[10px] text-foreground-muted truncate block">
                {p.schoolName}
              </span>
            </div>
            <span className={`font-black tabular-nums px-2 py-0.5 rounded text-xs ${
              p.isWinner ? 'bg-accent text-white' : 'text-foreground-secondary'
            }`}>
              {p.score ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
