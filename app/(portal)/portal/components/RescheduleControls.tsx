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
  PROPOSED_START_TIME_ET,
  canCancelRequest,
  canOpponentRespond,
  canRequesterRespond,
  isLateRequest,
  isOpenStatus,
  rescheduleStatusLabel,
  validateProposedTimes,
  type RescheduleOptionItem,
  type RescheduleProposer,
  type RescheduleRequestItem,
} from '@/app/lib/reschedule-rules';
import { canRequestReschedule, type SchoolMatchItem } from '@/app/lib/school-matches';
import {
  cancelReschedule,
  counterReschedule,
  requestReschedule,
  respondToReschedule,
  type RescheduleActionResult,
} from '@/app/lib/onboarding/reschedule-actions';
import { useStaffActing } from './StaffActing';

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
const LATE_NOTICE = 'p-3 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg';

function when(iso: string): string {
  const date = new Date(iso);
  return `${formatNY(date, 'date-short')}, ${formatNY(date, 'time')}`;
}

/** The status for a resolved request, saying who declined so the other school is not left guessing. */
function resolvedLabel(request: RescheduleRequestItem, match: SchoolMatchItem, iAmRequester: boolean): string {
  switch (request.status) {
    case 'declined_opponent':
      return iAmRequester ? `Declined by ${match.opponentName}` : 'You declined';
    case 'declined_requester':
      return iAmRequester ? 'You declined' : `Declined by ${request.requestedBySchoolName}`;
    case 'declined_staff':
      // Legacy rows only (spec-054): staff no longer decide reschedules.
      return 'Declined by EZ Esports staff';
    case 'approved':
      return 'Match rescheduled';
    default:
      return rescheduleStatusLabel(request.status);
  }
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
  const { confirmed } = useStaffActing();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A staff admin confirms "acting as <School>" before the action is sent (spec-055).
  const run = (action: () => Promise<RescheduleActionResult>) =>
    confirmed(() => {
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
    });
  return { pending, error, setError, run };
}

/** A proposal is a day: every match starts at 7:00 PM ET, so that time is added before parsing. */
function toProposedTime(day: string): string {
  return day ? `${day}T${PROPOSED_START_TIME_ET}` : '';
}

/** The 2 to 5 day pickers (every match starts at 7:00 PM ET) shared by a request and a counter-offer. */
function ProposedTimesFields({
  times,
  setTimes,
  hint,
}: {
  times: string[];
  setTimes: (next: string[]) => void;
  hint: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-zinc-300">Proposed dates (matches start at 7:00 PM ET)</legend>
      <p className="text-[11px] text-zinc-500">{hint}</p>
      {times.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="date"
            aria-label={`Proposed date ${index + 1}`}
            value={value}
            // Browsers let a date field take a 5 or 6 digit year; a value that long is ignored
            // so the field stays on a four-digit year.
            onChange={(e) => {
              if (/^\d{5,}-/.test(e.target.value)) return;
              setTimes(times.map((t, i) => (i === index ? e.target.value : t)));
            }}
            max="9999-12-31"
            required
            className={`${INPUT} flex-1`}
          />
          {times.length > MIN_PROPOSED_TIMES && (
            <button
              type="button"
              onClick={() => setTimes(times.filter((_, i) => i !== index))}
              aria-label={`Remove proposed date ${index + 1}`}
              className="text-xs text-zinc-400 hover:text-[#f4cccc] hover:underline cursor-pointer min-h-[44px] sm:min-h-0 px-1"
            >
              Remove
            </button>
          )}
        </div>
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
  );
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
      times.map((t) => parseEastern(toProposedTime(t))),
      new Date(),
      new Date(match.scheduledAt)
    );
    if (problem) return setError(problem);
    run(() => requestReschedule({ matchId: match.id, schoolId, reason, proposedTimes: times.map(toProposedTime) }));
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
              <p className={LATE_NOTICE}>
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
              <ProposedTimesFields
                times={times}
                setTimes={setTimes}
                hint={`Give at least ${MIN_PROPOSED_TIMES} times, an hour or more apart. ${match.opponentName} picks one, or suggests other times.`}
              />
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

/**
 * The answer to the other school's times. The opponent answers the requester's times (accept,
 * decline, or suggest their own); after a counter-offer the requester answers the opponent's
 * times (accept or decline, no second counter).
 */
function RespondDialog({ match, schoolId }: { match: SchoolMatchItem; schoolId: string }) {
  const request = match.reschedule!;
  const answeringCounter = canRequesterRespond(request.status);
  const proposer: RescheduleProposer = answeringCounter ? 'opponent' : 'requester';
  const choices = request.options.filter((o) => o.proposedBy === proposer);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'pick' | 'counter'>('pick');
  const [optionId, setOptionId] = useState('');
  const [times, setTimes] = useState<string[]>(['', '']);
  const { pending, error, setError, run } = useRescheduleAction(() => {
    setOpen(false);
    setMode('pick');
    setOptionId('');
    setTimes(['', '']);
  });

  const sendCounter = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateProposedTimes(
      times.map((t) => parseEastern(toProposedTime(t))),
      new Date(),
      new Date(match.scheduledAt)
    );
    if (problem) return setError(problem);
    const offered = new Set(request.options.map((o) => new Date(o.proposedAt).getTime()));
    if (times.some((t) => offered.has(parseEastern(toProposedTime(t)).getTime()))) {
      return setError('One of those dates was already proposed. Accept it instead.');
    }
    run(() => counterReschedule({ requestId: request.id, schoolId, proposedTimes: times.map(toProposedTime) }));
  };

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setMode('pick');
          setOptionId('');
        }
      }}
    >
      <Button className={PRIMARY_BUTTON}>Respond</Button>
      <Overlay isDismissable>
        <Modal className={MODAL_CLASS}>
          <Dialog
            className="outline-none space-y-4"
            aria-label={mode === 'counter' ? 'Suggest other times' : 'Respond to reschedule request'}
          >
            <div>
              <Heading className="font-bold text-white text-base">
                {mode === 'counter' ? 'Suggest other times' : answeringCounter ? 'Counter-offer' : 'Reschedule request'}
              </Heading>
              <p className="text-xs text-zinc-400">
                {answeringCounter
                  ? `${match.opponentName} suggested other times for your match`
                  : `${request.requestedBySchoolName} asks to move your match`}{' '}
                · currently {when(match.scheduledAt)}
              </p>
            </div>
            {request.isLate && !answeringCounter && <p className={LATE_NOTICE}>Made with under 72 hours’ notice, so you may accept or decline at your discretion.</p>}
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">{answeringCounter ? 'Your reason: ' : 'Reason: '}</span>
              {request.reason}
            </p>
            <ErrorNotice message={error} />

            {mode === 'pick' ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-zinc-300">
                    {answeringCounter ? `Pick one of ${match.opponentName}’s times (ET)` : 'Pick a new time (ET)'}
                  </legend>
                  {choices.map((option) => (
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
                  Once you accept, the match moves to that time right away, and neither school can go back
                  to the original time after that.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    isDisabled={pending}
                    onPress={() =>
                      run(() => respondToReschedule({ requestId: request.id, schoolId, accept: false }))
                    }
                    className={`${QUIET_BUTTON} data-[disabled]:opacity-50`}
                  >
                    Decline
                  </Button>
                  {!answeringCounter && (
                    <Button
                      isDisabled={pending}
                      onPress={() => {
                        setError(null);
                        setMode('counter');
                      }}
                      className={`${QUIET_BUTTON} data-[disabled]:opacity-50`}
                    >
                      Suggest other times
                    </Button>
                  )}
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
              </>
            ) : (
              <form onSubmit={sendCounter} className="space-y-4">
                <ProposedTimesFields
                  times={times}
                  setTimes={setTimes}
                  hint={`Give at least ${MIN_PROPOSED_TIMES} times, an hour or more apart. ${request.requestedBySchoolName} picks one or declines, and cannot suggest more.`}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    onPress={() => {
                      setError(null);
                      setMode('pick');
                    }}
                    className={QUIET_BUTTON}
                  >
                    Back
                  </Button>
                  <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} disabled:opacity-50`}>
                    {pending ? 'Sending…' : 'Send these times'}
                  </button>
                </div>
              </form>
            )}
          </Dialog>
        </Modal>
      </Overlay>
    </DialogTrigger>
  );
}

function OptionList({ title, options, acceptedId }: { title: string; options: RescheduleOptionItem[]; acceptedId: string | null }) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-zinc-300">{title}</p>
      <ul className="space-y-1.5">
        {options.map((option) => (
          <li
            key={option.id}
            className="flex min-h-[44px] sm:min-h-0 items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
          >
            {when(option.proposedAt)}
            {option.id === acceptedId && <span className="text-[10px] font-bold text-emerald-400">Agreed</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Read-only detail of a request this school is part of. A school that may cancel (see
 * `canCancelRequest`) does so from here, so cancelling is always a deliberate step after seeing
 * what was sent.
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
  const requesterOptions = request.options.filter((o) => o.proposedBy === 'requester');
  const counterOptions = request.options.filter((o) => o.proposedBy === 'opponent');

  const statusLine =
    request.status === 'pending_opponent'
      ? iAmRequester
        ? `Waiting for ${match.opponentName}`
        : `${request.requestedBySchoolName} requested a reschedule`
      : request.status === 'pending_requester'
        ? iAmRequester
          ? `${match.opponentName} suggested other times`
          : `Waiting for ${match.opponentName} to choose`
        : rescheduleStatusLabel(request.status);

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
              {statusLine}
            </p>
            {request.isLate && (
              <p className={LATE_NOTICE}>
                Made with under 72 hours’ notice, so the other school could accept or decline at their
                discretion.
              </p>
            )}
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Reason: </span>
              {request.reason}
            </p>
            <OptionList
              title={iAmRequester ? 'You proposed (ET)' : `${request.requestedBySchoolName} proposed (ET)`}
              options={requesterOptions}
              acceptedId={request.acceptedOptionId}
            />
            <OptionList
              title={iAmRequester ? `${match.opponentName} suggested (ET)` : 'You suggested (ET)'}
              options={counterOptions}
              acceptedId={request.acceptedOptionId}
            />
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
  const { isStaff } = useStaffActing();
  const request = match.reschedule;
  const iAmRequester = request?.requestedBySchoolId === schoolId;

  if (request && isOpenStatus(request.status)) {
    const accepted = request.options.find((o) => o.id === request.acceptedOptionId);
    // It is my turn when the opponent has to answer the requester, or the requester has to
    // answer a counter-offer.
    const myTurn =
      (canOpponentRespond(request.status) && !iAmRequester) ||
      (canRequesterRespond(request.status) && iAmRequester);
    const label =
      request.status === 'pending_opponent'
        ? iAmRequester
          ? `Waiting for ${match.opponentName}`
          : `${request.requestedBySchoolName} requested a reschedule`
        : request.status === 'pending_requester'
          ? iAmRequester
            ? `${match.opponentName} suggested other times`
            : `Waiting for ${match.opponentName} to choose`
          : rescheduleStatusLabel(request.status); // legacy `pending_staff` rows only
    // Before the opponent answers only the requester may cancel; after a counter-offer either may.
    const mayCancel =
      canCancelRequest(request.status) && (iAmRequester || request.status === 'pending_requester');
    return (
      <div className="space-y-1.5">
        <div className="text-zinc-300">{label}</div>
        {accepted && <div className="text-zinc-500">Agreed: {when(accepted.proposedAt)}</div>}
        {myTurn && !viewOnly ? (
          <RespondDialog match={match} schoolId={schoolId} />
        ) : (
          <ViewDialog match={match} schoolId={schoolId} canCancel={!viewOnly && mayCancel} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {request && request.status !== 'cancelled' && (
        <div className="text-zinc-400">
          {resolvedLabel(request, match, iAmRequester)}
          {request.status === 'approved' && match.rescheduledFrom && (
            <div className="text-zinc-500">Moved from {when(match.rescheduledFrom)}</div>
          )}
          {request.staffNote && <div className="text-zinc-500">{request.staffNote}</div>}
        </div>
      )}
      {/* Staff are exempt from the one-request-per-season limit (spec-039, spec-055). */}
      {!viewOnly &&
        canRequestReschedule(
          isStaff ? { ...match, rescheduleAllowanceUsed: false, rescheduledFrom: null } : match,
          now,
        ) && <RequestDialog match={match} schoolId={schoolId} now={now} />}
      {!viewOnly &&
        !isStaff &&
        !match.rescheduledFrom &&
        match.rescheduleAllowanceUsed &&
        canRequestReschedule({ ...match, rescheduleAllowanceUsed: false }, now) && (
          <div className="text-zinc-400">No reschedules remaining this season.</div>
        )}
    </div>
  );
}
