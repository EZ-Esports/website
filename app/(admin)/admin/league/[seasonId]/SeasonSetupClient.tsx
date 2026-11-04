'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button as AriaButton, Disclosure, DisclosurePanel } from 'react-aria-components';
import { FiEye, FiEyeOff, FiLink, FiList, FiLock, FiPlus, FiUnlock, FiUsers } from 'react-icons/fi';
import { HiChevronDown, HiOutlineAcademicCap } from 'react-icons/hi2';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import SchoolManagersModal from '@/app/components/admin/SchoolManagersModal';
import { AdminCount, AdminEmptyState, AdminField, AdminSection, AdminToast } from '@/app/components/admin/AdminUI';
import { chip, chipButton, focusRing, input, listStack, primaryBtn } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';
import { isValidSeasonName } from '@/app/lib/season-name';
import type { SeasonSetupData, SeasonSetupRoster, SeasonSetupSchool } from '@/app/lib/db/season-setup';
import { lockSeasonRosters, unlockSeasonRosters, publishSeasonOutcomes, hideSeasonOutcomes } from '../actions';
import { addSchoolToSeason } from '../season-schools-actions';

type ActionResult = { success: boolean; error?: string };
type ConfirmTarget =
  | { kind: 'lock'; locking: boolean }
  | { kind: 'publish'; publishing: boolean };

interface Props {
  /** Dates arrive as ISO strings (they cross the server -> client boundary). */
  season: Omit<SeasonSetupData['season'], 'rostersLockedAt' | 'outcomesFinalizedAt'> & {
    rostersLockedAt: string | null;
    outcomesFinalizedAt: string | null;
  };
  schools: SeasonSetupSchool[];
  availableSchools: Array<{ id: string; name: string }>;
  games: Array<{ id: string; displayName: string; slug: string }>;
  /** MANAGE_SCHOOLS: manager invites are written by the Schools actions, which check it again. */
  canInvite: boolean;
  /** MANAGE_ROSTERS: the roster editor page is gated on it. */
  canEditRosters: boolean;
  /** Matches page filtered to this season. */
  matchesHref: string;
}

export default function SeasonSetupClient({
  season,
  schools,
  availableSchools,
  games,
  canInvite,
  canEditRosters,
  matchesHref,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [inviteSchool, setInviteSchool] = useState<SeasonSetupSchool | null>(null);
  const [pickedSchool, setPickedSchool] = useState('');

  const locked = !!season.rostersLockedAt;
  const published = !!season.outcomesFinalizedAt;
  const label = `${season.gameName} ${season.name}`;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (type === 'success') setTimeout(() => setToast(null), 3500);
  };

  const run = (action: () => Promise<ActionResult>, successMsg: string): Promise<boolean> =>
    new Promise((resolve) => {
      startTransition(async () => {
        const res = await action();
        if (res?.success) showToast(successMsg);
        else showToast(res?.error || 'Something went wrong.', 'error');
        resolve(!!res?.success);
      });
    });

  const addSchool = (schoolId: string) => {
    if (!schoolId) return;
    startTransition(async () => {
      const res = await addSchoolToSeason({ seasonId: season.id, schoolId });
      if (!res.success) {
        showToast(res.error, 'error');
        return;
      }
      setPickedSchool('');
      const created = res.rostersCreated.length ? ` with ${res.rostersCreated.join(' and ')} rosters` : '';
      showToast(
        res.teamCreated
          ? `${res.schoolName} added${created}.`
          : res.rostersCreated.length
            ? `${res.schoolName}: created ${res.rostersCreated.join(' and ')} roster.`
            : `${res.schoolName} is already in this season.`,
      );
    });
  };

  const confirmCopy =
    confirm?.kind === 'lock'
      ? {
          title: `${confirm.locking ? 'Lock' : 'Unlock'} rosters for ${label}?`,
          message: confirm.locking
            ? `School managers will not be able to create, delete or change rosters (including emergency swaps) or approve players onto them until you unlock. Staff admins can still edit.${season.isActive ? '' : ' This season is inactive; managers whose affiliation names it are still locked out.'}`
            : 'School managers will be able to change rosters again.',
          confirmLabel: confirm.locking ? 'Lock rosters' : 'Unlock rosters',
          pendingLabel: confirm.locking ? 'Locking…' : 'Unlocking…',
          icon: confirm.locking ? <FiLock className="h-5 w-5" /> : <FiUnlock className="h-5 w-5" />,
        }
      : confirm?.kind === 'publish'
        ? {
            title: `${confirm.publishing ? 'Publish' : 'Unpublish'} season for ${label}?`,
            message: confirm.publishing
              ? 'The schedule, match results, standings, team records and champions for this season will become visible on the public site, the homepage and the archive. Publish once the season schedule and results are ready for the public.'
              : 'The schedule, match results, standings, team records and champions for this season will be removed from the public site. Team lists stay. Staff views are not affected.',
            confirmLabel: confirm.publishing ? 'Publish season' : 'Unpublish season',
            pendingLabel: confirm.publishing ? 'Publishing…' : 'Unpublishing…',
            icon: confirm.publishing ? <FiEye className="h-5 w-5" /> : <FiEyeOff className="h-5 w-5" />,
          }
        : null;

  const inviteable = isValidSeasonName(season.name);

  return (
    <div className="space-y-6">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {/* ============ SEASON CONTROLS ============ */}
      <AdminSection id="controls" title="Season controls" description="Both switches apply to this game and season only.">
        <dl className="divide-y divide-line/50">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                Rosters
                <span className={chip(locked ? 'warning' : 'neutral')}>
                  {locked && <FiLock aria-hidden className="h-3 w-3" />}
                  {locked ? 'Locked' : 'Open to managers'}
                </span>
              </dt>
              <dd className="mt-1 max-w-xl text-sm text-foreground-secondary">
                {locked
                  ? 'School managers cannot change rosters for this season. Staff can.'
                  : 'School managers can create, change and approve players onto rosters.'}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'lock', locking: !locked })}
              disabled={isPending}
              className={chipButton(locked ? 'warning' : 'ghost')}
              aria-label={locked ? `Unlock rosters for season ${season.name}` : `Lock rosters for season ${season.name}`}
            >
              {locked ? <FiUnlock aria-hidden className="h-3.5 w-3.5" /> : <FiLock aria-hidden className="h-3.5 w-3.5" />}
              {locked ? 'Unlock rosters' : 'Lock rosters'}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                Public results
                <span className={chip(published ? 'success' : 'neutral')}>
                  {published ? <FiEye aria-hidden className="h-3 w-3" /> : <FiEyeOff aria-hidden className="h-3 w-3" />}
                  {published ? 'Published' : 'Unpublished'}
                </span>
              </dt>
              <dd className="mt-1 max-w-xl text-sm text-foreground-secondary">
                {published
                  ? 'The schedule, scores, standings and records are visible on the public site.'
                  : 'The schedule, scores, standings and records stay hidden from the public until you publish.'}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'publish', publishing: !published })}
              disabled={isPending}
              className={chipButton(published ? 'ghost' : 'warning')}
              aria-label={published ? `Unpublish season ${season.name}` : `Publish season ${season.name}`}
            >
              {published ? <FiEyeOff aria-hidden className="h-3.5 w-3.5" /> : <FiEye aria-hidden className="h-3.5 w-3.5" />}
              {published ? 'Unpublish season' : 'Publish season'}
            </button>
          </div>
        </dl>
      </AdminSection>

      {/* ============ SCHOOLS AND ROSTERS ============ */}
      <AdminSection
        id="schools"
        variant="flush"
        title={<>Schools<AdminCount>{schools.length}</AdminCount></>}
        description="Adding a school registers its team for this season and creates its Varsity and JV rosters, so managers find them ready."
        actions={
          <Link href={matchesHref} className={chipButton('ghost')} title="Open Matches filtered to this season">
            <FiList aria-hidden className="h-3.5 w-3.5" />
            View matches
          </Link>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSchool(pickedSchool);
          }}
          aria-label="Add school to this season"
          className="grid grid-cols-1 items-end gap-3 border-b border-line/60 px-5 pb-5 md:grid-cols-[minmax(0,24rem)_auto]"
        >
          <AdminField label="School" help={availableSchools.length === 0 ? 'Every school is already in this season.' : undefined}>
            <select
              value={pickedSchool}
              onChange={(e) => setPickedSchool(e.target.value)}
              disabled={availableSchools.length === 0}
              className={input}
            >
              <option value="">Select a school…</option>
              {availableSchools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </AdminField>
          <button type="submit" disabled={isPending || !pickedSchool} className={primaryBtn}>
            <FiPlus aria-hidden /> Add school
          </button>
        </form>

        {schools.length === 0 ? (
          <AdminEmptyState
            compact
            icon={<HiOutlineAcademicCap />}
            title="No schools in this season yet."
            description="Add the first school above."
          />
        ) : (
          <ul className={listStack}>
            {schools.map((school) => (
              <SchoolItem
                key={school.teamId}
                school={school}
                gameSlug={season.gameSlug}
                isPending={isPending}
                canInvite={canInvite && inviteable}
                inviteNote={canInvite && !inviteable ? 'Invites need a season named YYYY-YY.' : undefined}
                canEditRosters={canEditRosters}
                onInvite={() => setInviteSchool(school)}
                onCreateMissing={() => addSchool(school.schoolId)}
              />
            ))}
          </ul>
        )}
      </AdminSection>

      {confirmCopy && (
        <ConfirmActionDialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          pendingLabel={confirmCopy.pendingLabel}
          isPending={isPending}
          icon={confirmCopy.icon}
          onConfirm={async () => {
            if (!confirm) return;
            if (confirm.kind === 'lock') {
              await run(
                () => (confirm.locking ? lockSeasonRosters(season.id) : unlockSeasonRosters(season.id)),
                confirm.locking ? 'Rosters locked.' : 'Rosters unlocked.',
              );
            } else {
              await run(
                () => (confirm.publishing ? publishSeasonOutcomes(season.id) : hideSeasonOutcomes(season.id)),
                confirm.publishing ? 'Season published.' : 'Season unpublished.',
              );
            }
            setConfirm(null);
          }}
        />
      )}

      {inviteSchool && (
        <SchoolManagersModal
          school={{ id: inviteSchool.schoolId, name: inviteSchool.schoolName }}
          games={games}
          seasonName={season.name}
          isOpen
          onOpenChange={(open) => {
            if (!open) setInviteSchool(null);
          }}
        />
      )}
    </div>
  );
}

function rosterSummary(r: SeasonSetupRoster): string {
  return `${r.name} · ${r.players.length} ${r.players.length === 1 ? 'player' : 'players'}`;
}

function SchoolItem({
  school,
  gameSlug,
  isPending,
  canInvite,
  inviteNote,
  canEditRosters,
  onInvite,
  onCreateMissing,
}: {
  school: SeasonSetupSchool;
  gameSlug: string;
  isPending: boolean;
  canInvite: boolean;
  inviteNote?: string;
  canEditRosters: boolean;
  onInvite: () => void;
  onCreateMissing: () => void;
}) {
  const playerTotal = school.rosters.reduce((n, r) => n + r.players.length, 0);

  return (
    <li className="px-5 py-3">
      <Disclosure>
        {({ isExpanded }) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AriaButton
                slot="trigger"
                className={({ isFocusVisible }) =>
                  cx(
                    'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none',
                    isFocusVisible && 'ring-2 ring-accent/60',
                  )
                }
              >
                <HiChevronDown
                  aria-hidden
                  className={cx('h-4 w-4 shrink-0 transition-[rotate] duration-200 motion-reduce:transition-none', isExpanded ? 'rotate-180 text-accent' : '-rotate-90 text-foreground-muted')}
                />
                <span className="truncate text-sm font-medium text-foreground">{school.schoolName}</span>
                <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
                  {school.rosters.map((r) => (
                    <span key={r.id} className={chip('neutral')}>{rosterSummary(r)}</span>
                  ))}
                  {school.missing.map((d) => (
                    <span key={d} className={chip('warning')}>No {d} roster</span>
                  ))}
                </span>
                <span className="sr-only">{playerTotal} players across {school.rosters.length} rosters</span>
              </AriaButton>
              <div className="flex flex-wrap items-center gap-2">
                {school.missing.length > 0 && (
                  <button type="button" onClick={onCreateMissing} disabled={isPending} className={chipButton('warning')}>
                    Create missing rosters
                  </button>
                )}
                {canInvite && (
                  <button
                    type="button"
                    onClick={onInvite}
                    className={chipButton('ghost')}
                    aria-label={`Manager invite links for ${school.schoolName}`}
                    title="Create or review manager invite links for this season"
                  >
                    <FiLink aria-hidden className="h-3.5 w-3.5" />
                    Manager invites
                  </button>
                )}
                {inviteNote && <span className="text-xs text-foreground-secondary">{inviteNote}</span>}
                {canEditRosters && (
                  <Link
                    href={`/admin/schools/${school.schoolId}/rosters?game=${encodeURIComponent(gameSlug)}`}
                    className={cx(chipButton('ghost'), focusRing)}
                    aria-label={`Edit rosters for ${school.schoolName}`}
                    title="Add, move and remove players in the roster editor"
                  >
                    <FiUsers aria-hidden className="h-3.5 w-3.5" />
                    Edit rosters
                  </Link>
                )}
              </div>
            </div>
            <DisclosurePanel>
              <div className="grid grid-cols-1 gap-4 pb-2 pl-6 pt-2 md:grid-cols-2">
                {school.rosters.length === 0 && (
                  <p className="text-sm text-foreground-secondary">No rosters yet.</p>
                )}
                {school.rosters.map((r) => (
                  <section key={r.id} aria-label={`${school.schoolName} ${r.name} roster`} className="rounded-lg bg-surface-sunken/60 p-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-foreground-secondary">
                      {r.name}
                      <span className="ml-1.5 font-normal normal-case tracking-normal tabular-nums">{r.players.length}</span>
                    </h4>
                    {r.players.length === 0 ? (
                      <p className="mt-2 text-sm text-foreground-secondary">No players yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                        {r.players.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            {p.role !== 'player' && <span className={`${chip('neutral')} capitalize`}>{p.role}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
    </li>
  );
}
