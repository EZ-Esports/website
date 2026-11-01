'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, DialogTrigger, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';
import { Dialog, Heading, Modal, Overlay } from '@/app/components/ui/overlay';
import { formatNY } from '@/app/lib/dates';
import { validateGameLinks } from '@/app/lib/match-results/parse-match-ref';
import { canSubmitGameResult, type SchoolMatchItem } from '@/app/lib/school-matches';
import {
  cancelPendingResult,
  getMatchScoreboardAction,
  retryMatchResult,
  submitMatchResult,
  type MatchResultActionResult,
} from '@/app/lib/onboarding/match-result-actions';
import type { MatchScoreboard } from '@/app/lib/db/match-results';

const BUTTON =
  'min-h-[44px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer';
const PRIMARY_BUTTON = `${BUTTON} bg-[#f4cccc] text-zinc-950 hover:bg-[#f4cccc]/90`;
const QUIET_BUTTON = `${BUTTON} text-zinc-300 border border-zinc-700 hover:bg-zinc-800`;
const INPUT =
  'w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]';
const MODAL_CLASS =
  'w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl';
const WIDE_MODAL_CLASS =
  'w-full max-w-4xl rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl';
const TAB_CLASS =
  'min-h-[44px] px-4 flex items-center text-sm font-semibold cursor-pointer outline-none ' +
  'text-zinc-500 border-b-2 border-transparent transition-colors ' +
  'data-[hovered]:text-zinc-300 data-[selected]:text-white data-[selected]:border-accent ' +
  'data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-accent';

function ErrorList({ message, errors }: { message: string | null; errors: string[] }) {
  if (!message && errors.length === 0) return null;
  return (
    <div role="alert" className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg space-y-1">
      {message && <p>{message}</p>}
      {errors.length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Runs a result action, refreshes the portal on success and keeps the message and per-game problems. */
function useResultAction(onSuccess?: (result: MatchResultActionResult) => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const reset = () => {
    setMessage(null);
    setErrors([]);
  };
  const run = (action: () => Promise<MatchResultActionResult>) => {
    reset();
    start(async () => {
      try {
        const result = await action();
        if (!result.success) {
          setMessage(result.error ?? 'Something went wrong.');
          setErrors(result.errors ?? []);
          // A pending save changes what the row shows even though the call "failed".
          if (result.pending) router.refresh();
          return;
        }
        onSuccess?.(result);
        router.refresh();
      } catch {
        setMessage('Something went wrong. Please try again.');
      }
    });
  };
  return { pending, message, errors, reset, run, setMessage, setErrors };
}

const GAME_FIELDS = [
  { label: 'Game 1 link', optional: false },
  { label: 'Game 2 link', optional: false },
  { label: 'Game 3 link (only if a deciding game was played)', optional: true },
] as const;

function SubmitDialog({ match, schoolId }: { match: SchoolMatchItem; schoolId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<string[]>(['', '', '']);
  const [fieldErrors, setFieldErrors] = useState<(string | null)[]>([null, null, null]);
  const clear = () => {
    setLinks(['', '', '']);
    setFieldErrors([null, null, null]);
  };
  const { pending, message, errors, reset, run } = useResultAction(() => {
    setOpen(false);
    clear();
  });

  const setLink = (index: number, value: string) => {
    setLinks((prev) => prev.map((v, i) => (i === index ? value : v)));
    setFieldErrors((prev) => prev.map((v, i) => (i === index ? null : v)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Same parser the server uses, so a typo is caught before a network round trip.
    const checked = validateGameLinks(links);
    setFieldErrors(checked.fieldErrors);
    if (!checked.ok) {
      reset();
      return;
    }
    run(() => submitMatchResult({ matchId: match.id, schoolId, input: checked.input }));
  };

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          clear();
        }
      }}
    >
      <Button className={PRIMARY_BUTTON}>Submit result</Button>
      <Overlay isDismissable>
        <Modal className={MODAL_CLASS}>
          <Dialog className="outline-none space-y-4" aria-label="Submit match result">
            <div>
              <Heading className="font-bold text-white text-base">Submit the result</Heading>
              <p className="text-xs text-zinc-400">
                vs {match.opponentName} · {formatNY(new Date(match.scheduledAt), 'date-short')}
              </p>
            </div>
            <ErrorList message={message} errors={errors} />
            <form onSubmit={submit} noValidate className="space-y-4">
              {GAME_FIELDS.map((field, index) => {
                const id = `game-${index + 1}-${match.id}`;
                const error = fieldErrors[index];
                return (
                  <div key={id}>
                    <label htmlFor={id} className="block text-xs font-semibold text-zinc-300 mb-1">
                      {field.label}
                    </label>
                    <input
                      id={id}
                      type="text"
                      value={links[index]}
                      onChange={(e) => setLink(index, e.target.value)}
                      required={!field.optional}
                      spellCheck={false}
                      autoComplete="off"
                      inputMode="url"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      placeholder="Match ID or https://tracker.gg/valorant/match/…"
                      className={`${INPUT} min-h-[44px] sm:min-h-0 font-mono text-xs`}
                    />
                    {error && (
                      <p id={`${id}-error`} className="mt-1 text-[11px] text-rose-400">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-zinc-500">
                Best of 3: give games 1 and 2, and game 3 only if it went the distance. Matches are only kept
                for a limited time, so submit soon after playing. Both teams must be on the rosters with their
                Riot IDs.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button onPress={() => setOpen(false)} className={QUIET_BUTTON}>
                  Cancel
                </Button>
                <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} disabled:opacity-50`}>
                  {pending ? 'Checking…' : 'Submit result'}
                </button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

function PendingNotice({ match, schoolId, viewOnly }: { match: SchoolMatchItem; schoolId: string; viewOnly: boolean }) {
  const pendingResult = match.pendingResult!;
  const router = useRouter();
  const { pending, message, errors, run } = useResultAction();
  // Discarding drops the saved IDs, so it asks first (in-app dialog, never a native confirm).
  const discard = useConfirmAction<null>(async () => {
    const result = await cancelPendingResult({ matchId: match.id, schoolId });
    if (result.success) router.refresh();
    return result;
  }, 'Could not discard the saved match IDs.');
  const guarded = (action: () => void) => () => {
    if (!pending) action();
  };
  return (
    <div className="space-y-2 max-w-[14rem]">
      <div role="status" aria-live="polite" className="space-y-2">
        <p className="text-[11px] leading-snug text-amber-300">
          Waiting on the match data service. {pendingResult.gameCount} of the submitted games saved so far.
        </p>
        <ErrorList message={message} errors={errors} />
      </div>
      {!viewOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-disabled={pending}
            onClick={guarded(() => run(() => retryMatchResult({ matchId: match.id, schoolId })))}
            className={`${PRIMARY_BUTTON} aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
          >
            {pending ? 'Checking…' : 'Check again'}
          </button>
          <button
            type="button"
            aria-disabled={pending}
            onClick={guarded(() => discard.request(null))}
            className={`${QUIET_BUTTON} aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
          >
            Discard
          </button>
        </div>
      )}
      <ConfirmActionDialog
        {...discard.dialogProps}
        appearance="portal"
        tone="danger"
        title="Discard saved match IDs?"
        message={`The ${match.pendingResult?.gameCount ?? 0} saved games stay stored, but you will need to paste the match IDs again to submit a result.`}
        confirmLabel="Discard"
        pendingLabel="Discarding…"
      />
    </div>
  );
}

const PLAYER_COLS = ['Player', 'Agent', 'ACS', 'K', 'D', 'A', 'K/D', 'HS%', 'Damage'];

function TeamTable({ team }: { team: MatchScoreboard['games'][number]['teams'][number] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[34rem] text-left text-xs">
        <caption className="px-3 py-2 text-left text-sm font-bold text-white bg-zinc-950/60">
          {team.schoolName}{' '}
          <span className={team.won ? 'text-emerald-400' : 'text-zinc-500'}>
            {team.rounds} rounds{team.won ? ' · Won' : ''}
          </span>
        </caption>
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-800">
            {PLAYER_COLS.map((c) => (
              <th key={c} scope="col" className={`py-2 px-3 font-semibold ${c === 'Player' || c === 'Agent' ? '' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {team.players.map((p) => (
            <tr key={p.puuid}>
              <td className="py-2 px-3 text-white whitespace-nowrap">
                {p.name}
                <span className="text-zinc-500">#{p.tag}</span>
                {p.isMatchMvp && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 text-[10px] font-bold">MVP</span>
                )}
                {p.isTeamMvp && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold">Team MVP</span>
                )}
              </td>
              <td className="py-2 px-3 text-zinc-300">{p.agent}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.acs}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.kills}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.deaths}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.assists}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.kdRatio.toFixed(2)}</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.headshotPct}%</td>
              <td className="py-2 px-3 text-right text-zinc-200">{p.damageDealt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scoreboard({ scoreboard }: { scoreboard: MatchScoreboard }) {
  return (
    <div className="space-y-4">
      <p className="text-lg font-bold text-white">
        {scoreboard.homeSchoolName} {scoreboard.homeWins}
        <span className="text-zinc-500"> – </span>
        {scoreboard.awayWins} {scoreboard.awaySchoolName}
      </p>
      <Tabs>
        <TabList aria-label="Games" className="flex overflow-x-auto border-b border-zinc-800">
          {scoreboard.games.map((g) => (
            <Tab key={g.gameNumber} id={`g${g.gameNumber}`} className={TAB_CLASS}>
              Game {g.gameNumber} · {g.mapName}
            </Tab>
          ))}
        </TabList>
        {scoreboard.games.map((g) => (
          <TabPanel key={g.gameNumber} id={`g${g.gameNumber}`} className="pt-4 space-y-3 outline-none">
            <p className="text-xs text-zinc-400">
              {g.mapName} · {g.teams[0].rounds}–{g.teams[1].rounds} · {g.rounds} rounds ·{' '}
              {formatNY(new Date(g.startedAt), 'date-short')}
            </p>
            <TeamTable team={g.teams[0]} />
            <TeamTable team={g.teams[1]} />
          </TabPanel>
        ))}
      </Tabs>
      <p className="text-[11px] text-zinc-500">
        ACS is score divided by rounds played. MVP is the top scorer on the winning team and Team MVP the top
        scorer on the other; both are calculated by EZ Esports.
      </p>
    </div>
  );
}

function ScoreboardDialog({ match, schoolId }: { match: SchoolMatchItem; schoolId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, start] = useTransition();
  const [scoreboard, setScoreboard] = useState<MatchScoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (scoreboard) return;
    setError(null);
    start(async () => {
      const result = await getMatchScoreboardAction({ matchId: match.id, schoolId });
      if (result.success) setScoreboard(result.scoreboard);
      else setError(result.error);
    });
  };

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <Button className={QUIET_BUTTON}>Scoreboard</Button>
      <Overlay isDismissable>
        <Modal className={WIDE_MODAL_CLASS}>
          <Dialog className="outline-none space-y-4" aria-label="Match scoreboard">
            <div className="flex items-start justify-between gap-3">
              <Heading className="font-bold text-white text-base">Scoreboard</Heading>
              <Button onPress={() => setOpen(false)} className={QUIET_BUTTON}>
                Close
              </Button>
            </div>
            {loading && !scoreboard && <p className="text-xs text-zinc-400">Loading…</p>}
            <ErrorList message={error} errors={[]} />
            {scoreboard && <Scoreboard scoreboard={scoreboard} />}
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

interface ResultCellProps {
  match: SchoolMatchItem;
  schoolId: string;
  /** The match's game is on an inactive (view-only) season for this manager. */
  viewOnly: boolean;
}

/** The result actions for one match: submit, check again, or open the scoreboard. */
export function ResultActions({ match, schoolId, viewOnly }: ResultCellProps) {
  if (match.gameCount > 0) {
    return <ScoreboardDialog match={match} schoolId={schoolId} />;
  }
  if (match.pendingResult) {
    return <PendingNotice match={match} schoolId={schoolId} viewOnly={viewOnly} />;
  }
  if (!viewOnly && canSubmitGameResult(match)) {
    return <SubmitDialog match={match} schoolId={schoolId} />;
  }
  return null;
}
