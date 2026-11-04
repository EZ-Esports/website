'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FiEye, FiEyeOff, FiLink, FiList, FiLock, FiPlus, FiUnlock } from 'react-icons/fi';
import { HiOutlineAcademicCap } from 'react-icons/hi2';
import SchoolCrest from '@/app/components/admin/SchoolCrest';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import SchoolManagersModal from '@/app/components/admin/SchoolManagersModal';
import { AdminCount, AdminEmptyState, AdminField, AdminSection, AdminToast } from '@/app/components/admin/AdminUI';
import { chip, chipButton, focusRing, input, primaryBtn } from '@/app/components/admin/styles';
import { seasonSchoolHref } from '@/app/lib/admin-season-filters';
import { cx } from '@/app/lib/cx';
import { isValidSeasonName } from '@/app/lib/season-name';
import { planSchoolRosters, rosterNamesPhrase } from '@/app/lib/season-schools';
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
  /** Matches page filtered to this season. */
  matchesHref: string;
}

export default function SeasonSetupClient({
  season,
  schools,
  availableSchools,
  games,
  canInvite,
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
      const phrase = rosterNamesPhrase(res.rostersCreated);
      showToast(
        res.teamCreated
          ? `${res.schoolName} added to ${season.gameName} ${season.name}${res.rostersCreated.length ? ` with ${phrase}` : ''}.`
          : res.rostersCreated.length
            ? `${res.schoolName}: created the ${phrase}.`
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
        description={`Adding a school registers its ${season.gameName} team for ${season.name} and creates the rosters this game fields (${rosterNamesPhrase(planSchoolRosters(season.gameSlug, []).map((r) => r.name))}), so managers find them ready. Other games and seasons are not touched.`}
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
          <ul className="admin-stagger grid grid-cols-1 gap-4 px-5 pb-5 pt-5 sm:grid-cols-2 xl:grid-cols-3">
            {schools.map((school) => (
              <SchoolCard
                key={school.teamId}
                season={season}
                school={school}
                isPending={isPending}
                canManage={canInvite}
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
          seasonName={inviteable ? season.name : undefined}
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

/**
 * One school of the season as a tile. The school name is the card's link (stretched over the whole
 * tile with an overlay, so the card is one big target and the name is the accessible name); the
 * action buttons sit above that overlay so they stay separately clickable.
 */
function SchoolCard({
  season,
  school,
  isPending,
  canManage,
  onInvite,
  onCreateMissing,
}: {
  season: Props['season'];
  school: SeasonSetupSchool;
  isPending: boolean;
  /** MANAGE_SCHOOLS: invite links and editing manager access. */
  canManage: boolean;
  onInvite: () => void;
  onCreateMissing: () => void;
}) {
  const playerTotal = school.rosters.reduce((n, r) => n + r.players.length, 0);
  const rosterCount = school.rosters.length;

  return (
    <li className="group relative flex flex-col gap-4 rounded-2xl bg-surface-sunken/60 p-4 ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 hover:bg-surface-raised/60 hover:ring-accent/40 focus-within:ring-accent/40 motion-reduce:transition-none">
      <div className="flex items-center gap-3">
        <SchoolCrest name={school.schoolName} logoUrl={school.logoUrl} size="lg" />
        <div className="min-w-0">
          <Link
            href={seasonSchoolHref(season.id, school.schoolId, season.gameSlug)}
            className={cx(
              'block truncate text-base font-semibold text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-[""] hover:text-accent',
              focusRing,
            )}
          >
            {school.schoolName}
          </Link>
          <p className="text-sm text-foreground-secondary">
            {rosterCount} {rosterCount === 1 ? 'roster' : 'rosters'} · {playerTotal} {playerTotal === 1 ? 'player' : 'players'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {school.rosters.map((r) => (
          <span key={r.id} className={chip('neutral')}>{rosterSummary(r)}</span>
        ))}
        {school.missing.map((d) => (
          <span key={d} className={chip('warning')}>No {d} roster</span>
        ))}
      </div>
      {(school.missing.length > 0 || canManage) && (
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2">
          {school.missing.length > 0 && (
            <button type="button" onClick={onCreateMissing} disabled={isPending} className={chipButton('warning')}>
              Create missing rosters
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onInvite}
              className={chipButton('ghost')}
              aria-label={`Managers and invite links for ${school.schoolName}`}
              title="Create manager invite links, and edit which games each manager can manage"
            >
              <FiLink aria-hidden className="h-3.5 w-3.5" />
              Managers
            </button>
          )}
        </div>
      )}
    </li>
  );
}
