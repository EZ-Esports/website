'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FiArrowLeft, FiAward, FiChevronRight, FiExternalLink, FiHome, FiPlus,
  FiSettings, FiTrash2, FiUsers, FiX,
} from 'react-icons/fi';
import {
  createMember, updateMember, deleteMember,
  createTeam, deleteTeam,
  createRoster, updateRoster, deleteRoster,
  createRosterMember, updateRosterMember, deleteRosterMember,
  listSchoolMembers, listRosterPlayers, listRosterView,
} from '@/app/(admin)/admin/roster/actions';
import { useActionData } from '@/app/lib/hooks/useActionData';
import { DBGame, DBTeam, DBRoster, DBSchool, DBMember, DBSeason } from '@/app/types';

interface RosterExplorerProps {
  games: DBGame[];
  teams: DBTeam[];
  rosters: DBRoster[];
  schools: DBSchool[];
  seasons: DBSeason[];
  /** Player headcount per roster id, computed server-side. */
  playerCounts: Record<string, number>;
}

type ActionResult = { success: boolean; error?: string; [key: string]: unknown };
type RosterPlayerRow = Awaited<ReturnType<typeof listRosterPlayers>>[number];

const ROLES = ['player', 'captain', 'coach', 'sub'] as const;

import {
  input, primaryBtn, secondaryBtnSm, ghostBtnSm, iconBtn, saveBtn, cancelBtn, deleteIconBtn, deleteIconBtnCompact,
  focusRing, selectClass, cardHover, table, tableWrap, tbody, td, tdRight, th, theadRow, thRight, tr, trEditing, chip, listStack,
} from '@/app/components/admin/styles';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { AdminEmptyState, AdminField, AdminNotice, AdminSearchField, AdminSkeletonRows, AdminToast } from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';

export default function RosterExplorer({
  games, teams, rosters, schools, seasons, playerCounts,
}: RosterExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // --- Toast -----------------------------------------------------------------
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });
  useEffect(() => {
    if (!toast) return;
    // Errors linger so they can be read; successes auto-dismiss.
    if (toast.type === 'error') return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // --- Lookups ---------------------------------------------------------------
  const gameMap = useMemo(() => new Map(games.map(g => [g.id, g])), [games]);
  const seasonMap = useMemo(() => new Map(seasons.map(s => [s.id, s])), [seasons]);

  // --- URL-driven navigation -------------------------------------------------
  const schoolId = searchParams.get('school');
  const teamId = searchParams.get('team');
  const rosterId = searchParams.get('roster');
  const seasonScope = searchParams.get('season'); // season id, or null for all

  const school = useMemo(() => schools.find(s => s.id === schoolId) ?? null, [schools, schoolId]);
  const team = useMemo(
    () => (school ? teams.find(t => t.id === teamId && t.schoolId === school.id) ?? null : null),
    [teams, teamId, school],
  );
  const roster = useMemo(
    () => (team ? rosters.find(r => r.id === rosterId && r.teamId === team.id) ?? null : null),
    [rosters, rosterId, team],
  );

  // Teams narrowed to the selected season; drives school/team listings so a
  // school card no longer mixes every archived season together.
  const scopedTeams = useMemo(
    () => (seasonScope ? teams.filter(t => t.seasonId === seasonScope) : teams),
    [teams, seasonScope],
  );

  const setParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(next).forEach(([k, v]) => (v === null ? sp.delete(k) : sp.set(k, v)));
    const qs = sp.toString();
    setOpenForm(null); // close any open inline form when changing level
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const goToSchools = () => setParams({ school: null, team: null, roster: null });
  const goToSchool = (id: string) => setParams({ school: id, team: null, roster: null });
  const goToTeam = (id: string) => setParams({ team: id, roster: null });
  const goToRoster = (id: string) => setParams({ roster: id });

  // --- Inline-form open state (reset on navigation, see setParams) -----------
  const [openForm, setOpenForm] = useState<string | null>(null);
  const toggle = (key: string) => setOpenForm(prev => (prev === key ? null : key));

  // --- Action runners --------------------------------------------------------
  const runAction = (action: () => Promise<ActionResult>, successMsg: string, onSuccess?: (res: ActionResult) => void) => {
    startTransition(async () => {
      const res = await action();
      if (res?.success) { showToast(successMsg); onSuccess?.(res); }
      else showToast(res?.error || 'Something went wrong.', 'error');
    });
  };
  const runForm = (
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<ActionResult>,
    successMsg: string,
    opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void },
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.success) {
        showToast(successMsg);
        if (opts?.reset) form.reset();
        opts?.onSuccess?.(res);
      } else {
        showToast(res?.error || 'Something went wrong.', 'error');
      }
    });
  };
  const confirmDelete = (message: string, action: () => Promise<ActionResult>, successMsg: string, onSuccess?: () => void) => {
    if (!window.confirm(message)) return;
    runAction(action, successMsg, onSuccess);
  };

  // --- Derived counts --------------------------------------------------------
  const teamLabel = (t: DBTeam) => {
    const g = gameMap.get(t.gameId);
    const s = seasonMap.get(t.seasonId);
    return { title: g?.displayName ?? 'Game', short: g?.shortName ?? '—', season: s?.name ?? 'Season' };
  };
  const teamPlayerCount = (t: DBTeam) =>
    rosters.filter(r => r.teamId === t.id).reduce((n, r) => n + (playerCounts[r.id] ?? 0), 0);

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 text-foreground">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {/* Breadcrumb + season scope. Sticky under the top bar so the drill-down
          path and the season filter stay in reach on long rosters. */}
      <div className="sticky top-14 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 bg-surface px-2 py-3">
        <nav aria-label="Roster drill-down" className="flex flex-wrap items-center gap-1.5 text-sm text-foreground-secondary">
          <Crumb onClick={goToSchools} active={!school}><FiHome className="w-3.5 h-3.5" /> Schools</Crumb>
          {school && (<><FiChevronRight aria-hidden className="w-3.5 h-3.5 text-foreground-muted" /><Crumb onClick={() => goToSchool(school.id)} active={!team}>{school.name}</Crumb></>)}
          {team && (<><FiChevronRight aria-hidden className="w-3.5 h-3.5 text-foreground-muted" /><Crumb onClick={() => goToTeam(team.id)} active={!roster}>{teamLabel(team).short} · {teamLabel(team).season}</Crumb></>)}
          {roster && (<><FiChevronRight aria-hidden className="w-3.5 h-3.5 text-foreground-muted" /><Crumb active>{roster.name}</Crumb></>)}
        </nav>

        <label className="flex items-center gap-2 text-sm text-foreground-secondary">
          Season
          <select
            value={seasonScope ?? ''}
            onChange={(e) => setParams({ season: e.target.value || null })}
            className={selectClass}
          >
            <option value="">All seasons</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>
                {gameMap.get(s.gameId)?.shortName ?? '—'} {s.name}{s.isActive ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ===================== LEVEL: SCHOOLS ===================== */}
      {!school && (
        <SchoolsView
          schools={schools}
          teams={scopedTeams}
          onOpen={goToSchool}
        />
      )}

      {/* ===================== LEVEL: SCHOOL (teams + members) ===================== */}
      {school && !team && (
        <div className="space-y-6">
          <Header
            title={`${school.name}`}
            subtitle="Game teams and the school member directory."
            onBack={goToSchools}
            actions={
              <>
                <button type="button" className={ghostBtnSm} aria-expanded={openForm === 'school-edit'} onClick={() => toggle('school-edit')}><FiSettings aria-hidden /> School settings</button>
                <button type="button" className={primaryBtn} aria-expanded={openForm === 'team-create'} onClick={() => toggle('team-create')}><FiPlus aria-hidden /> Register team</button>
              </>
            }
          />

          {openForm === 'school-edit' && (
            <Panel title="School settings" onClose={() => setOpenForm(null)}>
              <p className="text-sm text-foreground-secondary leading-6">
                School details (name, logo, website, display order, active status) are managed in the{' '}
                <Link href="/admin/schools" className={cx('text-accent hover:underline underline-offset-4 font-medium inline-flex items-center gap-1 rounded', focusRing)}>
                  Schools page <FiExternalLink aria-hidden className="w-3 h-3" />
                </Link>
                . Navigate there to edit or delete this school.
              </p>
              <div className="flex justify-end pt-2">
                <Link
                  href="/admin/schools"
                  className={secondaryBtnSm}
                >
                  <FiExternalLink aria-hidden className="w-3.5 h-3.5" /> Go to Schools
                </Link>
              </div>
            </Panel>
          )}

          {openForm === 'team-create' && (
            <TeamCreateForm
              schoolId={school.id}
              games={games}
              seasons={seasons}
              isPending={isPending}
              runForm={runForm}
              onClose={() => setOpenForm(null)}
            />
          )}

          {/* Teams grid (scoped to the selected season) */}
          <Section title="Game teams" icon={<FiAward />}>
            {scopedTeams.filter(t => t.schoolId === school.id).length === 0 ? (
              <Empty icon={<FiAward />}>
                {seasonScope
                  ? 'No teams registered for the selected season. Switch the season scope or register one.'
                  : 'No teams registered yet. Click “Register team” to add one.'}
              </Empty>
            ) : (
              <div className="admin-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {scopedTeams.filter(t => t.schoolId === school.id).map(t => {
                  const l = teamLabel(t);
                  const teamRosters = rosters.filter(r => r.teamId === t.id);
                  const playerCount = teamPlayerCount(t);
                  return (
                    <Tile key={t.id} onClick={() => goToTeam(t.id)}
                      onDelete={() => confirmDelete(
                        `Permanently unregister ${l.title} (${l.season})? This removes all its rosters and player assignments. This cannot be undone.`,
                        () => deleteTeam(t.id), 'Team unregistered.',
                      )}
                      deleteLabel="Unregister team"
                    >
                      <div className="text-sm font-medium text-foreground">{l.title}</div>
                      <div className="text-xs text-foreground-secondary mt-0.5">{l.season}</div>
                      <div className="text-xs text-foreground-secondary mt-3 flex gap-3 tabular-nums">
                        <span>{teamRosters.length} roster{teamRosters.length === 1 ? '' : 's'}</span>
                        <span>{playerCount} player{playerCount === 1 ? '' : 's'}</span>
                      </div>
                    </Tile>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Members directory (fetched on demand for this school) */}
          <MemberManager
            schoolId={school.id}
            isPending={isPending}
            openForm={openForm}
            setOpenForm={setOpenForm}
            runForm={runForm}
            confirmDelete={confirmDelete}
          />
        </div>
      )}

      {/* ===================== LEVEL: TEAM (rosters) ===================== */}
      {school && team && !roster && (
        <div className="space-y-6">
          <Header
            title={teamLabel(team).title}
            subtitle={`${teamLabel(team).season} · ${school.name}`}
            onBack={() => goToSchool(school.id)}
            actions={<button type="button" className={primaryBtn} aria-expanded={openForm === 'roster-create'} onClick={() => toggle('roster-create')}><FiPlus aria-hidden /> Add roster</button>}
          />

          {openForm === 'roster-create' && (
            <Panel title="Create roster" onClose={() => setOpenForm(null)}>
              <form
                onSubmit={(e) => runForm(e, createRoster, 'Roster created.', { onSuccess: () => setOpenForm(null) })}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end"
              >
                <input type="hidden" name="teamId" value={team.id} />
                <Field label="Roster name">
                  <input name="name" required defaultValue="Varsity" placeholder="e.g. Varsity, JV" className={input} />
                </Field>
                <Field label="Division">
                  <select name="division" defaultValue="A" className={input}>
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                  </select>
                </Field>
                <button type="submit" disabled={isPending} className={primaryBtn}>Create</button>
              </form>
            </Panel>
          )}

          <Section title="Rosters" icon={<FiUsers />}>
            {rosters.filter(r => r.teamId === team.id).length === 0 ? (
              <Empty icon={<FiUsers />}>No rosters yet. Click “Add roster” to create the first squad.</Empty>
            ) : (
              <div className="admin-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rosters.filter(r => r.teamId === team.id).map(r => {
                  const playerCount = playerCounts[r.id] ?? 0;
                  const record = (r.wins ?? 0) + (r.losses ?? 0) > 0 ? `${r.wins ?? 0}-${r.losses ?? 0}` : null;
                  return (
                    <Tile key={r.id} onClick={() => goToRoster(r.id)}
                      onDelete={() => confirmDelete(
                        `Permanently delete roster “${r.name}”? This removes all assigned players and cannot be undone.`,
                        () => deleteRoster(r.id), 'Roster deleted.',
                      )}
                      deleteLabel="Delete roster"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{r.name}</span>
                        <span className={chip('neutral')}>Div {r.division}</span>
                      </div>
                      <div className="text-xs text-foreground-secondary mt-3 flex gap-3 tabular-nums">
                        <span>{playerCount} player{playerCount === 1 ? '' : 's'}</span>
                        {record && <span>Record {record}</span>}
                      </div>
                    </Tile>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ===================== LEVEL: ROSTER (players) ===================== */}
      {school && team && roster && (
        <RosterView
          teamLabel={teamLabel(team)}
          roster={roster}
          schoolId={school.id}
          isPending={isPending}
          openForm={openForm}
          setOpenForm={setOpenForm}
          toggle={toggle}
          onBack={() => goToTeam(team.id)}
          runForm={runForm}
          confirmDelete={confirmDelete}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * SCHOOLS VIEW
 * ========================================================================== */
function SchoolsView({
  schools, teams, onOpen,
}: {
  schools: DBSchool[];
  teams: DBTeam[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = schools.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">Schools</h2>
          <p className="text-sm text-foreground-secondary mt-0.5">Select a school to manage its teams, rosters, and members.</p>
        </div>
        <Link href="/admin/schools" className={secondaryBtnSm}>
          <FiExternalLink aria-hidden className="w-3.5 h-3.5" /> Manage schools
        </Link>
      </div>

      <AdminSearchField
        className="max-w-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        aria-label="Search schools"
        placeholder="Search schools…"
      />

      {filtered.length === 0 ? (
        <Empty icon={<FiHome />}>{schools.length === 0 ? 'No schools registered. Click “Manage schools” to add one.' : 'No schools match your search.'}</Empty>
      ) : (
        <div className="admin-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(s => {
            const teamCount = teams.filter(t => t.schoolId === s.id).length;
            return (
              <button key={s.id} type="button" onClick={() => onOpen(s.id)}
                className={cx(tileSurface, 'text-left group cursor-pointer', focusRing)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                  <FiChevronRight aria-hidden className="w-4 h-4 shrink-0 text-foreground-muted group-hover:text-accent group-hover:translate-x-0.5 transition-[translate,color] duration-200 motion-reduce:transition-none" />
                </div>
                <div className="text-xs text-foreground-secondary mt-2 tabular-nums">{teamCount} team{teamCount === 1 ? '' : 's'}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * ROSTER VIEW (players sheet, fetched on demand)
 * ========================================================================== */
function RosterView({
  teamLabel, roster, schoolId, isPending,
  openForm, setOpenForm, toggle, onBack, runForm, confirmDelete,
}: {
  teamLabel: { title: string; short: string; season: string };
  roster: DBRoster;
  schoolId: string;
  isPending: boolean;
  openForm: string | null;
  setOpenForm: (v: string | null) => void;
  toggle: (key: string) => void;
  onBack: () => void;
  runForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>, msg: string, opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void }) => void;
  confirmDelete: (message: string, action: () => Promise<ActionResult>, successMsg: string, onSuccess?: () => void) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: view, fetchError: viewFetchError, refresh } = useActionData(
    () => listRosterView(roster.id, schoolId),
    `${roster.id}|${schoolId}`,
    { players: [] as RosterPlayerRow[], members: [] as DBMember[] },
  );
  const players = view?.players ?? null;

  const loading = players === null;
  const eligible = (view?.members ?? []).filter(m => !(players ?? []).some(p => p.memberId === m.id));
  const [memberQuery, setMemberQuery] = useState('');
  const eligibleFiltered = eligible.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberQuery.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <Header
        title={roster.name}
        subtitle={`${teamLabel.title} · ${teamLabel.season} · Division ${roster.division}`}
        onBack={onBack}
        actions={
          <>
            <button type="button" className={primaryBtn} aria-expanded={openForm === 'player-add'} onClick={() => toggle('player-add')} disabled={loading || viewFetchError || eligible.length === 0}><FiPlus aria-hidden /> Add player</button>
            <RowIconButton kind="edit" disabled={viewFetchError} onClick={() => toggle('roster-edit')} aria-expanded={openForm === 'roster-edit'} label={`Edit roster ${roster.name}`} />
          </>
        }
      />

      {openForm === 'roster-edit' && !viewFetchError && (
        <Panel title="Edit roster" onClose={() => setOpenForm(null)}>
          <form
            onSubmit={(e) => runForm(e, (fd) => updateRoster(roster.id, fd), 'Roster updated.', { onSuccess: () => setOpenForm(null) })}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end"
          >
            <Field label="Roster name">
              <input name="name" required defaultValue={roster.name} className={input} />
            </Field>
            <Field label="Division">
              <select name="division" defaultValue={roster.division} className={input}>
                <option value="A">Division A</option>
                <option value="B">Division B</option>
              </select>
            </Field>
            <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
          </form>
        </Panel>
      )}

      {openForm === 'player-add' && !viewFetchError && (
        <Panel title="Add player" onClose={() => setOpenForm(null)}>
          {eligible.length === 0 ? (
            <p className="text-sm text-foreground-secondary">Every school member is already on this roster. Add more members from the school page first.</p>
          ) : (
            <form
              onSubmit={(e) => runForm(e, createRosterMember, 'Player added.', { reset: true, onSuccess: () => { setOpenForm(null); refresh(); } })}
              className="space-y-3"
            >
              <AdminSearchField
                className="max-w-sm"
                aria-label="Search eligible members"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                onClear={() => setMemberQuery('')}
                placeholder="Search eligible members…"
              />
              <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
                <input type="hidden" name="rosterId" value={roster.id} />
                <Field label="Member">
                  <select name="memberId" required defaultValue="" className={input}>
                    <option value="" disabled>Select member…</option>
                    {eligibleFiltered.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                  </select>
                </Field>
                <Field label="In-game name">
                  <input name="ign" placeholder="IGN" className={input} />
                </Field>
                <Field label="Role">
                  <select name="role" defaultValue="player" className={input}>
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r[0].toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </Field>
                <button type="submit" disabled={isPending} className={primaryBtn}>Add</button>
              </div>
            </form>
          )}
        </Panel>
      )}

      <Section title={loading ? 'Players' : `Players (${(players ?? []).length})`} icon={<FiUsers />}>
        {viewFetchError && (
          <AdminNotice tone="danger" className="mb-3">
            Failed to load players. Displaying last known data. Please refresh to try again.
          </AdminNotice>
        )}
        {loading ? (
          <div className="rounded-2xl bg-admin-panel py-1" role="status" aria-label="Loading players">
            <AdminSkeletonRows rows={4} />
          </div>
        ) : (players ?? []).length === 0 ? (
          <Empty icon={<FiUsers />}>No players on this roster yet.</Empty>
        ) : (
          <div className={cx(tableWrap, 'rounded-2xl bg-admin-panel')}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Player</th>
                  <th className={th}>In-game name</th>
                  <th className={th}>Role</th>
                  <th className={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {(players ?? []).map(p => {
                  const editing = editingId === p.id;
                  if (editing && !viewFetchError) {
                    return (
                      <tr key={p.id} className={trEditing}>
                        <td colSpan={4} className="px-5 py-4">
                          <form
                            onSubmit={(e) => runForm(e, (fd) => updateRosterMember(p.id, fd), 'Player updated.', { onSuccess: () => { setEditingId(null); refresh(); } })}
                            className="admin-fade-in flex flex-wrap items-end gap-3"
                          >
                            <div className="text-sm font-medium text-foreground pb-2.5">{p.firstName} {p.lastName}</div>
                            <Field label="In-game name">
                              <input name="ign" defaultValue={p.ign ?? ''} placeholder="IGN" className={`${input} w-40`} />
                            </Field>
                            <Field label="Role">
                              <select name="role" defaultValue={p.role} className={`${input} w-36`}>
                                {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                              </select>
                            </Field>
                            <div className="flex gap-2 pb-0.5">
                              <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)} className={cancelBtn}>Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={p.id} className={cx(tr, 'group')}>
                      <td className={cx(td, 'font-medium text-foreground')}>
                        <span className="flex items-center gap-1.5">
                          {p.firstName} {p.lastName}
                          {p.role === 'captain' && <span className="text-warning" title="Captain">★</span>}
                        </span>
                      </td>
                      <td className={cx(td, 'text-foreground-secondary font-mono text-xs')}>{p.ign || '—'}</td>
                      <td className={td}><span className={cx(chip(p.role === 'captain' ? 'warning' : p.role === 'coach' ? 'info' : 'neutral'), 'capitalize')}>{p.role}</span></td>
                      <td className={tdRight}>
                        {/* Row actions stay visible (touch has no hover). */}
                        <div className="flex items-center justify-end gap-2">
                          <RowIconButton kind="edit" disabled={viewFetchError} onClick={() => setEditingId(p.id)} label={`Edit player ${p.firstName} ${p.lastName}`} />
                          <button
                            onClick={() => confirmDelete(`Permanently remove ${p.firstName} ${p.lastName} from ${roster.name}? This cannot be undone.`, () => deleteRosterMember(p.id), 'Player removed.', refresh)}
                            disabled={viewFetchError}
                            type="button" className={`${deleteIconBtn} ${viewFetchError ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label={`Remove player ${p.firstName} ${p.lastName}`} title={`Remove player ${p.firstName} ${p.lastName}`}
                          ><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ============================================================================
 * MEMBER MANAGER (school member directory, fetched on demand)
 * ========================================================================== */
function MemberManager({
  schoolId, isPending, openForm, setOpenForm, runForm, confirmDelete,
}: {
  schoolId: string;
  isPending: boolean;
  openForm: string | null;
  setOpenForm: (v: string | null) => void;
  runForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>, msg: string, opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void }) => void;
  confirmDelete: (message: string, action: () => Promise<ActionResult>, successMsg: string, onSuccess?: () => void) => void;
}) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: members, fetchError: membersFetchError, refresh } = useActionData(
    () => listSchoolMembers(schoolId),
    schoolId,
    [] as DBMember[],
  );

  const loading = members === null;
  const filtered = (members ?? []).filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase())
    || (m.email ?? '').toLowerCase().includes(query.toLowerCase())
    || (m.discord ?? '').toLowerCase().includes(query.toLowerCase()),
  );
  const adding = openForm === 'member-add';

  return (
    <Section
      title={loading ? 'School Members' : `School Members (${(members ?? []).length})`}
      icon={<FiUsers />}
      action={
        <button
          type="button"
          className={secondaryBtnSm}
          disabled={membersFetchError}
          aria-expanded={adding}
          onClick={() => setOpenForm(adding ? null : 'member-add')}
        >
          {adding ? <><FiX aria-hidden /> Cancel</> : <><FiPlus aria-hidden /> Add member</>}
        </button>
      }
    >
      {membersFetchError && (
        <AdminNotice tone="danger" className="mb-3">
          Failed to load members. Displaying last known data. Please refresh to try again.
        </AdminNotice>
      )}
      {adding && !membersFetchError && (
        <form
          onSubmit={(e) => runForm(e, createMember, 'Member added.', { reset: true, onSuccess: () => { setOpenForm(null); refresh(); } })}
          className="admin-fade-in rounded-2xl bg-admin-panel p-5 space-y-3 mb-3"
        >
          <MemberFields schoolId={schoolId} />
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className={primaryBtn}>Add member</button>
          </div>
        </form>
      )}

      <AdminSearchField
        className="mb-3 max-w-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        aria-label="Filter members"
        placeholder="Filter members…"
      />

      {loading ? (
        <div className="rounded-2xl bg-admin-panel py-1" role="status" aria-label="Loading members">
          <AdminSkeletonRows rows={4} />
        </div>
      ) : filtered.length === 0 ? (
        <Empty icon={<FiUsers />}>{(members ?? []).length === 0 ? 'No members yet. Add students to build the roster pool.' : 'No members match your filter.'}</Empty>
      ) : (
        <ul className={cx(listStack, 'admin-scroll max-h-[420px] overflow-y-auto rounded-2xl bg-admin-panel')}>
          {filtered.map(m => (
            <li key={m.id} className={cx('px-5 py-3 text-sm group transition-colors duration-150', editingId === m.id ? 'bg-surface-raised/40' : 'hover:bg-surface-raised/50')}>
              {editingId === m.id && !membersFetchError ? (
                <form
                  onSubmit={(e) => runForm(e, (fd) => updateMember(m.id, fd), 'Member updated.', { onSuccess: () => { setEditingId(null); refresh(); } })}
                  className="admin-fade-in space-y-3"
                >
                  <MemberFields schoolId={schoolId} m={m} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className={cancelBtn}>Cancel</button>
                    <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{m.firstName} {m.lastName}</div>
                    <div className="text-xs text-foreground-secondary truncate">
                      {m.graduationYear ? `'${m.graduationYear.toString().slice(-2)}` : ''}
                      {m.discord ? ` · @${m.discord}` : ''}
                      {m.email ? ` · ${m.email}` : ''}
                    </div>
                  </div>
                  {/* Row actions stay visible (touch has no hover). */}
                  <div className="flex items-center gap-2 shrink-0">
                    <RowIconButton kind="edit" disabled={membersFetchError} onClick={() => setEditingId(m.id)} label={`Edit member ${m.firstName} ${m.lastName}`} />
                    <button
                      onClick={() => confirmDelete(`Permanently delete ${m.firstName} ${m.lastName}? They will be removed from any rosters. This cannot be undone.`, () => deleteMember(m.id), 'Member deleted.', refresh)}
                      disabled={membersFetchError}
                      type="button" className={`${deleteIconBtn} ${membersFetchError ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label={`Delete member ${m.firstName} ${m.lastName}`} title={`Delete member ${m.firstName} ${m.lastName}`}
                    ><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}


/* ============================================================================
 * SMALL PRESENTATIONAL HELPERS
 * ========================================================================== */
function Crumb({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  if (active || !onClick) return <span aria-current="location" className="text-foreground font-medium flex items-center gap-1.5">{children}</span>;
  return <button type="button" onClick={onClick} className={cx('rounded hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer', focusRing)}>{children}</button>;
}

/** Drill-down level header (school, team, roster). The page's h1 is "Teams & rosters", so levels are h2. */
function Header({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack: () => void; actions?: React.ReactNode }) {
  return (
    <div className="admin-fade-in flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={onBack} className={cx(iconBtn, 'bg-admin-panel')} aria-label="Back"><FiArrowLeft aria-hidden className="w-4 h-4" /></button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
          {subtitle && <p className="text-sm text-foreground-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 [&>svg]:text-foreground-secondary">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TeamCreateForm({
  schoolId, games, seasons, isPending, runForm, onClose,
}: {
  schoolId: string;
  games: DBGame[];
  seasons: DBSeason[];
  isPending: boolean;
  runForm: (
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<ActionResult>,
    successMsg: string,
    opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void },
  ) => void;
  onClose: () => void;
}) {
  // A season belongs to exactly one game, so the Season options must track the
  // selected game — otherwise an admin could pair e.g. Valorant with a LoL season.
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const gameSeasons = seasons.filter(s => s.gameId === gameId);

  return (
    <Panel title="Register game team" onClose={onClose}>
      <form
        onSubmit={(e) => runForm(e, createTeam, 'Team registered.', { onSuccess: onClose })}
        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        <Field label="Game">
          <select
            name="gameId"
            required
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={games.length === 0}
            className={input}
          >
            {games.length === 0
              ? <option value="">No games configured</option>
              : games.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
          </select>
        </Field>
        <Field label="Season">
          <select
            name="seasonId"
            required
            key={gameId}
            defaultValue={gameSeasons[0]?.id ?? ''}
            disabled={gameSeasons.length === 0}
            className={input}
          >
            {gameSeasons.length === 0
              ? <option value="">No seasons for this game</option>
              : gameSeasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={isPending || gameSeasons.length === 0} className={primaryBtn}>Register</button>
      </form>
      {games.length === 0 ? (
        <p className="admin-fade-in text-xs leading-5 text-warning mt-2">
          No games configured yet. Create a game in{' '}
          <Link href="/admin/league" className="font-medium underline underline-offset-2">League Setup</Link>{' '}
          first, then add a season for it.
        </p>
      ) : gameSeasons.length === 0 && (
        <p className="admin-fade-in text-xs leading-5 text-warning mt-2">
          This game has no seasons yet. Create one in{' '}
          <Link href="/admin/league" className="font-medium underline underline-offset-2">League Setup</Link>{' '}
          before registering a team.
        </p>
      )}
    </Panel>
  );
}

/** Inline create/edit panel that opens under a level header. Fades in; the X closes it. */
function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="admin-fade-in rounded-2xl bg-admin-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button type="button" onClick={onClose} className={cx(iconBtn, '-mr-2 -my-1')} aria-label="Close"><FiX aria-hidden className="h-4 w-4" /></button>
      </div>
      {children}
    </section>
  );
}

function MemberFields({ schoolId, m }: { schoolId: string; m?: DBMember }) {
  return (
    <>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <input name="firstName" required defaultValue={m?.firstName ?? ''} placeholder="First name" className={input} />
        </Field>
        <Field label="Last name" required>
          <input name="lastName" required defaultValue={m?.lastName ?? ''} placeholder="Last name" className={input} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Email">
            <input name="email" type="email" defaultValue={m?.email ?? ''} placeholder="student@school.edu" className={input} />
          </Field>
        </div>
        <Field label="Grad year">
          <input name="graduationYear" type="number" defaultValue={m?.graduationYear ?? ''} placeholder="2026" className={input} />
        </Field>
      </div>
      <Field label="Discord">
        <input name="discord" defaultValue={m?.discord ?? ''} placeholder="sam#1234" className={input} />
      </Field>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <AdminField label={label} required={required}>
      {children}
    </AdminField>
  );
}

/** Shared tile surface: one step up from the page, lifts slightly on hover. */
const tileSurface = `block w-full rounded-xl bg-admin-panel p-4 ${cardHover}`;

function Tile({ children, onClick, onDelete, deleteLabel }: { children: React.ReactNode; onClick: () => void; onDelete: () => void; deleteLabel: string }) {
  return (
    // The hover surface is the wrapper, so pointing at the corner trash keeps the tile lifted.
    <div className={cx('relative group rounded-xl bg-admin-panel', cardHover)}>
      <button type="button" onClick={onClick} className={cx('block w-full rounded-xl p-4 pr-12 text-left cursor-pointer', focusRing)}>{children}</button>
      {/* Corner trash: visible but quiet (touch has no hover), full strength on hover or focus. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className={`${deleteIconBtnCompact} absolute top-3 right-3 p-1 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity`}
        aria-label={deleteLabel} title={deleteLabel}
      ><FiTrash2 aria-hidden className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Empty({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-admin-panel">
      <AdminEmptyState compact icon={icon} title={children} />
    </div>
  );
}
