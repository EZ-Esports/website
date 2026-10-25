'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, DialogTrigger } from 'react-aria-components';
import { Dialog, Heading, Modal, Overlay } from '@/app/components/ui/overlay';
import { formatNY, parseEastern } from '@/app/lib/dates';
import {
  MAX_PROPOSED_TIMES,
  MAX_REASON_LENGTH,
  MIN_PROPOSED_TIMES,
  canCancelRequest,
  canOpponentRespond,
  isLateRequest,
  isOpenStatus,
  rescheduleStatusLabel,
  validateProposedTimes,
} from '@/app/lib/reschedule-rules';
import { canRequestReschedule, type SchoolMatchItem } from '@/app/lib/school-matches';
import {
  cancelReschedule,
  requestReschedule,
  respondToReschedule,
  type RescheduleActionResult,
} from '@/app/lib/onboarding/reschedule-actions';

interface RescheduleCellProps {
  match: SchoolMatchItem;
  /** The school whose portal is open: the side that requests, responds or cancels. */
  schoolId: string;
  now: Date;
  /** The match's game is on an inactive (view-only) season for this manager. */
  viewOnly: boolean;
}

const BUTTON =
  'min-h-[44px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer';
const PRIMARY_BUTTON = `${BUTTON} bg-[#f4cccc] text-zinc-950 hover:bg-[#f4cccc]/90`;
const QUIET_BUTTON = `${BUTTON} text-zinc-300 border border-zinc-700 hover:bg-zinc-800`;
const INPUT =
  'w-full min-h-[44px] sm:min-h-0 px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]';
const MODAL_CLASS =
  'w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl';

function when(iso: string): string {
  const date = new Date(iso);
  return `${formatNY(date, 'date-short')}, ${formatNY(date, 'time')}`;
}

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg">
      {message}
    </p>
  );
}

/** Runs an action, refreshes the server-rendered portal on success, and reports a failure inline. */
function useRescheduleAction(onDone?: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<RescheduleActionResult>) => {
    setError(null);
    start(async () => {
      try {
        const result = await action();
        if (!result.success) {
          setError(result.error ?? 'Something went wrong.');
          return;
        }
        onDone?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    });
  };
  return { pending, error, setError, run };
}

function RequestDialog({ match, schoolId, now }: { match: SchoolMatchItem; schoolId: string; now: Date }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [times, setTimes] = useState<string[]>(['', '']);
  const { pending, error, setError, run } = useRescheduleAction(() => {
    setOpen(false);
    setReason('');
    setTimes(['', '']);
  });
  const late = isLateRequest(new Date(match.scheduledAt), now);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError('Explain why the match needs to move.');
    const problem = validateProposedTimes(
      times.map((t) => parseEastern(t)),
      new Date(),
      new Date(match.scheduledAt)
    );
    if (problem) return setError(problem);
    run(() => requestReschedule({ matchId: match.id, schoolId, reason, proposedTimes: times }));
  };

  return (
    <DialogTrigger isOpen={open} onOpenChange={(next) => (setOpen(next), next || setError(null))}>
      <Button className={PRIMARY_BUTTON}>Request reschedule</Button>
      <Overlay isDismissable>
        <Modal className={MODAL_CLASS}>
          <Dialog className="outline-none space-y-4" aria-label="Request a reschedule">
            <div>
              <Heading className="font-bold text-white text-base">Request a reschedule</Heading>
              <p className="text-xs text-zinc-400">
                vs {match.opponentName} · {when(match.scheduledAt)}
              </p>
            </div>
            {late && (
              <p className="p-3 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg">
                This is under 72 hours before the match, so {match.opponentName} may accept or decline
                at their discretion.
              </p>
            )}
            <ErrorNotice message={error} />
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor={`reason-${match.id}`} className="block text-xs font-semibold text-zinc-300 mb-1">
                  Reason
                </label>
                <textarea
                  id={`reason-${match.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={MAX_REASON_LENGTH}
                  rows={3}
                  required
                  className={INPUT}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-zinc-300">
                  Proposed times (Eastern Time, ET)
                </legend>
                <p className="text-[11px] text-zinc-500">
                  Give at least {MIN_PROPOSED_TIMES} times, an hour or more apart. {match.opponentName} picks one.
                </p>
                {times.map((value, index) => (
                  <input
                    key={index}
                    type="datetime-local"
                    aria-label={`Proposed time ${index + 1}`}
                    value={value}
                    onChange={(e) => setTimes(times.map((t, i) => (i === index ? e.target.value : t)))}
                    required
                    className={INPUT}
                  />
                ))}
                {times.length < MAX_PROPOSED_TIMES && (
                  <button
                    type="button"
                    onClick={() => setTimes([...times, ''])}
                    className="text-xs text-[#f4cccc] hover:underline cursor-pointer min-h-[44px] sm:min-h-0"
                  >
                    Add another time
                  </button>
                )}
              </fieldset>
              <div className="flex flex-wrap justify-end gap-2">
                <Button onPress={() => setOpen(false)} className={QUIET_BUTTON}>
                  Cancel
                </Button>
                <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} disabled:opacity-50`}>
                  {pending ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

function RespondDialog({ match, schoolId }: { match: SchoolMatchItem; schoolId: string }) {
  const request = match.reschedule!;
  const [open, setOpen] = useState(false);
  const [optionId, setOptionId] = useState('');
  const { pending, error, setError, run } = useRescheduleAction(() => setOpen(false));

  return (
    <DialogTrigger isOpen={open} onOpenChange={(next) => (setOpen(next), next || setError(null))}>
      <Button className={PRIMARY_BUTTON}>Respond</Button>
      <Overlay isDismissable>
        <Modal className={MODAL_CLASS}>
          <Dialog className="outline-none space-y-4" aria-label="Respond to reschedule request">
            <div>
              <Heading className="font-bold text-white text-base">Reschedule request</Heading>
              <p className="text-xs text-zinc-400">
                {request.requestedBySchoolName} asks to move your match · currently {when(match.scheduledAt)}
              </p>
            </div>
            {request.isLate && (
              <p className="p-3 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg">
                Made with under 72 hours’ notice, so you may accept or decline at your discretion.
              </p>
            )}
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Reason: </span>
              {request.reason}
            </p>
            <ErrorNotice message={error} />
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-zinc-300">Pick a new time (ET)</legend>
              {request.options.map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-200 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`option-${request.id}`}
                    value={option.id}
                    checked={optionId === option.id}
                    onChange={() => setOptionId(option.id)}
                  />
                  {when(option.proposedAt)}
                </label>
              ))}
            </fieldset>
            <p className="text-[11px] text-zinc-500">
              Once you accept, staff still have to approve it, and neither school can go back to the
              original time after that.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                isDisabled={pending}
                onPress={() => run(() => respondToReschedule({ requestId: request.id, schoolId, accept: false }))}
                className={QUIET_BUTTON}
              >
                Decline
              </Button>
              <Button
                isDisabled={pending || !optionId}
                onPress={() =>
                  run(() => respondToReschedule({ requestId: request.id, schoolId, accept: true, optionId }))
                }
                className={`${PRIMARY_BUTTON} data-[disabled]:opacity-50`}
              >
                {pending ? 'Saving…' : 'Accept this time'}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

/**
 * Read-only detail of a request this school is part of. The requester can cancel from here while
 * the opponent has not answered, so cancelling is always a deliberate step after seeing what was sent.
 */
function ViewDialog({
  match,
  schoolId,
  canCancel,
}: {
  match: SchoolMatchItem;
  schoolId: string;
  canCancel: boolean;
}) {
  const request = match.reschedule!;
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useRescheduleAction(() => setOpen(false));
  const iAmRequester = request.requestedBySchoolId === schoolId;

  return (
    <DialogTrigger isOpen={open} onOpenChange={(next) => (setOpen(next), next || setError(null))}>
      <Button className={QUIET_BUTTON}>View request</Button>
      <Overlay isDismissable>
        <Modal className={MODAL_CLASS}>
          <Dialog className="outline-none space-y-4" aria-label="Reschedule request details">
            <div>
              <Heading className="font-bold text-white text-base">
                {iAmRequester ? 'Your reschedule request' : 'Reschedule request'}
              </Heading>
              <p className="text-xs text-zinc-400">
                vs {match.opponentName} · currently {when(match.scheduledAt)}
              </p>
            </div>
            <p className="text-sm text-zinc-200">
              {request.status === 'pending_opponent'
                ? iAmRequester
                  ? `Waiting for ${match.opponentName}`
                  : `${request.requestedBySchoolName} requested a reschedule`
                : rescheduleStatusLabel(request.status)}
              {request.status === 'pending_staff' && (
                <span className="block text-xs text-zinc-400">
                  {match.opponentName} agreed. EZ Esports staff still have to approve it.
                </span>
              )}
            </p>
            {request.isLate && (
              <p className="p-3 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg">
                Made with under 72 hours’ notice, so the other school could accept or decline at their
                discretion.
              </p>
            )}
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Reason: </span>
              {request.reason}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-300">Proposed times (ET)</p>
              <ul className="space-y-1.5">
                {request.options.map((option) => (
                  <li
                    key={option.id}
                    className="flex min-h-[44px] sm:min-h-0 items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
                  >
                    {when(option.proposedAt)}
                    {option.id === request.acceptedOptionId && (
                      <span className="text-[10px] font-bold text-emerald-400">Agreed</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <ErrorNotice message={error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button onPress={() => setOpen(false)} className={QUIET_BUTTON}>
                Close
              </Button>
              {canCancel && (
                <Button
                  isDisabled={pending}
                  onPress={() => run(() => cancelReschedule({ requestId: request.id, schoolId }))}
                  className={`${BUTTON} text-rose-300 border border-rose-800/60 hover:bg-rose-950/40 data-[disabled]:opacity-50`}
                >
                  {pending ? 'Cancelling…' : 'Cancel request'}
                </Button>
              )}
            </div>
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

/**
 * The reschedule column of an Upcoming row: what the latest request is doing and the one action
 * this school can take on it. The server enforces every rule again; this only decides what to show.
 */
export function RescheduleCell({ match, schoolId, now, viewOnly }: RescheduleCellProps) {
  const request = match.reschedule;
  const iAmRequester = request?.requestedBySchoolId === schoolId;

  if (request && isOpenStatus(request.status)) {
    const accepted = request.options.find((o) => o.id === request.acceptedOptionId);
    const waitingForMe = !iAmRequester && canOpponentRespond(request.status);
    return (
      <div className="space-y-1.5">
        <div className="text-zinc-300">
          {request.status === 'pending_staff'
            ? 'Waiting for staff'
            : iAmRequester
              ? `Waiting for ${match.opponentName}`
              : `${request.requestedBySchoolName} requested a reschedule`}
        </div>
        {accepted && <div className="text-zinc-500">Agreed: {when(accepted.proposedAt)}</div>}
        {waitingForMe && !viewOnly ? (
          <RespondDialog match={match} schoolId={schoolId} />
        ) : (
          <ViewDialog
            match={match}
            schoolId={schoolId}
            canCancel={!viewOnly && iAmRequester && canCancelRequest(request.status)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {request && request.status !== 'cancelled' && (
        <div className="text-zinc-400">
          {rescheduleStatusLabel(request.status)}
          {request.status === 'approved' && match.rescheduledFrom && (
            <div className="text-zinc-500">Moved from {when(match.rescheduledFrom)}</div>
          )}
          {request.staffNote && <div className="text-zinc-500">{request.staffNote}</div>}
        </div>
      )}
      {!viewOnly && canRequestReschedule(match, now) && (
        <RequestDialog match={match} schoolId={schoolId} now={now} />
      )}
    </div>
  );
}
