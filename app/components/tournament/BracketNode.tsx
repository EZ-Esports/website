'use client';

import type { BracketMatch, BracketParticipant } from '@/app/lib/bracket';
import Badge from '@/app/components/ui/Badge';
import { formatNY } from '@/app/lib/dates';
import { Overlay, Modal, Dialog } from '@/app/components/ui/overlay';
import { FiCalendar, FiClock, FiX, FiAward } from 'react-icons/fi';

interface BracketNodeProps {
  match: BracketMatch;
  onSelect?: (match: BracketMatch) => void;
}

function ParticipantRow({
  participant,
  isOpponentWinner,
}: {
  participant: BracketParticipant;
  isOpponentWinner: boolean;
}) {
  const isWinner = participant.isWinner;
  return (
    <div
      className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
        isWinner
          ? 'bg-accent/10 font-bold text-foreground'
          : isOpponentWinner
            ? 'opacity-65 text-foreground-muted'
            : 'text-foreground-secondary'
      }`}
    >
      <div className="min-w-0 pr-3 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs md:text-sm truncate font-black ${isWinner ? 'text-accent' : 'text-foreground'}`}>
            {participant.name}
          </span>
          {isWinner && <FiAward className="w-3.5 h-3.5 text-accent shrink-0" aria-label="Winner" />}
        </div>
        <div className="text-[10px] text-foreground-muted truncate">
          {participant.schoolName}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {participant.score !== null ? (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-black tabular-nums ${
              isWinner
                ? 'bg-accent text-white shadow-sm'
                : 'bg-surface-raised border border-line text-foreground-secondary'
            }`}
          >
            {participant.score}
          </span>
        ) : (
          <span className="text-[11px] text-foreground-muted font-bold">—</span>
        )}
      </div>
    </div>
  );
}

export function BracketNode({ match, onSelect }: BracketNodeProps) {
  const isCompleted = match.status.toLowerCase() === 'completed' || match.isForfeit;

  return (
    <div
      onClick={() => onSelect?.(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(match);
        }
      }}
      className="w-64 md:w-72 rounded-xl border border-line bg-surface-raised/70 backdrop-blur-sm overflow-hidden shadow-lg shadow-black/20 hover:border-accent/50 hover:bg-surface-raised transition-all cursor-pointer select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Node Header */}
      <div className="px-3.5 py-1.5 bg-surface-sunken/60 border-b border-line flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted">
        <span className="truncate pr-2">{match.roundName}</span>
        {match.isForfeit ? (
          <Badge variant="warning" size="sm">Forfeit</Badge>
        ) : isCompleted ? (
          <span className="text-foreground-secondary">Final</span>
        ) : (
          <span className="text-accent">{match.status}</span>
        )}
      </div>

      {/* Competitors */}
      <div className="divide-y divide-line/60">
        <ParticipantRow
          participant={match.participant1}
          isOpponentWinner={match.participant2.isWinner}
        />
        <ParticipantRow
          participant={match.participant2}
          isOpponentWinner={match.participant1.isWinner}
        />
      </div>
    </div>
  );
}

export function BracketMatchModal({
  match,
  onClose,
}: {
  match: BracketMatch | null;
  onClose: () => void;
}) {
  if (!match) return null;

  const dateObj = new Date(match.scheduledAt);
  const formattedDate = formatNY(dateObj, 'date-long');
  const formattedTime = formatNY(dateObj, 'time');

  return (
    <Overlay
      isOpen={match !== null}
      onOpenChange={(open) => !open && onClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <Modal className="w-full max-w-lg outline-none">
        <Dialog
          aria-label="Tournament match details"
          className="bg-surface-sunken border border-line rounded-2xl w-full overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 outline-none"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-accent/15 to-transparent border-b border-line px-6 py-5 flex items-center justify-between">
            <div>
              <Badge size="sm">{match.roundName}</Badge>
              <h4 className="text-lg font-black text-foreground mt-1 uppercase tracking-tight">Match Details</h4>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-surface-raised border border-line text-foreground-secondary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Versus Visualizer */}
          <div className="p-6 space-y-6">
            <div className="bg-surface-raised/40 border border-line rounded-xl p-5 flex items-center justify-between gap-3">
              {/* Participant 1 */}
              <div className="flex-1 text-center min-w-0">
                <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider mb-1 truncate">
                  {match.participant1.schoolName}
                </div>
                <div className={`text-base md:text-lg font-black truncate px-1 ${match.participant1.isWinner ? 'text-accent' : 'text-foreground'}`}>
                  {match.participant1.name}
                </div>
              </div>

              {/* Score Display */}
              <div className="flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                {match.participant1.score !== null && match.participant2.score !== null ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl md:text-3xl font-black ${match.participant1.isWinner ? 'text-accent' : 'text-foreground-secondary'}`}>
                      {match.participant1.score}
                    </span>
                    <span className="text-foreground-muted font-extrabold text-sm">-</span>
                    <span className={`text-2xl md:text-3xl font-black ${match.participant2.isWinner ? 'text-accent' : 'text-foreground-secondary'}`}>
                      {match.participant2.score}
                    </span>
                  </div>
                ) : (
                  <span className="text-foreground-muted font-black text-lg italic tracking-widest">VS</span>
                )}
                {match.isForfeit && (
                  <Badge variant="warning" size="sm" className="mt-1">Forfeit</Badge>
                )}
              </div>

              {/* Participant 2 */}
              <div className="flex-1 text-center min-w-0">
                <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider mb-1 truncate">
                  {match.participant2.schoolName}
                </div>
                <div className={`text-base md:text-lg font-black truncate px-1 ${match.participant2.isWinner ? 'text-accent' : 'text-foreground'}`}>
                  {match.participant2.name}
                </div>
              </div>
            </div>

            {/* Schedule Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-raised/40 border border-line rounded-xl p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-surface-raised border border-line text-accent/80 shrink-0">
                  <FiCalendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider">Date</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">{formattedDate}</div>
                </div>
              </div>

              <div className="bg-surface-raised/40 border border-line rounded-xl p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-surface-raised border border-line text-accent/80 shrink-0">
                  <FiClock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider">Time (ET)</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">{formattedTime}</div>
                </div>
              </div>
            </div>

            {match.notes && (
              <div className="bg-surface-raised/30 border border-line/60 rounded-xl p-3.5 text-xs text-foreground-secondary leading-relaxed">
                <span className="font-bold text-foreground block mb-0.5">Notes</span>
                {match.notes}
              </div>
            )}
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
