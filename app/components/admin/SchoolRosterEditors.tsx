'use client';

import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { FiCornerUpRight, FiPlus } from 'react-icons/fi';
import {
  createPlayer,
  createRoster,
  createTeam,
  deleteRoster,
  deleteRosterMember,
  moveRosterMember,
  updatePlayer,
  updateRoster,
} from '@/app/(admin)/admin/schools/[schoolId]/rosters/actions';
import { toHubDivision } from '@/app/lib/db/match-page';
import type { RosterEditOptions, RosterViewPlayer, RosterViewRoster, SeasonBlock } from '@/app/lib/school-roster-view';
import { AdminField, PendingLabel } from '@/app/components/admin/AdminUI';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import {
  cancelBtn,
  ghostBtnSm,
  input,
  primaryBtnSm,
  saveBtn,
  secondaryBtnSm,
  segmentedGroup,
  segmentedItem,
  selectClass,
} from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';
import { rosterRemovalConfirmMessage } from '@/app/lib/roster-removal-copy';
import { MAX_ROSTER_PLAYERS, moveBlockedReason, moveMenuItems } from '@/app/lib/onboarding/roster-limits';

type Result = { success: boolean; error?: string; [key: string]: unknown };

interface EditCtx {
  schoolId: string;
  options: RosterEditOptions;
  pending: boolean;
  /** Runs a server action, toasting the outcome. `onOk` fires only on success. */
  run: (action: () => Promise<Result>, successMessage: string, onOk?: () => void) => void;
  /** For callers that handle their own pending/error UI (ConfirmDeleteButton). */
  notify: (message: string) => void;
}

const Ctx = createContext<EditCtx | null>(null);
export const RosterEditProvider = Ctx.Provider;

function useEdit(): EditCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Roster editors must render inside RosterEditProvider');
  return ctx;
}

/** Hook used by the view to build the provider value. */
export function useRosterEditRunner(notifyToast: (message: string, type: 'success' | 'error') => void) {
  const [pending, startTransition] = useTransition();
  const run: EditCtx['run'] = (action, successMessage, onOk) => {
    startTransition(async () => {
      try {
        const res = await action();
        if (res?.success) {
          notifyToast(successMessage, 'success');
          onOk?.();
        } else {
          notifyToast(res?.error || 'Something went wrong.', 'error');
        }
      } catch {
        notifyToast('Something went wrong. Please try again.', 'error');
      }
    });
  };
  return { pending, run, notify: (m: string) => notifyToast(m, 'success') };
}

const ROLES = [
  { value: 'player', label: 'Player' },
  { value: 'captain', label: 'Captain' },
  { value: 'coach', label: 'Coach' },
  { value: 'sub', label: 'Sub' },
] as const;

function fd(form: HTMLFormElement) {
  return new FormData(form);
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="admin-fade-in mb-3 space-y-3 rounded-xl bg-surface-raised/50 p-3">
      {children}
    </section>
  );
}

function FormButtons({ submitLabel, pendingLabel, onCancel }: { submitLabel: string; pendingLabel: string; onCancel: () => void }) {
  const { pending } = useEdit();
  return (
    <div className="flex items-center gap-2">
      <button type="submit" disabled={pending} className={saveBtn}>
        <PendingLabel pending={pending} label={submitLabel} pendingLabel={pendingLabel} />
      </button>
      <button type="button" onClick={onCancel} className={cancelBtn}>
        Cancel
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- team */

/** "Register team" for this school: pick a game, then one of that game's seasons. */
export function RegisterTeamPanel() {
  const { schoolId, options, run, pending } = useEdit();
  const [open, setOpen] = useState(false);
  const [gameId, setGameId] = useState(options.games[0]?.id ?? '');
  const seasons = options.seasons.filter((s) => s.gameId === gameId);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = fd(e.currentTarget);
    run(() => createTeam(schoolId, data), 'Team registered.', () => setOpen(false));
  };

  return (
    <div>
      <button type="button" className={secondaryBtnSm} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <FiPlus aria-hidden /> Register team
      </button>
      {open && (
        <form onSubmit={submit} className="admin-fade-in mt-3 grid grid-cols-1 items-end gap-3 rounded-xl bg-admin-panel p-4 sm:grid-cols-[1fr_1fr_auto]">
          <AdminField label="Game">
            <select name="gameId" required value={gameId} onChange={(e) => setGameId(e.target.value)} className={selectClass}>
              {options.games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Season">
            <select name="seasonId" required key={gameId} defaultValue={seasons[0]?.id ?? ''} disabled={seasons.length === 0} className={selectClass}>
              {seasons.length === 0 ? (
                <option value="">No seasons for this game</option>
              ) : (
                seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (active)' : ''}</option>
                ))
              )}
            </select>
          </AdminField>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending || seasons.length === 0} className={saveBtn}>
              <PendingLabel pending={pending} label="Register" pendingLabel="Registering…" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className={cancelBtn}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- roster */

/** "Add roster" under a column header (or the tournament list); the division comes from the column. */
export function AddRosterControl({ block, division }: { block: SeasonBlock; division: 'Varsity' | 'JV' | 'All' }) {
  const { schoolId, run } = useEdit();
  const [open, setOpen] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = fd(e.currentTarget);
    run(() => createRoster(schoolId, data), 'Roster created.', () => setOpen(false));
  };
  return (
    <div>
      <button type="button" className={ghostBtnSm} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <FiPlus aria-hidden /> Add roster
      </button>
      {open && (
        <form onSubmit={submit} className="admin-fade-in mt-2 flex flex-wrap items-end gap-3 rounded-xl bg-surface-raised/50 p-3">
          <input type="hidden" name="teamId" value={block.teamId} />
          <input type="hidden" name="division" value={division} />
          <AdminField label="Roster name" required>
            <input name="name" required defaultValue={division === 'All' ? '' : division} className={cx(input, 'w-48')} />
          </AdminField>
          <FormButtons submitLabel="Create" pendingLabel="Creating…" onCancel={() => setOpen(false)} />
        </form>
      )}
    </div>
  );
}

/** Rename / change division, shown in place of the card header's usual actions. */
export function RosterEditForm({ roster, block, onClose }: { roster: RosterViewRoster; block: SeasonBlock; onClose: () => void }) {
  const { schoolId, run } = useEdit();
  const current = toHubDivision(roster.division);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = fd(e.currentTarget);
    run(() => updateRoster(schoolId, roster.id, data), 'Roster updated.', onClose);
  };
  return (
    <Panel label={`Edit roster ${roster.name}`}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <AdminField label="Roster name" required>
          <input name="name" required defaultValue={roster.name} className={cx(input, 'w-48')} />
        </AdminField>
        {block.layout === 'tournament' ? (
          <input type="hidden" name="division" value="All" />
        ) : (
          <AdminField label="Division">
            <select name="division" defaultValue={current} className={cx(selectClass, 'w-40')}>
              <option value="Varsity">Varsity</option>
              {(block.jvSupported || current === 'JV') && <option value="JV">JV</option>}
            </select>
          </AdminField>
        )}
        <FormButtons submitLabel="Save" pendingLabel="Saving…" onCancel={onClose} />
      </form>
    </Panel>
  );
}

export function DeleteRosterButton({ roster }: { roster: RosterViewRoster }) {
  const { schoolId, notify } = useEdit();
  return (
    <ConfirmDeleteButton
      label={`Delete roster ${roster.name}`}
      message={`Permanently delete roster "${roster.name}"? This removes ${roster.players.length === 1 ? 'its 1 player' : `its ${roster.players.length} players`} from the roster. Any of them who is on no other roster has their student record (profile, onboarding answers, consent form, linked accounts, used invite) deleted too, unless they are staff, a school manager or have match history. This cannot be undone. A roster that has matches cannot be deleted.`}
      action={async () => {
        const res = await deleteRoster(schoolId, roster.id);
        if (res.success) notify('Roster deleted.');
        return res;
      }}
    />
  );
}

/* -------------------------------------------------------------- player */

function RoleSelect({ defaultValue = 'player' }: { defaultValue?: string }) {
  return (
    <AdminField label="Role">
      <select name="role" defaultValue={defaultValue} className={cx(selectClass, 'w-36')}>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </AdminField>
  );
}

/** Add an existing school member, or create a new member and add them, to one roster. */
export function AddPlayerPanel({ roster, onClose }: { roster: RosterViewRoster; onClose: () => void }) {
  const { schoolId, options, run } = useEdit();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const onRoster = new Set(roster.players.map((p) => p.memberId));
  const eligible = options.members.filter((m) => !onRoster.has(m.id));

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = fd(e.currentTarget);
    data.set('rosterId', roster.id);
    // One server action, one transaction: a new member is only kept if the player is added too.
    run(() => createPlayer(schoolId, data), 'Player added.', onClose);
  };

  return (
    <Panel label={`Add player to ${roster.name}`}>
      <div role="group" aria-label="Who to add" className={segmentedGroup}>
        <button type="button" aria-pressed={mode === 'existing'} onClick={() => setMode('existing')} className={segmentedItem(mode === 'existing')}>
          Existing member
        </button>
        <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')} className={segmentedItem(mode === 'new')}>
          New member
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3" key={mode}>
        {mode === 'existing' ? (
          eligible.length === 0 ? (
            <p className="text-sm text-foreground-secondary">Every member of this school is already on this roster. Use New member to add someone else.</p>
          ) : (
            <AdminField label="Member" required>
              <select name="memberId" required defaultValue="" className={cx(selectClass, 'w-56')}>
                <option value="" disabled>Select member…</option>
                {eligible.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}{m.graduationYear ? ` ('${String(m.graduationYear).slice(-2)})` : ''}
                  </option>
                ))}
              </select>
            </AdminField>
          )
        ) : (
          <>
            <AdminField label="First name" required>
              <input name="firstName" required className={cx(input, 'w-36')} />
            </AdminField>
            <AdminField label="Last name" required>
              <input name="lastName" required className={cx(input, 'w-36')} />
            </AdminField>
            <AdminField label="Discord">
              <input name="discord" className={cx(input, 'w-40')} />
            </AdminField>
            <AdminField label="Class year">
              <input name="graduationYear" type="number" inputMode="numeric" placeholder="2027" className={cx(input, 'w-24')} />
            </AdminField>
          </>
        )}
        {(mode === 'new' || eligible.length > 0) && (
          <>
            <AdminField label="In-game name">
              <input name="ign" className={cx(input, 'w-40')} />
            </AdminField>
            <RoleSelect />
            <FormButtons submitLabel="Add player" pendingLabel="Adding…" onCancel={onClose} />
          </>
        )}
      </form>
    </Panel>
  );
}

/** Edit a player's role and IGN (this roster) plus the member's name, Discord and class year. */
export function PlayerEditForm({ player, rosterName, onClose }: { player: RosterViewPlayer; rosterName: string; onClose: () => void }) {
  const { schoolId, run } = useEdit();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = fd(e.currentTarget);
    run(() => updatePlayer(schoolId, player.id, data), 'Player updated.', onClose);
  };
  return (
    <form onSubmit={submit} aria-label={`Edit ${player.name} on ${rosterName}`} className="admin-fade-in flex flex-wrap items-end gap-3 py-2">
      <AdminField label="First name" required>
        <input name="firstName" required defaultValue={player.firstName} className={cx(input, 'w-32')} />
      </AdminField>
      <AdminField label="Last name" required>
        <input name="lastName" required defaultValue={player.lastName} className={cx(input, 'w-32')} />
      </AdminField>
      <AdminField label="In-game name">
        <input name="ign" defaultValue={player.ign ?? ''} className={cx(input, 'w-36')} />
      </AdminField>
      <AdminField label="Discord">
        <input name="discord" defaultValue={player.discord ?? ''} className={cx(input, 'w-36')} />
      </AdminField>
      <AdminField label="Class year">
        <input name="graduationYear" type="number" inputMode="numeric" defaultValue={player.graduationYear ?? ''} className={cx(input, 'w-24')} />
      </AdminField>
      <RoleSelect defaultValue={player.role} />
      <FormButtons submitLabel="Save" pendingLabel="Saving…" onCancel={onClose} />
    </form>
  );
}

export interface SiblingRoster {
  id: string;
  name: string;
  playerCount: number;
  subCount: number;
}

/**
 * Moves a player to the team's other roster(s). One sibling is a plain "Move to JV" button; more
 * than one (a team can have extra rosters) is a React Aria menu of the roster names. Staff are not
 * blocked by the season roster lock, so this is never disabled for that reason. The accessible
 * name starts with the visible text (label in name), then says whose row it is.
 */
function MovePlayerControl({ player, rosterName, siblings }: { player: RosterViewPlayer; rosterName: string; siblings: SiblingRoster[] }) {
  const playerIsSub = player.role === 'sub';
  const { schoolId, run, pending } = useEdit();
  if (siblings.length === 0) return null;
  const context = `${player.name} (currently ${rosterName})`;
  const move = (target: SiblingRoster) =>
    run(
      () => moveRosterMember(schoolId, player.id, target.id),
      `${player.name} moved to ${target.name}.`,
    );
  if (siblings.length === 1) {
    const [target] = siblings;
    // A full target is not offered: the button stays, disabled, and says why in its own text.
    const blocked = moveBlockedReason(target, playerIsSub);
    const visible = blocked ?? `Move to ${target.name}`;
    return (
      <button
        type="button"
        className={ghostBtnSm}
        disabled={pending || blocked !== null}
        aria-label={`${visible}: ${context}`}
        onClick={() => move(target)}
      >
        <FiCornerUpRight aria-hidden /> {visible}
      </button>
    );
  }
  return (
    <MenuTrigger>
      <Button
        isDisabled={pending || siblings.every((x) => moveBlockedReason(x, playerIsSub) !== null)}
        aria-label={`Move to…: ${context}`}
        className={ghostBtnSm}
      >
        <FiCornerUpRight aria-hidden /> Move to…
      </Button>
      <Popover className="admin-popover w-44" placement="bottom end">
        <Menu
          aria-label={`Move ${context} to`}
          onAction={(key) => {
            const target = siblings.find((x) => x.id === String(key));
            if (target) move(target);
          }}
          className="rounded-xl bg-surface-raised p-1 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
        >
          {moveMenuItems(siblings, playerIsSub).map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.text}
              isDisabled={item.isDisabled}
              className="flex min-h-11 w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm text-foreground-secondary outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[focused]:bg-surface data-[focused]:text-foreground sm:min-h-0"
            >
              {item.text}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function PlayerRowActions({
  player,
  rosterName,
  siblings = [],
  onEdit,
}: {
  player: RosterViewPlayer;
  rosterName: string;
  siblings?: SiblingRoster[];
  onEdit: () => void;
}) {
  const { schoolId, notify } = useEdit();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <MovePlayerControl player={player} rosterName={rosterName} siblings={siblings} />
      <RowIconButton kind="edit" label={`Edit player ${player.name}`} onClick={onEdit} />
      <ConfirmDeleteButton
        label={`Remove player ${player.name}`}
        message={rosterRemovalConfirmMessage(player.name, rosterName)}
        action={async () => {
          const res = await deleteRosterMember(schoolId, player.id);
          if (res.success) notify(('message' in res && res.message) || 'Player removed.');
          return res;
        }}
      />
    </div>
  );
}

export function AddPlayerButton({ open, onClick, full = false, playerCount = 0 }: { open: boolean; onClick: () => void; full?: boolean; playerCount?: number }) {
  return (
    <button type="button" className={primaryBtnSm} aria-expanded={open} disabled={full} onClick={onClick}>
      <FiPlus aria-hidden /> {full ? `Roster full (${playerCount}/${MAX_ROSTER_PLAYERS})` : 'Add player'}
    </button>
  );
}
