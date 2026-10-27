/**
 * One-off purge of onboarding TEST data: every student and school-manager
 * onboarding record that does not belong to staff, plus (optionally) the
 * Supabase Auth logins of the managers.
 *
 * Why a script and not a migration: a migration that deletes rows is applied by
 * anyone who later runs `db:migrate`, against whatever database their `.env`
 * points at. This runs only when someone types its name, shows its plan first,
 * and asks for the exact hostname and every irreversible count typed back.
 *
 * Modes
 *   (default) / --dry-run   Reads, prints the plan and who would be deleted,
 *                           mutates nothing, takes no backup.
 *   --execute               Gate (SEED_ALLOW_REMOTE) -> plan -> scoped backup ->
 *                           typed confirmation -> ONE transaction that re-plans under
 *                           table locks and rolls back on any mismatch.
 *   --delete-auth-users     Only with --execute. After the commit, deletes the
 *                           Supabase Auth users that belonged to deleted managers.
 *                           IRREVERSIBLE and NOT part of the pg_dump backup.
 *   --auth-user-ids-file=P  Only with --delete-auth-users. Retry list written by an
 *                           earlier run on this same host. Still filtered by staff protection.
 *   --skip-auth-staff-crosscheck  Only with --execute. Allows a run when the Auth
 *                           email cross-check against staff cannot be done.
 *
 * Staff protection is computed before anything is deleted and every rule errs
 * toward keeping. See buildPurgePlan().
 *
 * Run: npm run db:purge:onboarding-test-data [-- --execute [--delete-auth-users]]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline/promises';
import postgres from 'postgres';
import { BACKUP_DIR, requireFreshBackup } from './backup';
import { assertSeedTargetAllowed, seedTargetHost } from './seed-target';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tables this script deletes from, in the order it deletes (children first). */
export const DELETE_ORDER = [
  'match_reschedule_options',
  'match_reschedule_requests',
  'onboarding_consents',
  'student_demographics',
  'player_identities',
  'players',
  'player_invites',
  'manager_invites',
  'school_managers',
  'members',
] as const;
export type PurgeTable = (typeof DELETE_ORDER)[number];

/** Tables the backup covers: everything deleted from, plus the tables whose FKs could be touched. */
export const BACKUP_TABLES: readonly string[] = [
  ...DELETE_ORDER,
  'staff_members',
  'user_roles',
  'people',
  'leadership',
];

/**
 * Next.js cache tags backed by tables this script changes. `updateTag` only works inside a
 * Next.js server context, so a script cannot purge them; the owner saves an admin row instead.
 */
export const CACHE_TAGS_TO_REFRESH = ['members', 'players', 'rosters', 'teams', 'schools', 'matches', 'people', 'leadership'] as const;

export interface Snapshot {
  members: { id: string; firstName: string; lastName: string; email: string | null; memberKey: string | null; schoolName: string }[];
  players: { id: string; memberId: string; rosterId: string }[];
  rosters: { id: string; teamId: string }[];
  teams: { id: string; seasonId: string }[];
  seasons: { id: string; name: string; isActive: boolean }[];
  playerIdentities: { id: string; memberId: string; provider: string }[];
  studentDemographics: { id: string; memberId: string }[];
  onboardingConsents: { id: string; memberId: string; inviteId: string }[];
  /** `draftText` is the submission draft serialised to text, or null. Searched for staff emails. */
  playerInvites: { id: string; memberId: string | null; draftText: string | null }[];
  managerInvites: { id: string; memberId: string | null; draftText: string | null }[];
  schoolManagers: { id: string; userId: string; memberId: string | null }[];
  rescheduleRequests: { id: string; requestedByUserId: string }[];
  rescheduleOptions: { id: string; requestId: string }[];
  staffMembers: { userId: string; email: string; memberId: string | null; invitedBy: string | null }[];
  userRoles: { userId: string }[];
  staffInvites: { email: string; invitedBy: string }[];
  staffRevocations: { userId: string; email: string; revokedBy: string }[];
  /** Distinct non-null user ids in staff_audit_logs. */
  staffAuditUserIds: string[];
  /** Emails of staff applications whose status log says accepted. */
  acceptedStaffApplicationEmails: string[];
  people: { fullName: string; userId: string | null; memberId: string | null; email: string | null }[];
  leadership: { memberId: string | null }[];
}

export interface TableReport {
  table: PurgeTable;
  total: number;
  delete: number;
  protected: number;
  kept: number;
}

export interface ProtectedPerson {
  memberId: string | null;
  userId: string | null;
  name: string;
  email: string | null;
  reasons: string[];
}

/** A member the plan deletes or keeps for a reason the owner should eyeball. Masked values only. */
export interface MemberDetail {
  name: string;
  email: string;
  school: string;
  roles: string[];
  players: number;
  playersBySeason: string[];
  discord: boolean;
}

export interface PlanExtras {
  /** Emails of live Auth users that are staff or kept managers, found by the Auth cross-check. */
  authProtectedEmails?: string[];
}

export interface PurgePlan {
  /** Row ids to delete, per table. */
  deletes: Record<PurgeTable, string[]>;
  report: TableReport[];
  protectedPeople: ProtectedPerson[];
  /** Deleted members, masked. */
  deleteDetails: MemberDetail[];
  /** Members kept only because they came from the gold archive; their onboarding records are still purged. */
  archiveKeptMemberIds: string[];
  /** Members kept because they have a players row on a non-active (or undeterminable) season. */
  pastSeasonKept: MemberDetail[];
  /** Auth users referenced by deleted school_managers rows and not staff-protected (email check still pending). */
  authCandidates: string[];
  /** Auth user ids that are staff-protected or tied to a kept manager row. */
  authProtected: string[];
  /** Everything in the staff-protected set, for the email check done against live auth users. */
  protectedEmails: string[];
  protectedUserIds: string[];
  /** Auth users whose live email must be cross-checked against members: staff, role holders, kept managers. */
  crosscheckUserIds: string[];
  totalRows: number;
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(none)';
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function maskName(first: string, last: string): string {
  const initial = (s: string) => (s.trim() ? `${s.trim()[0].toUpperCase()}.` : '?');
  return `${initial(first)} ${initial(last)}`;
}

export function maskId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

// ---------------------------------------------------------------------------
// Planning (pure)
// ---------------------------------------------------------------------------

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Decides what is deleted and what is protected. Pure: no I/O, so every rule is testable.
 *
 * A person is STAFF-PROTECTED when any of these hold (and protection spreads through shared
 * rows until nothing new is added, so a half-linked person is never half-deleted):
 *   - their user id is in staff_members, user_roles, staff_revocations, staff_audit_logs,
 *     people.user_id, or is the inviter of a staff member / staff invite;
 *   - their member id is staff_members.member_id, people.member_id or leadership.member_id;
 *   - their email (case-insensitive) matches a staff member, staff invite, revoked staff,
 *     accepted staff application, people row, or the live Auth email of a staff / kept-manager
 *     Auth user (`extras.authProtectedEmails`);
 *   - their name equals a staff member's or a people row's name (ambiguous, so protect);
 *   - an invite's saved draft mentions a staff email.
 * Anything protected keeps its member row, school_managers rows, invites, consents,
 * demographics, identities, players and (via authProtected) its auth user.
 *
 * Roster history is never destroyed on a guess. A member is deleted only when every one of
 * their `players` rows sits on a roster whose season is the ACTIVE season of its game, and
 * they carry no gold-archive `member_key`. Anyone with a row on a past season, or on a season
 * that cannot be determined, keeps their member row and `players` rows (their onboarding
 * records are still purged). The `member_key` rule alone is not trusted: it is a schema
 * comment, and archive members created without one exist in principle.
 */
export function buildPurgePlan(s: Snapshot, extras: PlanExtras = {}): PurgePlan {
  // --- staff identity sets -------------------------------------------------
  const staffEmails = new Set<string>();
  const staffUserIds = new Set<string>();
  const staffMemberIds = new Set<string>();
  const staffNames = new Set<string>();
  const reasonsByMember = new Map<string, Set<string>>();
  const reasonsByUser = new Map<string, Set<string>>();
  const addReason = (m: Map<string, Set<string>>, id: string, reason: string) => {
    if (!m.has(id)) m.set(id, new Set());
    m.get(id)!.add(reason);
  };
  const markEmail = (email: string | null | undefined) => {
    const e = norm(email);
    if (e) staffEmails.add(e);
  };
  const markUser = (id: string | null | undefined, reason: string) => {
    if (!id) return;
    staffUserIds.add(id);
    addReason(reasonsByUser, id, reason);
  };
  const markMember = (id: string | null | undefined, reason: string) => {
    if (!id) return;
    staffMemberIds.add(id);
    addReason(reasonsByMember, id, reason);
  };

  const memberById = new Map(s.members.map((m) => [m.id, m]));
  const nameOf = (m: { firstName: string; lastName: string }) => `${norm(m.firstName)} ${norm(m.lastName)}`;

  for (const st of s.staffMembers) {
    markUser(st.userId, 'staff_members');
    markUser(st.invitedBy, 'invited staff');
    markEmail(st.email);
    markMember(st.memberId, 'staff_members.member_id');
    const linked = st.memberId ? memberById.get(st.memberId) : undefined;
    if (linked) staffNames.add(nameOf(linked));
  }
  for (const r of s.userRoles) markUser(r.userId, 'role assignment');
  for (const i of s.staffInvites) {
    markEmail(i.email);
    markUser(i.invitedBy, 'invited staff');
  }
  for (const r of s.staffRevocations) {
    markUser(r.userId, 'revoked staff');
    markUser(r.revokedBy, 'revoked staff');
    markEmail(r.email);
  }
  for (const id of s.staffAuditUserIds) markUser(id, 'staff audit log');
  for (const e of s.acceptedStaffApplicationEmails) markEmail(e);
  for (const p of s.people) {
    markUser(p.userId, 'people.user_id');
    markMember(p.memberId, 'people.member_id');
    markEmail(p.email);
    if (norm(p.fullName)) staffNames.add(norm(p.fullName));
  }
  for (const l of s.leadership) markMember(l.memberId, 'leadership.member_id');
  for (const e of extras.authProtectedEmails ?? []) markEmail(e);

  for (const m of s.members) {
    if (staffEmails.has(norm(m.email))) markMember(m.id, 'email matches staff');
    else if (staffNames.has(nameOf(m))) markMember(m.id, 'name matches staff (ambiguous)');
  }

  // --- invites protected by a staff email in their saved draft ---------------
  const staffEmailList = [...staffEmails];
  const draftMentionsStaff = (text: string | null) => {
    if (!text) return false;
    const t = text.toLowerCase();
    return staffEmailList.some((e) => t.includes(e));
  };
  const protectedInvite = new Set<string>();
  for (const i of [...s.playerInvites, ...s.managerInvites]) {
    if (draftMentionsStaff(i.draftText)) protectedInvite.add(i.id);
  }

  // --- fixpoint: protection spreads across the rows that tie people together ---
  const protectedManagerRow = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of s.schoolManagers) {
      if (protectedManagerRow.has(row.id)) continue;
      const viaUser = staffUserIds.has(row.userId);
      const viaMember = row.memberId !== null && staffMemberIds.has(row.memberId);
      if (viaUser || viaMember) {
        protectedManagerRow.add(row.id);
        changed = true;
        if (!staffUserIds.has(row.userId)) {
          markUser(row.userId, 'shares a manager row with a protected member');
        }
        if (row.memberId && !staffMemberIds.has(row.memberId)) {
          markMember(row.memberId, 'shares a manager row with a protected user');
        }
      }
    }
    for (const i of [...s.playerInvites, ...s.managerInvites]) {
      const viaMember = i.memberId !== null && staffMemberIds.has(i.memberId);
      if (viaMember && !protectedInvite.has(i.id)) {
        protectedInvite.add(i.id);
        changed = true;
      }
      if (protectedInvite.has(i.id) && i.memberId && !staffMemberIds.has(i.memberId)) {
        markMember(i.memberId, 'linked to a protected invite');
        changed = true;
      }
    }
    // A consent whose invite is protected keeps its member too: deleting the member would cascade it away.
    for (const c of s.onboardingConsents) {
      if (protectedInvite.has(c.inviteId) && !staffMemberIds.has(c.memberId)) {
        markMember(c.memberId, 'consent of a protected invite');
        changed = true;
      }
    }
  }

  // --- scope: which members have anything to do with onboarding ---------------
  const linked = new Set<string>();
  for (const x of s.playerInvites) if (x.memberId) linked.add(x.memberId);
  for (const x of s.managerInvites) if (x.memberId) linked.add(x.memberId);
  for (const x of s.schoolManagers) if (x.memberId) linked.add(x.memberId);
  for (const x of s.onboardingConsents) linked.add(x.memberId);
  for (const x of s.studentDemographics) linked.add(x.memberId);
  for (const x of s.playerIdentities) linked.add(x.memberId);

  // --- roster history: which season is each players row on? -------------------
  const rosterTeam = new Map(s.rosters.map((r) => [r.id, r.teamId]));
  const teamSeason = new Map(s.teams.map((t) => [t.id, t.seasonId]));
  const seasonById = new Map(s.seasons.map((x) => [x.id, x]));
  const playersByMember = new Map<string, Snapshot['players']>();
  for (const p of s.players) {
    if (!playersByMember.has(p.memberId)) playersByMember.set(p.memberId, []);
    playersByMember.get(p.memberId)!.push(p);
  }
  /** 'active' | 'past' | 'unknown', plus a label for the report. */
  const seasonOf = (rosterId: string): { status: 'active' | 'past' | 'unknown'; label: string } => {
    const teamId = rosterTeam.get(rosterId);
    const seasonId = teamId ? teamSeason.get(teamId) : undefined;
    const season = seasonId ? seasonById.get(seasonId) : undefined;
    if (!season) return { status: 'unknown', label: 'unknown season' };
    return season.isActive
      ? { status: 'active', label: `${season.name} (active)` }
      : { status: 'past', label: `${season.name} (past)` };
  };

  const rolesOf = (id: string): string[] => {
    const roles: string[] = [];
    if (s.schoolManagers.some((r) => r.memberId === id)) roles.push('has manager row');
    if (s.managerInvites.some((r) => r.memberId === id)) roles.push('manager invite');
    if (s.playerInvites.some((r) => r.memberId === id)) roles.push('player invite');
    return roles;
  };
  const detailOf = (id: string): MemberDetail => {
    const m = memberById.get(id)!;
    const rows = playersByMember.get(id) ?? [];
    const bySeason = new Map<string, number>();
    for (const p of rows) {
      const label = seasonOf(p.rosterId).label;
      bySeason.set(label, (bySeason.get(label) ?? 0) + 1);
    }
    return {
      name: maskName(m.firstName, m.lastName),
      email: maskEmail(m.email),
      school: m.schoolName,
      roles: rolesOf(id),
      players: rows.length,
      playersBySeason: [...bySeason].map(([k, v]) => `${k}: ${v}`),
      discord: s.playerIdentities.some((i) => i.memberId === id && i.provider === 'discord'),
    };
  };

  const deleteMembers: string[] = [];
  const archiveKept: string[] = [];
  const pastKept: string[] = [];
  const nonStaffLinked = new Set<string>(); // onboarding children of these are purged
  for (const m of s.members) {
    if (!linked.has(m.id) || staffMemberIds.has(m.id)) continue;
    nonStaffLinked.add(m.id);
    if (m.memberKey) {
      archiveKept.push(m.id);
      continue;
    }
    const rows = playersByMember.get(m.id) ?? [];
    if (rows.some((p) => seasonOf(p.rosterId).status !== 'active')) pastKept.push(m.id);
    else deleteMembers.push(m.id);
  }
  const deleteMemberSet = new Set(deleteMembers);

  const deletedManagerRows = s.schoolManagers.filter((r) => !protectedManagerRow.has(r.id));
  const keptUserIds = new Set([
    ...staffUserIds,
    ...s.schoolManagers.filter((r) => protectedManagerRow.has(r.id)).map((r) => r.userId),
  ]);
  // Reschedule requests made through the portal by managers being deleted.
  const goneUsers = new Set(deletedManagerRows.map((r) => r.userId).filter((id) => !keptUserIds.has(id)));
  const deletedRequestIds = new Set(s.rescheduleRequests.filter((r) => goneUsers.has(r.requestedByUserId)).map((r) => r.id));

  const deletes: Record<PurgeTable, string[]> = {
    match_reschedule_options: s.rescheduleOptions.filter((o) => deletedRequestIds.has(o.requestId)).map((o) => o.id),
    match_reschedule_requests: [...deletedRequestIds],
    onboarding_consents: s.onboardingConsents.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    student_demographics: s.studentDemographics.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    player_identities: s.playerIdentities.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    players: s.players.filter((r) => deleteMemberSet.has(r.memberId)).map((r) => r.id),
    player_invites: s.playerInvites.filter((r) => !protectedInvite.has(r.id)).map((r) => r.id),
    manager_invites: s.managerInvites.filter((r) => !protectedInvite.has(r.id)).map((r) => r.id),
    school_managers: deletedManagerRows.map((r) => r.id),
    members: deleteMembers,
  };

  // --- reporting --------------------------------------------------------------
  const inScopeProtectedMembers = (id: string) => linked.has(id) && staffMemberIds.has(id);
  const totals: Record<PurgeTable, number> = {
    match_reschedule_options: s.rescheduleOptions.length,
    match_reschedule_requests: s.rescheduleRequests.length,
    onboarding_consents: s.onboardingConsents.length,
    student_demographics: s.studentDemographics.length,
    player_identities: s.playerIdentities.length,
    players: s.players.length,
    player_invites: s.playerInvites.length,
    manager_invites: s.managerInvites.length,
    school_managers: s.schoolManagers.length,
    members: s.members.length,
  };
  const keptRequestIds = new Set(s.rescheduleRequests.filter((r) => keptUserIds.has(r.requestedByUserId)).map((r) => r.id));
  const protectedCounts: Record<PurgeTable, number> = {
    match_reschedule_options: s.rescheduleOptions.filter((o) => keptRequestIds.has(o.requestId)).length,
    match_reschedule_requests: keptRequestIds.size,
    onboarding_consents: s.onboardingConsents.filter((r) => inScopeProtectedMembers(r.memberId)).length,
    student_demographics: s.studentDemographics.filter((r) => inScopeProtectedMembers(r.memberId)).length,
    player_identities: s.playerIdentities.filter((r) => inScopeProtectedMembers(r.memberId)).length,
    players: s.players.filter((r) => inScopeProtectedMembers(r.memberId)).length,
    player_invites: s.playerInvites.filter((r) => protectedInvite.has(r.id)).length,
    manager_invites: s.managerInvites.filter((r) => protectedInvite.has(r.id)).length,
    school_managers: protectedManagerRow.size,
    members: s.members.filter((m) => inScopeProtectedMembers(m.id)).length,
  };
  const report: TableReport[] = DELETE_ORDER.map((table) => ({
    table,
    total: totals[table],
    delete: deletes[table].length,
    protected: protectedCounts[table],
    kept: totals[table] - deletes[table].length - protectedCounts[table],
  }));

  // --- auth users --------------------------------------------------------------
  const authCandidates = [...new Set(deletedManagerRows.map((r) => r.userId))].filter((id) => !keptUserIds.has(id));
  const authProtected = [...new Set(s.schoolManagers.map((r) => r.userId))].filter((id) => keptUserIds.has(id));
  const crosscheckUserIds = [
    ...new Set([
      ...s.staffMembers.map((x) => x.userId),
      ...s.userRoles.map((x) => x.userId),
      ...s.schoolManagers.filter((r) => protectedManagerRow.has(r.id)).map((r) => r.userId),
    ]),
  ];

  // --- people shown in the dry run ------------------------------------------------
  const protectedPeople: ProtectedPerson[] = [];
  const seenMembers = new Set<string>();
  for (const id of staffMemberIds) {
    const m = memberById.get(id);
    if (!m || !linked.has(id)) continue;
    seenMembers.add(id);
    const mgr = s.schoolManagers.find((r) => r.memberId === id);
    protectedPeople.push({
      memberId: id,
      userId: mgr?.userId ?? null,
      name: maskName(m.firstName, m.lastName),
      email: m.email,
      reasons: [...(reasonsByMember.get(id) ?? ['protected'])],
    });
  }
  for (const r of s.schoolManagers) {
    if (!protectedManagerRow.has(r.id) || (r.memberId && seenMembers.has(r.memberId))) continue;
    protectedPeople.push({
      memberId: r.memberId,
      userId: r.userId,
      name: '(manager row without member)',
      email: null,
      reasons: [...(reasonsByUser.get(r.userId) ?? ['protected'])],
    });
  }

  return {
    deletes,
    report,
    protectedPeople,
    deleteDetails: deleteMembers.map(detailOf),
    archiveKeptMemberIds: archiveKept,
    pastSeasonKept: pastKept.map(detailOf),
    authCandidates,
    authProtected,
    protectedEmails: staffEmailList,
    protectedUserIds: [...staffUserIds, ...keptUserIds],
    crosscheckUserIds,
    totalRows: DELETE_ORDER.reduce((n, t) => n + deletes[t].length, 0),
  };
}

/** Order-independent fingerprint of what a plan will delete, to prove the plan did not drift. */
export function planFingerprint(plan: PurgePlan): string {
  const parts = DELETE_ORDER.map((t) => `${t}:${[...plan.deletes[t]].sort().join(',')}`);
  parts.push(`auth:${[...plan.authCandidates].sort().join(',')}`);
  return parts.join('|');
}

/**
 * Narrows auth candidates by the live auth user's email. An email that cannot be read is
 * treated as staff (ambiguous protects), and so is any match against a staff email.
 */
export function filterAuthCandidates(
  candidates: string[],
  authEmails: Map<string, string | null>,
  protectedEmails: string[],
  protectedUserIds: string[]
): { toDelete: string[]; protectedIds: string[] } {
  const emails = new Set(protectedEmails.map(norm));
  const users = new Set(protectedUserIds);
  const toDelete: string[] = [];
  const protectedIds: string[] = [];
  for (const id of candidates) {
    const email = authEmails.get(id);
    if (users.has(id) || email === undefined || email === null || emails.has(norm(email))) {
      protectedIds.push(id);
    } else {
      toDelete.push(id);
    }
  }
  return { toDelete, protectedIds };
}

// ---------------------------------------------------------------------------
// Arguments, confirmation, retry file
// ---------------------------------------------------------------------------

export interface PurgeOptions {
  execute: boolean;
  deleteAuthUsers: boolean;
  authIdsFile?: string;
  skipAuthStaffCrosscheck: boolean;
}

export function parseArgs(argv: string[]): PurgeOptions {
  let execute = false;
  let dryRun = false;
  let deleteAuthUsers = false;
  let skipAuthStaffCrosscheck = false;
  let authIdsFile: string | undefined;
  for (const arg of argv) {
    if (arg === '--execute') execute = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--delete-auth-users') deleteAuthUsers = true;
    else if (arg === '--skip-auth-staff-crosscheck') skipAuthStaffCrosscheck = true;
    else if (arg.startsWith('--auth-user-ids-file=')) authIdsFile = arg.slice('--auth-user-ids-file='.length);
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}. Valid: --dry-run, --execute, --delete-auth-users, --auth-user-ids-file=<path>, --skip-auth-staff-crosscheck.`);
  }
  if (execute && dryRun) throw new Error('--execute and --dry-run are mutually exclusive.');
  if (deleteAuthUsers && !execute) throw new Error('--delete-auth-users is only valid together with --execute.');
  if (skipAuthStaffCrosscheck && !execute) throw new Error('--skip-auth-staff-crosscheck is only valid together with --execute.');
  if (authIdsFile && !deleteAuthUsers) throw new Error('--auth-user-ids-file requires --delete-auth-users.');
  return { execute, deleteAuthUsers, authIdsFile, skipAuthStaffCrosscheck };
}

/**
 * The exact phrase the operator must type. It names the host and every quantity that cannot
 * be undone: database rows, roster rows, Auth users. A run that skipped the Auth/staff
 * cross-check says so in the phrase too.
 */
export function confirmationPhrase(
  host: string,
  dbRows: number,
  playersRows: number,
  authUsers: number,
  crosscheckSkipped = false
): string {
  return `purge ${host} ${dbRows} ${playersRows} ${authUsers}${crosscheckSkipped ? ' without-auth-staff-crosscheck' : ''}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retry file: `{ "host", "createdAt", "ids" }`. Anything else, or another host, is refused. */
export function parseAuthIdsFile(text: string, host: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The auth ids file is not valid JSON.');
  }
  const o = parsed as { host?: unknown; createdAt?: unknown; ids?: unknown };
  if (!o || typeof o !== 'object' || typeof o.host !== 'string' || typeof o.createdAt !== 'string' || !Array.isArray(o.ids)) {
    throw new Error('The auth ids file must be { host, createdAt, ids }.');
  }
  if (Number.isNaN(Date.parse(o.createdAt))) throw new Error('The auth ids file has an invalid createdAt.');
  if (o.host !== host) throw new Error('The auth ids file was written for a different database host. Refusing.');
  if (!o.ids.every((x) => typeof x === 'string' && UUID_RE.test(x))) throw new Error('The auth ids file contains an entry that is not a user id.');
  return o.ids as string[];
}

export function formatPlan(plan: PurgePlan): string {
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  const lines = [
    `${'table'.padEnd(28)}${pad('total', 8)}${pad('DELETE', 8)}${pad('protected', 11)}${pad('kept', 8)}`,
    ...plan.report.map(
      (r) => `${r.table.padEnd(28)}${pad(r.total, 8)}${pad(r.delete, 8)}${pad(r.protected, 11)}${pad(r.kept, 8)}`
    ),
    `${'TOTAL DB ROWS'.padEnd(28)}${pad('', 8)}${pad(plan.totalRows, 8)}`,
  ];
  return lines.join('\n');
}

function formatMember(d: MemberDetail): string {
  const bits = [
    d.roles.length ? d.roles.join(', ') : 'no invite/manager row',
    `players=${d.players}${d.playersBySeason.length ? ` (${d.playersBySeason.join('; ')})` : ''}`,
    `discord=${d.discord ? 'yes' : 'no'}`,
  ];
  return `  ${d.name}  ${d.email}  school=${d.school}  [${bits.join(' | ')}]`;
}

/** Everything that would be deleted or deliberately kept, as masked lines. Printed and saved. */
export function formatWhoList(plan: PurgePlan, auth: { toDelete: { id: string; email: string | null }[] } | null): string[] {
  const lines: string[] = [];
  lines.push(`Members that would be DELETED (${plan.deleteDetails.length}):`);
  lines.push(...plan.deleteDetails.map(formatMember));
  lines.push(`\nMembers KEPT because they have roster history on a past or unknown season (${plan.pastSeasonKept.length}); their onboarding records are still deleted:`);
  lines.push(...plan.pastSeasonKept.map(formatMember));
  lines.push(`\nMembers KEPT because they carry a gold-archive member_key: ${plan.archiveKeptMemberIds.length} (onboarding records still deleted)`);
  if (auth) {
    lines.push(`\nAuth users that would be DELETED (${auth.toDelete.length}):`);
    lines.push(...auth.toDelete.map((a) => `  ${maskId(a.id)}  ${maskEmail(a.email)}`));
  } else {
    lines.push(`\nAuth users that are candidates (${plan.authCandidates.length}; live email check not possible):`);
    lines.push(...plan.authCandidates.map((id) => `  ${maskId(id)}`));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Orchestration (all I/O injected)
// ---------------------------------------------------------------------------

/** Counts that must not change (other than players and members, by exactly what was deleted). */
export const INVARIANT_KEYS = [
  'staff_members', 'staff_members_member', 'user_roles',
  'leadership', 'leadership_member', 'people', 'people_member',
  'schools', 'teams', 'rosters', 'matches', 'players',
] as const;
export type InvariantCounts = Record<(typeof INVARIANT_KEYS)[number], number>;

/** Handle inside the transaction. */
export interface TxHandle {
  lockTables(): Promise<void>;
  loadSnapshot(): Promise<Snapshot>;
  /** Deletes the rows and returns how many the database says it removed. */
  deleteByIds(table: PurgeTable, ids: string[]): Promise<number>;
  invariantCounts(): Promise<InvariantCounts>;
  /** How many of these members still exist. */
  countMembers(ids: string[]): Promise<number>;
  countSchoolManagers(ids: string[]): Promise<number>;
}

export interface PurgeDeps {
  host: string;
  assertTarget(): void;
  loadSnapshot(): Promise<Snapshot>;
  takeBackup(): string;
  prompt(question: string): Promise<string>;
  transaction<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T>;
  /** Auth side. Optional so dry-run and DB-only runs never need service credentials. */
  auth?: {
    hasCredentials(): boolean;
    emailOf(userId: string): Promise<string | null>;
    deleteUser(userId: string): Promise<void>;
  };
  readIdsFile?(path: string): string[];
  /** Called only after the database transaction has committed. */
  writeAuthList?(ids: string[]): string | undefined;
  writePlanFile?(lines: string[]): string | undefined;
  log(line: string): void;
}

export interface PurgeResult {
  mode: 'dry-run' | 'execute';
  plan: PurgePlan;
  deleted: number;
  authDeleted: string[];
  authFailed: string[];
  authProtected: string[];
}

/**
 * Builds the plan, then widens staff protection with the live Auth emails of every staff,
 * role-holding and kept-manager Auth user. Repeats until no new kept user appears, because a
 * newly protected member can keep another manager row.
 */
async function planWithAuthCrosscheck(
  snapshot: Snapshot,
  deps: PurgeDeps
): Promise<{ plan: PurgePlan; extras: PlanExtras; unreadable: string[] }> {
  const emails = new Map<string, string | null>();
  const unreadable = new Set<string>();
  let extras: PlanExtras = { authProtectedEmails: [] };
  let plan = buildPurgePlan(snapshot, extras);
  for (let i = 0; i < 5; i++) {
    const todo = plan.crosscheckUserIds.filter((id) => !emails.has(id));
    if (todo.length === 0) break;
    for (const id of todo) {
      let email: string | null = null;
      try {
        email = await deps.auth!.emailOf(id);
      } catch {
        email = null;
      }
      emails.set(id, email);
      if (email === null) unreadable.add(id);
    }
    extras = { authProtectedEmails: [...emails.values()].filter((e): e is string => e !== null) };
    plan = buildPurgePlan(snapshot, extras);
  }
  return { plan, extras, unreadable: [...unreadable] };
}

async function resolveAuth(
  plan: PurgePlan,
  extraIds: string[],
  deps: PurgeDeps
): Promise<{ toDelete: { id: string; email: string | null }[]; protectedIds: string[] } | null> {
  if (!deps.auth || !deps.auth.hasCredentials()) return null;
  const candidates = [...new Set([...plan.authCandidates, ...extraIds])];
  const emails = new Map<string, string | null>();
  for (const id of candidates) {
    try {
      emails.set(id, await deps.auth.emailOf(id));
    } catch {
      emails.set(id, null); // unreadable -> protected
    }
  }
  const r = filterAuthCandidates(candidates, emails, plan.protectedEmails, plan.protectedUserIds);
  return { toDelete: r.toDelete.map((id) => ({ id, email: emails.get(id) ?? null })), protectedIds: r.protectedIds };
}

export async function runPurge(opts: PurgeOptions, deps: PurgeDeps): Promise<PurgeResult> {
  const { log } = deps;

  if (opts.execute) {
    // Before reading anything: a refused target should cost nothing.
    deps.assertTarget();
    if (opts.deleteAuthUsers && !(deps.auth && deps.auth.hasCredentials())) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set to use --delete-auth-users. Nothing was changed.'
      );
    }
  }

  const snapshot = await deps.loadSnapshot();
  const haveCreds = Boolean(deps.auth && deps.auth.hasCredentials());

  let plan: PurgePlan;
  let extras: PlanExtras = {};
  let crosscheckSkipped = false;
  let unreadable: string[] = [];
  if (haveCreds) {
    ({ plan, extras, unreadable } = await planWithAuthCrosscheck(snapshot, deps));
    // The flag only excuses a check that could not be done; an unreadable staff Auth user is that.
    if (unreadable.length > 0) crosscheckSkipped = true;
  } else {
    plan = buildPurgePlan(snapshot);
    crosscheckSkipped = true;
  }

  if (opts.execute && crosscheckSkipped && !opts.skipAuthStaffCrosscheck) {
    throw new Error(
      haveCreds
        ? `The Auth/staff email cross-check could not read ${unreadable.length} Auth user(s) (${unreadable.map(maskId).join(', ')}). ` +
            'Fix that, or pass --skip-auth-staff-crosscheck to accept the risk. Nothing was changed.'
        : 'The Auth/staff email cross-check needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment, ' +
            'and they are not set. Set them, or pass --skip-auth-staff-crosscheck to accept the risk. Nothing was changed.'
    );
  }

  const retryIds = opts.authIdsFile ? (deps.readIdsFile?.(opts.authIdsFile) ?? []) : [];
  // A retry id is only valid for a former manager: it must have no manager row left at all.
  const remaining = new Set(snapshot.schoolManagers.map((r) => r.userId));
  const rejectedRetry = retryIds.filter((id) => remaining.has(id));
  const validRetry = retryIds.filter((id) => !remaining.has(id));
  if (rejectedRetry.length > 0) log(`Retry list: ignoring ${rejectedRetry.length} id(s) that still have a manager row.`);

  log(opts.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (nothing is changed, no backup is taken)');
  log(`Target host: ${deps.host}\n`);
  if (crosscheckSkipped) {
    log('!!! WARNING: the Auth/staff email cross-check was SKIPPED' +
      (haveCreds ? ` (${unreadable.length} Auth user(s) unreadable).` : ' (no Supabase service credentials in the environment).'));
    log('!!! A staff member whose member email differs from their DB staff email is NOT checked against Auth.');
    log('!!! --execute will refuse to run until this is fixed or --skip-auth-staff-crosscheck is passed.\n');
  }
  log(formatPlan(plan));
  log(`\nProtected people (kept, staff-linked): ${plan.protectedPeople.length}`);
  for (const p of plan.protectedPeople) {
    log(`  ${p.name}  ${maskEmail(p.email)}  member=${p.memberId ? maskId(p.memberId) : '-'} user=${p.userId ? maskId(p.userId) : '-'}  [${p.reasons.join('; ')}]`);
  }
  log(`Archive members kept (member_key set; onboarding records purged): ${plan.archiveKeptMemberIds.length}`);
  log(`Kept: has past-season roster history (row and players kept, onboarding records purged): ${plan.pastSeasonKept.length}`);

  const authRes = await resolveAuth(plan, validRetry, deps);
  const authProtected = [...plan.authProtected, ...(authRes?.protectedIds ?? [])];
  if (authRes) {
    log(`\nAuth users: ${authRes.toDelete.length} would be deleted, ${authProtected.length} protected (staff or kept manager rows).`);
  } else {
    log(`\nAuth users: ${plan.authCandidates.length} candidate(s) before the live email check; ${plan.authProtected.length} protected by database links. ` +
      'Live email check skipped: no Supabase service credentials in the environment.');
  }

  const who = formatWhoList(plan, authRes);
  log('\n' + who.join('\n'));
  const planFile = deps.writePlanFile?.([
    `purge-onboarding-test-data plan  host=${deps.host}  at=${new Date().toISOString()}  mode=${opts.execute ? 'execute' : 'dry-run'}`,
    '(masked values only)',
    '',
    formatPlan(plan),
    '',
    ...who,
  ]);
  if (planFile) log(`\nFull list saved to ${planFile}`);

  const result: PurgeResult = {
    mode: opts.execute ? 'execute' : 'dry-run',
    plan,
    deleted: 0,
    authDeleted: [],
    authFailed: [],
    authProtected,
  };

  if (!opts.execute) {
    log('\nDry run complete: 0 mutations executed.');
    printNextSteps(log);
    return result;
  }

  const authToDelete = opts.deleteAuthUsers && authRes ? authRes.toDelete : [];
  if (plan.totalRows === 0 && authToDelete.length === 0) {
    log('\nNothing to delete. Done.');
    return result;
  }

  // Backup before the prompt: the operator confirms knowing a restore point exists.
  if (plan.totalRows > 0) {
    const file = deps.takeBackup(); // throws -> nothing deleted
    log(`Backup written: ${file}`);
  }

  const phrase = confirmationPhrase(deps.host, plan.totalRows, plan.deletes.players.length, authToDelete.length, crosscheckSkipped);
  const answer = (
    await deps.prompt(
      `\n${plan.totalRows} database row(s) (${plan.deletes.players.length} of them roster rows) and ${authToDelete.length} Auth user(s) will be deleted.\n` +
        'Auth user deletion is IRREVERSIBLE and is NOT in the pg_dump backup.\n' +
        (crosscheckSkipped ? 'The Auth/staff email cross-check was SKIPPED.\n' : '') +
        `Type exactly "${phrase}" to proceed: `
    )
  ).trim();
  if (answer !== phrase) {
    throw new Error('Confirmation did not match. Aborted; nothing was deleted.');
  }

  if (plan.totalRows > 0) {
    const fingerprint = planFingerprint(plan);
    result.deleted = await deps.transaction(async (tx) => {
      await tx.lockTables();
      // Re-plan inside the transaction: what is deleted is what was reviewed, or nothing is.
      const again = buildPurgePlan(await tx.loadSnapshot(), extras);
      if (planFingerprint(again) !== fingerprint) {
        throw new Error('The data changed since the plan was shown. Rolled back; re-run the dry run.');
      }
      const before = await tx.invariantCounts();
      let n = 0;
      for (const table of DELETE_ORDER) {
        const ids = plan.deletes[table];
        const removed = ids.length === 0 ? 0 : await tx.deleteByIds(table, ids);
        if (removed !== ids.length) {
          throw new Error(`${table}: expected to delete ${ids.length} row(s) but the database removed ${removed}. Rolled back.`);
        }
        n += removed;
      }
      // Nothing outside the plan may have moved.
      const after = await tx.invariantCounts();
      for (const key of INVARIANT_KEYS) {
        const expected = key === 'players' ? before.players - plan.deletes.players.length : before[key];
        if (after[key] !== expected) {
          throw new Error(`Invariant ${key}: expected ${expected} after the delete but found ${after[key]}. Rolled back.`);
        }
      }
      // Protected rows must still be there.
      const protectedMemberIds = snapshot.members
        .map((m) => m.id)
        .filter((id) => plan.protectedPeople.some((p) => p.memberId === id));
      if ((await tx.countMembers(protectedMemberIds)) !== protectedMemberIds.length) {
        throw new Error('A protected member row is missing after the delete. Rolled back.');
      }
      const keptManagerIds = snapshot.schoolManagers
        .filter((r) => !plan.deletes.school_managers.includes(r.id))
        .map((r) => r.id);
      if ((await tx.countSchoolManagers(keptManagerIds)) !== keptManagerIds.length) {
        throw new Error('A kept school_managers row is missing after the delete. Rolled back.');
      }
      return n;
    });
    log(`\nCommitted: ${result.deleted} row(s) deleted.`);
  }

  // Written only now, and also for a database-only run: after the commit the manager rows are gone, so
  // this file is the only way to find the logins later. A rolled-back run must not leave one behind.
  if (plan.totalRows > 0 || authToDelete.length > 0) {
    const listIds = authRes ? authRes.toDelete.map((a) => a.id) : plan.authCandidates;
    const listFile = listIds.length > 0 ? deps.writeAuthList?.(listIds) : undefined;
    if (listFile) log(`Auth user id list saved to ${listFile} (for --delete-auth-users --auth-user-ids-file=...).`);
  }

  if (opts.deleteAuthUsers && authRes) {
    log(`\nDeleting ${authToDelete.length} auth user(s), one at a time...`);
    for (const { id } of authToDelete) {
      try {
        await deps.auth!.deleteUser(id);
        result.authDeleted.push(id);
        log(`  ok     ${maskId(id)}`);
      } catch (err) {
        result.authFailed.push(id);
        log(`  FAILED ${maskId(id)}: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown error'}`);
      }
    }
    log(`Auth users: ${result.authDeleted.length} deleted, ${result.authFailed.length} failed.`);
    if (result.authFailed.length > 0) {
      log('Retry the failures with --auth-user-ids-file=<the saved list>; see docs/dev/PURGE-ONBOARDING-TEST-DATA.md.');
    }
  }

  printNextSteps(log);
  return result;
}

function printNextSteps(log: (l: string) => void): void {
  log('\nCache: the Vercel Data Cache survives redeploys. Refresh these tags: ' + CACHE_TAGS_TO_REFRESH.join(', ') + '.');
  log('A script cannot call updateTag (it only works inside Next.js). Save any admin row with its existing values (every admin action calls updateTag), or purge the tags from the Vercel dashboard.');
}

// ---------------------------------------------------------------------------
// Real SQL (also run against an in-memory PGlite in the tests)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
/** The slice of postgres.js this script uses; the tests satisfy it with PGlite. */
export interface SqlLike {
  unsafe(query: string, params?: unknown[]): PromiseLike<Row[] & { count: number }>;
}
const str = (v: unknown) => (v == null ? null : String(v));

export async function loadSnapshotFrom(sql: SqlLike): Promise<Snapshot> {
  const q = async (text: string): Promise<Row[]> => (await sql.unsafe(text)) as unknown as Row[];
  const [members, players, rosters, teams, seasons, identities, demos, consents, pInv, mInv, mgrs, reqs, opts, staff, roles, sInv, revs, audit, accepted, people, lead] =
    await Promise.all([
      q('select m.id, m.first_name, m.last_name, m.email, m.member_key, coalesce(s.name, \'\') as school_name from members m left join schools s on s.id = m.school_id'),
      q('select id, member_id, roster_id from players'),
      q('select id, team_id from rosters'),
      q('select id, season_id from teams'),
      q('select id, name, is_active from seasons'),
      q('select id, member_id, provider from player_identities'),
      q('select id, member_id from student_demographics'),
      q('select id, member_id, invite_id from onboarding_consents'),
      q('select id, member_id, submission_draft::text as draft from player_invites'),
      q('select id, member_id, submission_draft::text as draft from manager_invites'),
      q('select id, user_id, member_id from school_managers'),
      q('select id, requested_by_user_id from match_reschedule_requests'),
      q('select id, request_id from match_reschedule_options'),
      q('select user_id, email, member_id, invited_by from staff_members'),
      q('select user_id from user_roles'),
      q('select email, invited_by from staff_invites'),
      q('select user_id, email, revoked_by from staff_revocations'),
      q('select distinct user_id from staff_audit_logs where user_id is not null'),
      q(
        `select distinct a.email from staff_applications a
         join application_status_logs l on l.application_id = a.id and l.application_type = 'staff'
         where l.status = 'accepted'`
      ),
      q('select full_name, user_id, member_id, email from people'),
      q('select member_id from leadership'),
    ]);
  return {
    members: members.map((r) => ({ id: String(r.id), firstName: String(r.first_name), lastName: String(r.last_name), email: str(r.email), memberKey: str(r.member_key), schoolName: String(r.school_name) })),
    players: players.map((r) => ({ id: String(r.id), memberId: String(r.member_id), rosterId: String(r.roster_id) })),
    rosters: rosters.map((r) => ({ id: String(r.id), teamId: String(r.team_id) })),
    teams: teams.map((r) => ({ id: String(r.id), seasonId: String(r.season_id) })),
    seasons: seasons.map((r) => ({ id: String(r.id), name: String(r.name), isActive: r.is_active === true })),
    playerIdentities: identities.map((r) => ({ id: String(r.id), memberId: String(r.member_id), provider: String(r.provider) })),
    studentDemographics: demos.map((r) => ({ id: String(r.id), memberId: String(r.member_id) })),
    onboardingConsents: consents.map((r) => ({ id: String(r.id), memberId: String(r.member_id), inviteId: String(r.invite_id) })),
    playerInvites: pInv.map((r) => ({ id: String(r.id), memberId: str(r.member_id), draftText: str(r.draft) })),
    managerInvites: mInv.map((r) => ({ id: String(r.id), memberId: str(r.member_id), draftText: str(r.draft) })),
    schoolManagers: mgrs.map((r) => ({ id: String(r.id), userId: String(r.user_id), memberId: str(r.member_id) })),
    rescheduleRequests: reqs.map((r) => ({ id: String(r.id), requestedByUserId: String(r.requested_by_user_id) })),
    rescheduleOptions: opts.map((r) => ({ id: String(r.id), requestId: String(r.request_id) })),
    staffMembers: staff.map((r) => ({ userId: String(r.user_id), email: String(r.email), memberId: str(r.member_id), invitedBy: str(r.invited_by) })),
    userRoles: roles.map((r) => ({ userId: String(r.user_id) })),
    staffInvites: sInv.map((r) => ({ email: String(r.email), invitedBy: String(r.invited_by) })),
    staffRevocations: revs.map((r) => ({ userId: String(r.user_id), email: String(r.email), revokedBy: String(r.revoked_by) })),
    staffAuditUserIds: audit.map((r) => String(r.user_id)),
    acceptedStaffApplicationEmails: accepted.map((r) => String(r.email)),
    people: people.map((r) => ({ fullName: String(r.full_name), userId: str(r.user_id), memberId: str(r.member_id), email: str(r.email) })),
    leadership: lead.map((r) => ({ memberId: str(r.member_id) })),
  };
}

const CHUNK = 500;
const placeholders = (ids: string[]) => ids.map((_, k) => `$${k + 1}::uuid`).join(', ');

export function makeTxHandle(tx: SqlLike): TxHandle {
  return {
    async lockTables() {
      const tables = [...DELETE_ORDER, 'staff_members', 'user_roles', 'people', 'leadership'];
      await tx.unsafe(`lock table ${tables.map((t) => `"${t}"`).join(', ')} in share row exclusive mode`);
    },
    loadSnapshot: () => loadSnapshotFrom(tx),
    async deleteByIds(table, ids) {
      if (!(DELETE_ORDER as readonly string[]).includes(table)) throw new Error(`Refusing to delete from ${table}.`);
      let removed = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        const res = await tx.unsafe(`delete from "${table}" where id in (${placeholders(part)})`, part);
        removed += res.count;
      }
      return removed;
    },
    async invariantCounts() {
      const rows = (await tx.unsafe(
        `select
           (select count(*) from staff_members)::int as staff_members,
           (select count(*) from staff_members where member_id is not null)::int as staff_members_member,
           (select count(*) from user_roles)::int as user_roles,
           (select count(*) from leadership)::int as leadership,
           (select count(*) from leadership where member_id is not null)::int as leadership_member,
           (select count(*) from people)::int as people,
           (select count(*) from people where member_id is not null)::int as people_member,
           (select count(*) from schools)::int as schools,
           (select count(*) from teams)::int as teams,
           (select count(*) from rosters)::int as rosters,
           (select count(*) from matches)::int as matches,
           (select count(*) from players)::int as players`
      )) as unknown as InvariantCounts[];
      const r = rows[0];
      return Object.fromEntries(INVARIANT_KEYS.map((k) => [k, Number(r[k])])) as InvariantCounts;
    },
    async countMembers(ids) {
      return countIn(tx, 'members', ids);
    },
    async countSchoolManagers(ids) {
      return countIn(tx, 'school_managers', ids);
    },
  };
}

async function countIn(tx: SqlLike, table: string, ids: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const rows = (await tx.unsafe(`select count(*)::int as n from "${table}" where id in (${placeholders(part)})`, part)) as unknown as { n: number }[];
    n += rows[0].n;
  }
  return n;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupsDir(): string {
  const dir = resolve(process.cwd(), BACKUP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const host = seedTargetHost(url) ?? 'unknown-host';

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const result = await runPurge(opts, {
      host,
      assertTarget: () => assertSeedTargetAllowed(url),
      loadSnapshot: () => loadSnapshotFrom(sql as unknown as SqlLike),
      takeBackup: () => requireFreshBackup(BACKUP_TABLES),
      prompt: async (q) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          return await rl.question(q);
        } finally {
          rl.close();
        }
      },
      transaction: (fn) => sql.begin((tx) => fn(makeTxHandle(tx as unknown as SqlLike))) as Promise<never>,
      auth: {
        hasCredentials: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
        async emailOf(userId) {
          const { createServiceClient } = await import('../app/lib/supabase/service');
          const { data, error } = await createServiceClient().auth.admin.getUserById(userId);
          if (error) throw error;
          return data.user?.email ?? null;
        },
        async deleteUser(userId) {
          const { createServiceClient } = await import('../app/lib/supabase/service');
          const { error } = await createServiceClient().auth.admin.deleteUser(userId);
          if (error) throw error;
        },
      },
      readIdsFile: (p) => parseAuthIdsFile(readFileSync(resolve(process.cwd(), p), 'utf8'), host),
      writeAuthList: (ids) => {
        const file = resolve(backupsDir(), `purge-onboarding-auth-ids-${stamp()}.json`);
        writeFileSync(file, JSON.stringify({ host, createdAt: new Date().toISOString(), ids }), 'utf8');
        return file;
      },
      writePlanFile: (lines) => {
        const file = resolve(backupsDir(), `purge-onboarding-plan-${stamp()}.txt`);
        writeFileSync(file, lines.join('\n') + '\n', 'utf8');
        return file;
      },
      log: (l) => console.log(l),
    });
    if (result.authFailed.length > 0) process.exitCode = 2;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && /purge-onboarding-test-data\.ts$/.test(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((err) => {
    console.error('Purge failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
