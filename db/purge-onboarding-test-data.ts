/**
 * One-off purge of onboarding TEST data: every student and school-manager
 * onboarding record that does not belong to staff, plus (optionally) the
 * Supabase Auth logins of the managers.
 *
 * Why a script and not a migration: a migration that deletes rows is applied by
 * anyone who later runs `db:migrate`, against whatever database their `.env`
 * points at. This runs only when someone types its name, shows its plan first,
 * and asks for the exact hostname and row count back.
 *
 * Modes
 *   (default) / --dry-run   Reads, prints the plan, mutates nothing, takes no backup.
 *   --execute               Gate (SEED_ALLOW_REMOTE) -> plan -> scoped backup ->
 *                           typed confirmation -> ONE transaction that re-plans under
 *                           table locks and rolls back on any mismatch.
 *   --delete-auth-users     Only with --execute. After the commit, deletes the
 *                           Supabase Auth users that belonged to deleted managers.
 *   --auth-user-ids-file=P  Only with --delete-auth-users. Retry list written by an
 *                           earlier run (ids that failed). Still filtered by staff protection.
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
  members: { id: string; firstName: string; lastName: string; email: string | null; memberKey: string | null }[];
  players: { id: string; memberId: string }[];
  playerIdentities: { id: string; memberId: string }[];
  studentDemographics: { id: string; memberId: string }[];
  onboardingConsents: { id: string; memberId: string; inviteId: string }[];
  /** `draftText` is the submission draft serialised to text, or null. Searched for staff emails. */
  playerInvites: { id: string; memberId: string | null; draftText: string | null }[];
  managerInvites: { id: string; memberId: string | null; draftText: string | null }[];
  schoolManagers: { id: string; userId: string; memberId: string | null }[];
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

export interface PurgePlan {
  /** Row ids to delete, per table. */
  deletes: Record<PurgeTable, string[]>;
  report: TableReport[];
  protectedPeople: ProtectedPerson[];
  /** Members kept only because they came from the gold archive; their onboarding records are still purged. */
  archiveKeptMemberIds: string[];
  /** Auth users referenced by deleted school_managers rows and not staff-protected (email check still pending). */
  authCandidates: string[];
  /** Auth user ids that are staff-protected or tied to a kept manager row. */
  authProtected: string[];
  /** Everything in the staff-protected set, for the email check done against live auth users. */
  protectedEmails: string[];
  protectedUserIds: string[];
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
 *     accepted staff application or people row;
 *   - their name equals a staff member's or a people row's name (ambiguous, so protect);
 *   - an invite's saved draft mentions a staff email.
 * Anything protected keeps its member row, school_managers rows, invites, consents,
 * demographics, identities, players and (via authProtected) its auth user.
 *
 * Members that carry a gold-archive `member_key` are never deleted: the archive's past rosters
 * reference them and onboarding upserts by email, so a real alumnus can have been "onboarded".
 * Their onboarding records are purged, their row and roster history are kept.
 */
export function buildPurgePlan(s: Snapshot): PurgePlan {
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
        // The two sets may have just grown; take another pass.
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

  const deleteMembers: string[] = [];
  const archiveKept: string[] = [];
  const nonStaffLinked = new Set<string>(); // onboarding children of these are purged
  for (const m of s.members) {
    if (!linked.has(m.id) || staffMemberIds.has(m.id)) continue;
    nonStaffLinked.add(m.id);
    if (m.memberKey) archiveKept.push(m.id);
    else deleteMembers.push(m.id);
  }
  const deleteMemberSet = new Set(deleteMembers);

  const deletes: Record<PurgeTable, string[]> = {
    onboarding_consents: s.onboardingConsents.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    student_demographics: s.studentDemographics.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    player_identities: s.playerIdentities.filter((r) => nonStaffLinked.has(r.memberId)).map((r) => r.id),
    players: s.players.filter((r) => deleteMemberSet.has(r.memberId)).map((r) => r.id),
    player_invites: s.playerInvites.filter((r) => !protectedInvite.has(r.id)).map((r) => r.id),
    manager_invites: s.managerInvites.filter((r) => !protectedInvite.has(r.id)).map((r) => r.id),
    school_managers: s.schoolManagers.filter((r) => !protectedManagerRow.has(r.id)).map((r) => r.id),
    members: deleteMembers,
  };

  // --- reporting --------------------------------------------------------------
  const inScopeProtectedMembers = (id: string) => linked.has(id) && staffMemberIds.has(id);
  const totals: Record<PurgeTable, number> = {
    onboarding_consents: s.onboardingConsents.length,
    student_demographics: s.studentDemographics.length,
    player_identities: s.playerIdentities.length,
    players: s.players.length,
    player_invites: s.playerInvites.length,
    manager_invites: s.managerInvites.length,
    school_managers: s.schoolManagers.length,
    members: s.members.length,
  };
  const protectedCounts: Record<PurgeTable, number> = {
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
  const deletedRows = s.schoolManagers.filter((r) => !protectedManagerRow.has(r.id));
  const keptUserIds = new Set([
    ...staffUserIds,
    ...s.schoolManagers.filter((r) => protectedManagerRow.has(r.id)).map((r) => r.userId),
  ]);
  const authCandidates = [...new Set(deletedRows.map((r) => r.userId))].filter((id) => !keptUserIds.has(id));
  const authProtected = [...new Set(s.schoolManagers.map((r) => r.userId))].filter((id) => keptUserIds.has(id));

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
    archiveKeptMemberIds: archiveKept,
    authCandidates,
    authProtected,
    protectedEmails: staffEmailList,
    protectedUserIds: [...staffUserIds, ...keptUserIds],
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
// Arguments and confirmation
// ---------------------------------------------------------------------------

export interface PurgeOptions {
  execute: boolean;
  deleteAuthUsers: boolean;
  authIdsFile?: string;
}

export function parseArgs(argv: string[]): PurgeOptions {
  let execute = false;
  let dryRun = false;
  let deleteAuthUsers = false;
  let authIdsFile: string | undefined;
  for (const arg of argv) {
    if (arg === '--execute') execute = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--delete-auth-users') deleteAuthUsers = true;
    else if (arg.startsWith('--auth-user-ids-file=')) authIdsFile = arg.slice('--auth-user-ids-file='.length);
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}. Valid: --dry-run, --execute, --delete-auth-users, --auth-user-ids-file=<path>.`);
  }
  if (execute && dryRun) throw new Error('--execute and --dry-run are mutually exclusive.');
  if (deleteAuthUsers && !execute) throw new Error('--delete-auth-users is only valid together with --execute.');
  if (authIdsFile && !deleteAuthUsers) throw new Error('--auth-user-ids-file requires --delete-auth-users.');
  return { execute, deleteAuthUsers, authIdsFile };
}

/** The exact phrase the operator must type: names the host and the row count they reviewed. */
export function confirmationPhrase(host: string, totalRows: number): string {
  return `purge ${host} ${totalRows}`;
}

export function formatPlan(plan: PurgePlan): string {
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  const lines = [
    `${'table'.padEnd(22)}${pad('total', 8)}${pad('DELETE', 8)}${pad('protected', 11)}${pad('kept', 8)}`,
    ...plan.report.map(
      (r) => `${r.table.padEnd(22)}${pad(r.total, 8)}${pad(r.delete, 8)}${pad(r.protected, 11)}${pad(r.kept, 8)}`
    ),
    `${'TOTAL DB ROWS'.padEnd(22)}${pad('', 8)}${pad(plan.totalRows, 8)}`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Orchestration (all I/O injected)
// ---------------------------------------------------------------------------

/** Handle inside the transaction. */
export interface TxHandle {
  lockTables(): Promise<void>;
  loadSnapshot(): Promise<Snapshot>;
  /** Deletes the rows and returns how many the database says it removed. */
  deleteByIds(table: PurgeTable, ids: string[]): Promise<number>;
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
  writeAuthList?(ids: string[]): string | undefined;
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

async function resolveAuth(
  plan: PurgePlan,
  extraIds: string[],
  deps: PurgeDeps
): Promise<{ toDelete: string[]; protectedIds: string[] } | null> {
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
  return filterAuthCandidates(candidates, emails, plan.protectedEmails, plan.protectedUserIds);
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

  const retryIds = opts.authIdsFile ? (deps.readIdsFile?.(opts.authIdsFile) ?? []) : [];
  const snapshot = await deps.loadSnapshot();
  const plan = buildPurgePlan(snapshot);

  log(opts.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (nothing is changed, no backup is taken)');
  log(`Target host: ${deps.host}\n`);
  log(formatPlan(plan));
  log(`\nProtected people (kept, staff-linked): ${plan.protectedPeople.length}`);
  for (const p of plan.protectedPeople) {
    log(`  ${p.name}  ${maskEmail(p.email)}  member=${p.memberId ? maskId(p.memberId) : '-'} user=${p.userId ? maskId(p.userId) : '-'}  [${p.reasons.join('; ')}]`);
  }
  log(`Archive members kept (member row and roster history stay; their onboarding records are purged): ${plan.archiveKeptMemberIds.length}`);

  const authRes = await resolveAuth(plan, retryIds, deps);
  const authProtected = [...plan.authProtected, ...(authRes?.protectedIds ?? [])];
  if (authRes) {
    log(`\nAuth users: ${authRes.toDelete.length} would be deleted, ${authProtected.length} protected (staff or kept manager rows).`);
  } else {
    log(`\nAuth users: ${plan.authCandidates.length} candidate(s) before the live email check; ${plan.authProtected.length} protected by database links. ` +
      'Live email check skipped: no Supabase service credentials in the environment.');
  }

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

  if (plan.totalRows === 0 && (!opts.deleteAuthUsers || !authRes || authRes.toDelete.length === 0)) {
    log('\nNothing to delete. Done.');
    return result;
  }

  // Backup before the prompt: the operator confirms knowing a restore point exists.
  if (plan.totalRows > 0) {
    const file = deps.takeBackup(); // throws -> nothing deleted
    log(`Backup written: ${file}`);
  }

  const phrase = confirmationPhrase(deps.host, plan.totalRows);
  const answer = (await deps.prompt(`\nType exactly "${phrase}" to delete ${plan.totalRows} database row(s): `)).trim();
  if (answer !== phrase) {
    throw new Error('Confirmation did not match. Aborted; nothing was deleted.');
  }

  const authListFile = opts.deleteAuthUsers && authRes ? deps.writeAuthList?.(authRes.toDelete) : undefined;
  if (authListFile) log(`Auth user id list saved to ${authListFile} (for --auth-user-ids-file retries).`);

  if (plan.totalRows > 0) {
    const fingerprint = planFingerprint(plan);
    result.deleted = await deps.transaction(async (tx) => {
      await tx.lockTables();
      // Re-plan inside the transaction: what is deleted is what was reviewed, or nothing is.
      const again = buildPurgePlan(await tx.loadSnapshot());
      if (planFingerprint(again) !== fingerprint) {
        throw new Error('The data changed since the plan was shown. Rolled back; re-run the dry run.');
      }
      let n = 0;
      for (const table of DELETE_ORDER) {
        const ids = plan.deletes[table];
        const removed = ids.length === 0 ? 0 : await tx.deleteByIds(table, ids);
        if (removed !== ids.length) {
          throw new Error(`${table}: expected to delete ${ids.length} row(s) but the database removed ${removed}. Rolled back.`);
        }
        n += removed;
      }
      // Protected rows must still be there.
      const protectedMemberIds = snapshot.members
        .map((m) => m.id)
        .filter((id) => plan.protectedPeople.some((p) => p.memberId === id));
      if ((await tx.countMembers(protectedMemberIds)) !== protectedMemberIds.length) {
        throw new Error('A protected member row is missing after the delete. Rolled back.');
      }
      const protectedManagerIds = snapshot.schoolManagers
        .filter((r) => !plan.deletes.school_managers.includes(r.id))
        .map((r) => r.id);
      if ((await tx.countSchoolManagers(protectedManagerIds)) !== protectedManagerIds.length) {
        throw new Error('A kept school_managers row is missing after the delete. Rolled back.');
      }
      return n;
    });
    log(`\nCommitted: ${result.deleted} row(s) deleted.`);
  }

  if (opts.deleteAuthUsers && authRes) {
    log(`\nDeleting ${authRes.toDelete.length} auth user(s), one at a time...`);
    for (const id of authRes.toDelete) {
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
// Real implementations
// ---------------------------------------------------------------------------

type Sql = ReturnType<typeof postgres>;
type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));

export async function loadSnapshotFrom(sql: Sql): Promise<Snapshot> {
  const q = async (text: string): Promise<Row[]> => (await sql.unsafe(text)) as unknown as Row[];
  const [members, players, identities, demos, consents, pInv, mInv, mgrs, staff, roles, sInv, revs, audit, accepted, people, lead] =
    await Promise.all([
      q('select id, first_name, last_name, email, member_key from members'),
      q('select id, member_id from players'),
      q('select id, member_id from player_identities'),
      q('select id, member_id from student_demographics'),
      q('select id, member_id, invite_id from onboarding_consents'),
      q('select id, member_id, submission_draft::text as draft from player_invites'),
      q('select id, member_id, submission_draft::text as draft from manager_invites'),
      q('select id, user_id, member_id from school_managers'),
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
    members: members.map((r) => ({ id: String(r.id), firstName: String(r.first_name), lastName: String(r.last_name), email: str(r.email), memberKey: str(r.member_key) })),
    players: players.map((r) => ({ id: String(r.id), memberId: String(r.member_id) })),
    playerIdentities: identities.map((r) => ({ id: String(r.id), memberId: String(r.member_id) })),
    studentDemographics: demos.map((r) => ({ id: String(r.id), memberId: String(r.member_id) })),
    onboardingConsents: consents.map((r) => ({ id: String(r.id), memberId: String(r.member_id), inviteId: String(r.invite_id) })),
    playerInvites: pInv.map((r) => ({ id: String(r.id), memberId: str(r.member_id), draftText: str(r.draft) })),
    managerInvites: mInv.map((r) => ({ id: String(r.id), memberId: str(r.member_id), draftText: str(r.draft) })),
    schoolManagers: mgrs.map((r) => ({ id: String(r.id), userId: String(r.user_id), memberId: str(r.member_id) })),
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

function txHandle(tx: Sql): TxHandle {
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
        const res = await tx.unsafe(`delete from "${table}" where id in (${part.map((_, k) => `$${k + 1}::uuid`).join(', ')})`, part);
        removed += res.count;
      }
      return removed;
    },
    async countMembers(ids) {
      return countIn(tx, 'members', ids);
    },
    async countSchoolManagers(ids) {
      return countIn(tx, 'school_managers', ids);
    },
  };
}

async function countIn(tx: Sql, table: string, ids: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const rows = (await tx.unsafe(`select count(*)::int as n from "${table}" where id in (${part.map((_, k) => `$${k + 1}::uuid`).join(', ')})`, part)) as unknown as { n: number }[];
    n += rows[0].n;
  }
  return n;
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
      loadSnapshot: () => loadSnapshotFrom(sql),
      takeBackup: () => requireFreshBackup(BACKUP_TABLES),
      prompt: async (q) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          return await rl.question(q);
        } finally {
          rl.close();
        }
      },
      transaction: (fn) => sql.begin((tx) => fn(txHandle(tx as unknown as Sql))) as Promise<never>,
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
      readIdsFile: (p) => {
        const parsed = JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8')) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) throw new Error('The ids file must be a JSON array of strings.');
        return parsed as string[];
      },
      writeAuthList: (ids) => {
        const dir = resolve(process.cwd(), BACKUP_DIR);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const file = resolve(dir, `purge-onboarding-auth-ids-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        writeFileSync(file, JSON.stringify(ids), 'utf8');
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
