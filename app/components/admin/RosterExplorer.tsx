'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  FiArrowLeft, FiAward, FiChevronRight, FiEdit2, FiHome, FiPlus,
  FiSearch, FiSettings, FiTrash2, FiUsers, FiX,
} from 'react-icons/fi';
import {
  createSchool, updateSchool, deleteSchool,
  createMember, updateMember, deleteMember,
  createTeam, deleteTeam,
  createRoster, updateRoster, deleteRoster,
  createRosterMember, updateRosterMember, deleteRosterMember,
} from '@/app/(admin)/admin/roster/actions';
import { DBGame, DBTeam, DBRoster, DBPlayer, DBSchool, DBMember, DBSeason } from '@/app/types';

interface RosterExplorerProps {
  games: DBGame[];
  teams: DBTeam[];
  rosters: DBRoster[];
  players: DBPlayer[];
  schools: DBSchool[];
  members: DBMember[];
  seasons: DBSeason[];
}

type ActionResult = { success: boolean; error?: string; [key: string]: unknown };

const ROLES = ['player', 'captain', 'coach', 'sub'] as const;

const slugify = (val: string) =>
  val.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- Shared styles -----------------------------------------------------------
const input = 'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all';
const primaryBtn = 'px-4 py-2 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
const secondaryBtn = 'px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer';
const iconBtn = 'p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer';

export default function RosterExplorer({
  games, teams, rosters, players, schools, members, seasons,
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
  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  // --- URL-driven navigation -------------------------------------------------
  const schoolId = searchParams.get('school');
  const teamId = searchParams.get('team');
  const rosterId = searchParams.get('roster');

  const school = useMemo(() => schools.find(s => s.id === schoolId) ?? null, [schools, schoolId]);
  const team = useMemo(
    () => (school ? teams.find(t => t.id === teamId && t.schoolId === school.id) ?? null : null),
    [teams, teamId, school],
  );
  const roster = useMemo(
    () => (team ? rosters.find(r => r.id === rosterId && r.teamId === team.id) ?? null : null),
    [rosters, rosterId, team],
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

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5 text-slate-200">
      {toast && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            toast.type === 'error'
              ? 'bg-red-950/30 border-red-900/50 text-red-300'
              : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-200" aria-label="Dismiss"><FiX /></button>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 flex-wrap">
        <Crumb onClick={goToSchools} active={!school}><FiHome className="w-3.5 h-3.5" /> Schools</Crumb>
        {school && (<><FiChevronRight className="w-3 h-3 text-slate-700" /><Crumb onClick={() => goToSchool(school.id)} active={!team}>{school.name}</Crumb></>)}
        {team && (<><FiChevronRight className="w-3 h-3 text-slate-700" /><Crumb onClick={() => goToTeam(team.id)} active={!roster}>{teamLabel(team).short} · {teamLabel(team).season}</Crumb></>)}
        {roster && (<><FiChevronRight className="w-3 h-3 text-slate-700" /><Crumb active>{roster.name}</Crumb></>)}
      </nav>

      {/* ===================== LEVEL: SCHOOLS ===================== */}
      {!school && (
        <SchoolsView
          schools={schools}
          teams={teams}
          isPending={isPending}
          isAdding={openForm === 'school-create'}
          onToggleAdd={() => toggle('school-create')}
          onOpen={goToSchool}
          runForm={runForm}
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
                <button className={secondaryBtn} onClick={() => toggle('team-create')}><FiPlus /> Register Team</button>
                <button className={secondaryBtn} onClick={() => toggle('school-edit')}><FiSettings /> School Settings</button>
              </>
            }
          />

          {openForm === 'school-edit' && (
            <Panel title="Edit School" onClose={() => setOpenForm(null)}>
              <SchoolForm
                initial={school}
                submitLabel="Save Changes"
                isPending={isPending}
                onSubmit={(fd) => runAction(() => updateSchool(school.id, fd), 'School updated.', () => setOpenForm(null))}
              />
              <div className="flex justify-end border-t border-slate-900 pt-3 mt-3">
                <button
                  onClick={() => confirmDelete(
                    `Delete ${school.name}? This removes all of its teams, rosters, and players. Members must be removed first.`,
                    () => deleteSchool(school.id), 'School deleted.', goToSchools,
                  )}
                  className="px-3.5 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FiTrash2 /> Delete School
                </button>
              </div>
            </Panel>
          )}

          {openForm === 'team-create' && (
            <Panel title="Register Game Team" onClose={() => setOpenForm(null)}>
              <form
                onSubmit={(e) => runForm(e, createTeam, 'Team registered.', { onSuccess: () => setOpenForm(null) })}
                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
              >
                <input type="hidden" name="schoolId" value={school.id} />
                <Field label="Game">
                  <select name="gameId" required defaultValue={games[0]?.id ?? ''} className={input}>
                    {games.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                  </select>
                </Field>
                <Field label="Season">
                  <select name="seasonId" required defaultValue={seasons[0]?.id ?? ''} className={input}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <button type="submit" disabled={isPending} className={primaryBtn}>Register</button>
              </form>
            </Panel>
          )}

          {/* Teams grid */}
          <Section title="Game Teams" icon={<FiAward />}>
            {teams.filter(t => t.schoolId === school.id).length === 0 ? (
              <Empty>No teams registered yet. Click “Register Team” to add one.</Empty>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {teams.filter(t => t.schoolId === school.id).map(t => {
                  const l = teamLabel(t);
                  const teamRosters = rosters.filter(r => r.teamId === t.id);
                  const playerCount = teamRosters.reduce((n, r) => n + players.filter(p => p.rosterId === r.id).length, 0);
                  return (
                    <Tile key={t.id} onClick={() => goToTeam(t.id)}
                      onDelete={() => confirmDelete(
                        `Unregister ${l.title} (${l.season})? This removes all its rosters and player assignments.`,
                        () => deleteTeam(t.id), 'Team unregistered.',
                      )}
                      deleteLabel="Unregister team"
                    >
                      <div className="text-sm font-bold text-white">{l.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{l.season}</div>
                      <div className="text-[11px] text-slate-400 mt-3 flex gap-3">
                        <span>{teamRosters.length} roster{teamRosters.length === 1 ? '' : 's'}</span>
                        <span>{playerCount} player{playerCount === 1 ? '' : 's'}</span>
                      </div>
                    </Tile>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Members directory */}
          <MemberManager
            schoolId={school.id}
            members={members.filter(m => m.schoolId === school.id)}
            isPending={isPending}
            openForm={openForm}
            setOpenForm={setOpenForm}
            runForm={runForm}
            runAction={runAction}
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
            actions={<button className={secondaryBtn} onClick={() => toggle('roster-create')}><FiPlus /> Add Roster</button>}
          />

          {openForm === 'roster-create' && (
            <Panel title="Create Roster" onClose={() => setOpenForm(null)}>
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
              <Empty>No rosters yet. Click “Add Roster” to create the first squad.</Empty>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rosters.filter(r => r.teamId === team.id).map(r => {
                  const count = players.filter(p => p.rosterId === r.id).length;
                  const record = (r.wins ?? 0) + (r.losses ?? 0) > 0 ? `${r.wins ?? 0}-${r.losses ?? 0}` : null;
                  return (
                    <Tile key={r.id} onClick={() => goToRoster(r.id)}
                      onDelete={() => confirmDelete(
                        `Delete roster “${r.name}”? This removes all assigned players.`,
                        () => deleteRoster(r.id), 'Roster deleted.',
                      )}
                      deleteLabel="Delete roster"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{r.name}</span>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded font-bold uppercase">Div {r.division}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-3 flex gap-3">
                        <span>{count} player{count === 1 ? '' : 's'}</span>
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
          players={players.filter(p => p.rosterId === roster.id)}
          schoolMembers={members.filter(m => m.schoolId === school.id)}
          memberMap={memberMap}
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
  schools, teams, isPending, isAdding, onToggleAdd, onOpen, runForm,
}: {
  schools: DBSchool[];
  teams: DBTeam[];
  isPending: boolean;
  isAdding: boolean;
  onToggleAdd: () => void;
  onOpen: (id: string) => void;
  runForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>, msg: string, opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void }) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = schools.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider">Schools</h1>
          <p className="text-xs text-slate-500 mt-1">Select a school to manage its teams, rosters, and members.</p>
        </div>
        <button className={secondaryBtn} onClick={onToggleAdd}><FiPlus /> New School</button>
      </div>

      {isAdding && (
        <Panel title="Register School" onClose={onToggleAdd}>
          <SchoolForm
            submitLabel="Register School"
            isPending={isPending}
            onSubmitForm={(e) => runForm(e, createSchool, 'School registered.', {
              onSuccess: (res) => { const s = res.school as DBSchool | undefined; if (s) onOpen(s.id); },
            })}
          />
        </Panel>
      )}

      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-2.5 text-slate-600 w-4 h-4" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search schools…" className={`${input} pl-9`} />
      </div>

      {filtered.length === 0 ? (
        <Empty>{schools.length === 0 ? 'No schools registered. Click “New School” to begin.' : 'No schools match your search.'}</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(s => {
            const teamCount = teams.filter(t => t.schoolId === s.id).length;
            return (
              <button key={s.id} onClick={() => onOpen(s.id)}
                className="text-left bg-slate-950/40 border border-slate-900 hover:border-slate-700 rounded-xl p-4 transition-all group cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white truncate">{s.name}</span>
                  <FiChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 mt-2">{teamCount} team{teamCount === 1 ? '' : 's'}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * ROSTER VIEW (players sheet)
 * ========================================================================== */
function RosterView({
  teamLabel, roster, players, schoolMembers, memberMap, isPending,
  openForm, setOpenForm, toggle, onBack, runForm, confirmDelete,
}: {
  teamLabel: { title: string; short: string; season: string };
  roster: DBRoster;
  players: DBPlayer[];
  schoolMembers: DBMember[];
  memberMap: Map<string, DBMember>;
  isPending: boolean;
  openForm: string | null;
  setOpenForm: (v: string | null) => void;
  toggle: (key: string) => void;
  onBack: () => void;
  runForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>, msg: string, opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void }) => void;
  confirmDelete: (message: string, action: () => Promise<ActionResult>, successMsg: string, onSuccess?: () => void) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const eligible = schoolMembers.filter(m => !players.some(p => p.memberId === m.id));

  return (
    <div className="space-y-5">
      <Header
        title={roster.name}
        subtitle={`${teamLabel.title} · ${teamLabel.season} · Division ${roster.division}`}
        onBack={onBack}
        actions={
          <>
            <button className={secondaryBtn} onClick={() => toggle('player-add')} disabled={eligible.length === 0}><FiPlus /> Add Player</button>
            <button className={secondaryBtn} onClick={() => toggle('roster-edit')}><FiSettings /> Edit Roster</button>
          </>
        }
      />

      {openForm === 'roster-edit' && (
        <Panel title="Edit Roster" onClose={() => setOpenForm(null)}>
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
            <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
          </form>
        </Panel>
      )}

      {openForm === 'player-add' && (
        <Panel title="Add Player" onClose={() => setOpenForm(null)}>
          {eligible.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Every school member is already on this roster. Add more members from the school page first.</p>
          ) : (
            <form
              onSubmit={(e) => runForm(e, createRosterMember, 'Player added.', { reset: true, onSuccess: () => setOpenForm(null) })}
              className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end"
            >
              <input type="hidden" name="rosterId" value={roster.id} />
              <Field label="Member">
                <select name="memberId" required defaultValue="" className={input}>
                  <option value="" disabled>Select member…</option>
                  {eligible.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
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
            </form>
          )}
        </Panel>
      )}

      <Section title={`Players (${players.length})`} icon={<FiUsers />}>
        {players.length === 0 ? (
          <Empty>No players on this roster yet.</Empty>
        ) : (
          <div className="overflow-x-auto border border-slate-900 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Player</th>
                  <th className="px-4 py-2.5 font-semibold">In-game name</th>
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {players.map(p => {
                  const member = memberMap.get(p.memberId);
                  const editing = editingId === p.id;
                  if (editing) {
                    return (
                      <tr key={p.id} className="bg-slate-900/40">
                        <td colSpan={4} className="px-4 py-3">
                          <form
                            onSubmit={(e) => runForm(e, (fd) => updateRosterMember(p.id, fd), 'Player updated.', { onSuccess: () => setEditingId(null) })}
                            className="flex flex-wrap items-end gap-3"
                          >
                            <div className="text-xs font-bold text-slate-300 pb-2">{member?.firstName} {member?.lastName}</div>
                            <Field label="In-game name">
                              <input name="ign" defaultValue={p.ign ?? ''} placeholder="IGN" className={`${input} w-40`} />
                            </Field>
                            <Field label="Role">
                              <select name="role" defaultValue={p.role} className={`${input} w-36`}>
                                {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                              </select>
                            </Field>
                            <div className="flex gap-2 pb-0.5">
                              <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)} className={secondaryBtn}>Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/20 group">
                      <td className="px-4 py-2.5 font-semibold text-slate-200">
                        <span className="flex items-center gap-1.5">
                          {member?.firstName} {member?.lastName}
                          {p.role === 'captain' && <span className="text-amber-400" title="Captain">★</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono italic">{p.ign || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 capitalize">{p.role}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingId(p.id)} className={iconBtn} aria-label="Edit player"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => confirmDelete(`Remove ${member?.firstName} ${member?.lastName} from ${roster.name}?`, () => deleteRosterMember(p.id), 'Player removed.')}
                            className={iconBtn} aria-label="Remove player"
                          ><FiTrash2 className="w-3.5 h-3.5 hover:text-red-400" /></button>
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
 * MEMBER MANAGER (school member directory)
 * ========================================================================== */
function MemberManager({
  schoolId, members, isPending, openForm, setOpenForm, runForm, confirmDelete,
}: {
  schoolId: string;
  members: DBMember[];
  isPending: boolean;
  openForm: string | null;
  setOpenForm: (v: string | null) => void;
  runForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>, msg: string, opts?: { reset?: boolean; onSuccess?: (res: ActionResult) => void }) => void;
  runAction: (action: () => Promise<ActionResult>, msg: string, onSuccess?: (res: ActionResult) => void) => void;
  confirmDelete: (message: string, action: () => Promise<ActionResult>, successMsg: string, onSuccess?: () => void) => void;
}) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase())
    || (m.email ?? '').toLowerCase().includes(query.toLowerCase())
    || (m.discord ?? '').toLowerCase().includes(query.toLowerCase()),
  );
  const adding = openForm === 'member-add';

  return (
    <Section
      title={`School Members (${members.length})`}
      icon={<FiUsers />}
      action={<button className="text-[11px] font-bold text-slate-400 hover:text-white uppercase" onClick={() => setOpenForm(adding ? null : 'member-add')}>{adding ? 'Cancel' : '+ Add member'}</button>}
    >
      {adding && (
        <form
          onSubmit={(e) => runForm(e, createMember, 'Member added.', { reset: true, onSuccess: () => setOpenForm(null) })}
          className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2 mb-3"
        >
          <MemberFields schoolId={schoolId} />
          <button type="submit" disabled={isPending} className={`${primaryBtn} w-full`}>Add member</button>
        </form>
      )}

      <div className="relative mb-3 max-w-sm">
        <FiSearch className="absolute left-3 top-2.5 text-slate-600 w-4 h-4" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter members…" className={`${input} pl-9`} />
      </div>

      {filtered.length === 0 ? (
        <Empty>{members.length === 0 ? 'No members yet. Add students to build the roster pool.' : 'No members match your filter.'}</Empty>
      ) : (
        <div className="border border-slate-900 rounded-xl divide-y divide-slate-900 max-h-[420px] overflow-y-auto">
          {filtered.map(m => (
            <div key={m.id} className="p-3 text-sm group">
              {editingId === m.id ? (
                <form
                  onSubmit={(e) => runForm(e, (fd) => updateMember(m.id, fd), 'Member updated.', { onSuccess: () => setEditingId(null) })}
                  className="space-y-2"
                >
                  <MemberFields schoolId={schoolId} m={m} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className={secondaryBtn}>Cancel</button>
                    <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{m.firstName} {m.lastName}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {m.graduationYear ? `'${m.graduationYear.toString().slice(-2)}` : ''}
                      {m.discord ? ` · @${m.discord}` : ''}
                      {m.email ? ` · ${m.email}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setEditingId(m.id)} className={iconBtn} aria-label="Edit member"><FiEdit2 className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => confirmDelete(`Delete ${m.firstName} ${m.lastName}? They will be removed from any rosters.`, () => deleteMember(m.id), 'Member deleted.')}
                      className={iconBtn} aria-label="Delete member"
                    ><FiTrash2 className="w-3.5 h-3.5 hover:text-red-400" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ============================================================================
 * SCHOOL FORM (create / edit, with slug auto-fill)
 * ========================================================================== */
function SchoolForm({
  initial, submitLabel, isPending, onSubmit, onSubmitForm,
}: {
  initial?: DBSchool;
  submitLabel: string;
  isPending: boolean;
  /** Used for edit: receives FormData. */
  onSubmit?: (fd: FormData) => void;
  /** Used for create: receives the form event (so the parent can reset/navigate). */
  onSubmitForm?: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));

  const handleName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  return (
    <form
      onSubmit={(e) => {
        if (onSubmitForm) { onSubmitForm(e); return; }
        e.preventDefault();
        onSubmit?.(new FormData(e.currentTarget));
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input name="name" required value={name} onChange={(e) => handleName(e.target.value)} placeholder="School name" className={input} autoFocus />
        <input name="slug" required value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="slug" className={input} />
        <input name="logoUrl" defaultValue={initial?.logoUrl ?? ''} placeholder="Logo URL (optional)" className={input} />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className={primaryBtn}>{submitLabel}</button>
      </div>
    </form>
  );
}

/* ============================================================================
 * SMALL PRESENTATIONAL HELPERS
 * ========================================================================== */
function Crumb({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  if (active || !onClick) return <span className="text-slate-200 font-bold flex items-center gap-1.5">{children}</span>;
  return <button onClick={onClick} className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">{children}</button>;
}

function Header({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack: () => void; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-900 pb-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={iconBtn} aria-label="Back"><FiArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">{title}</h1>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close"><FiX /></button>
      </div>
      {children}
    </div>
  );
}

function MemberFields({ schoolId, m }: { schoolId: string; m?: DBMember }) {
  return (
    <>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="firstName" required defaultValue={m?.firstName ?? ''} placeholder="First name *" className={input} />
        <input name="lastName" required defaultValue={m?.lastName ?? ''} placeholder="Last name *" className={input} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input name="email" type="email" defaultValue={m?.email ?? ''} placeholder="Email" className={`${input} col-span-2`} />
        <input name="graduationYear" type="number" defaultValue={m?.graduationYear ?? ''} placeholder="Grad yr" className={input} />
      </div>
      <input name="discord" defaultValue={m?.discord ?? ''} placeholder="Discord (e.g. sam#1234)" className={input} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Tile({ children, onClick, onDelete, deleteLabel }: { children: React.ReactNode; onClick: () => void; onDelete: () => void; deleteLabel: string }) {
  return (
    <div className="relative bg-slate-950/40 border border-slate-900 hover:border-slate-700 rounded-xl p-4 transition-all group">
      <button onClick={onClick} className="text-left w-full cursor-pointer">{children}</button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 p-1 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        aria-label={deleteLabel} title={deleteLabel}
      ><FiTrash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">{children}</div>;
}
