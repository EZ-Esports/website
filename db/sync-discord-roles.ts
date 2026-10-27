/**
 * Backfill / audit of Discord tier roles ("Valorant Varsity", "Valorant JV", ...) from the roster
 * tables, for the one-time catch-up and for any later "make Discord match the rosters" pass.
 * The live path is notifyRosterMembershipChanged; this script covers everyone at once.
 *
 * Modes
 *   (default) / --dry-run   Reads the database and, for each student with a connected Discord
 *                           account, reads their current roles from Discord and prints what a sync
 *                           WOULD add and remove. Changes nothing anywhere.
 *   --no-discord-read       With the dry run only: skip the Discord reads and just print the
 *                           roles each student is meant to hold. Needs no bot token.
 *   --execute               Gate (SEED_ALLOW_REMOTE) -> preflight -> plan -> typed confirmation
 *                           (host and counts) -> applies the diff, one student at a time, paced.
 *                           Each student's rosters are re-read just before their roles are written,
 *                           so a roster change made while the prompt waited is not undone.
 *   --allow-strip-all       With --execute only. Without it the script refuses to run when it would
 *                           remove the tier roles from EVERY connected student (what an empty,
 *                           newly activated season looks like).
 *
 * Fails closed: before any role is touched the bot is checked (Manage Roles, every tier role exists,
 * is an ordinary role and sits below the bot's highest role). If that fails, --execute refuses and
 * the dry run prints why.
 *
 * Only roles listed in DISCORD_TIER_ROLES are ever added or removed. Roles staff assigned by hand
 * are never touched. Output is masked: initials and truncated ids, never full names or emails.
 *
 * Queries run strictly one at a time: the production Supabase transaction pooler hangs forever
 * on pipelined queries over one connection.
 *
 * Exit codes: 0 success, 1 refused or failed to run, 2 finished but blocked or some students failed.
 *
 * Run: npm run db:sync:discord-roles [-- --no-discord-read | --execute [--allow-strip-all]]
 */
import { createInterface } from 'readline/promises';
import postgres from 'postgres';
import { assertSeedTargetAllowed, seedTargetHost } from './seed-target';
import { DiscordError, DiscordRestAdapter, isDiscordSnowflake, planRoleChanges } from '../app/lib/onboarding/adapters/discord-rest';
import type { CommunityPlatformPort } from '../app/lib/onboarding/core/ports/external-ports';
import { TIER_BLOCKED_LABELS } from '../app/lib/onboarding/tier-sync-report';
import { desiredRoleIds, getTierRoleConfig, roleLabels, type RosterMembershipFact, type TierRoleMap } from '../app/lib/onboarding/tier-roles';

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

export function maskName(first: string, last: string): string {
  const initial = (s: string) => (s.trim() ? `${s.trim()[0].toUpperCase()}.` : '?');
  return `${initial(first)} ${initial(last)}`;
}
export const maskMember = (id: string) => `${id.slice(0, 8)}...`;
export const maskDiscord = (id: string) => `${id.slice(0, 4)}...${id.slice(-2)}`;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

export interface SyncOptions {
  execute: boolean;
  noDiscordRead: boolean;
  allowStripAll: boolean;
}

export function parseArgs(argv: string[]): SyncOptions {
  let execute = false;
  let dryRun = false;
  let noDiscordRead = false;
  let allowStripAll = false;
  for (const arg of argv) {
    if (arg === '--execute') execute = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--no-discord-read') noDiscordRead = true;
    else if (arg === '--allow-strip-all') allowStripAll = true;
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}. Valid: --dry-run, --no-discord-read, --execute, --allow-strip-all.`);
  }
  if (execute && dryRun) throw new Error('--execute and --dry-run are mutually exclusive.');
  if (execute && noDiscordRead) throw new Error('--no-discord-read is only valid for a dry run: --execute has to read Discord.');
  if (allowStripAll && !execute) throw new Error('--allow-strip-all is only valid together with --execute.');
  return { execute, noDiscordRead, allowStripAll };
}

/** The exact phrase the operator types: names the host and the size of the change. */
export function confirmationPhrase(host: string, members: number, adds: number, removes: number): string {
  return `sync-roles ${host} ${members} ${adds} ${removes}`;
}

// ---------------------------------------------------------------------------
// Orchestration (all I/O injected)
// ---------------------------------------------------------------------------

export interface ScriptMember {
  id: string;
  firstName: string;
  lastName: string;
  discordUserId: string;
  memberships: RosterMembershipFact[];
}

export interface SyncScriptDeps {
  host: string;
  roles: TierRoleMap;
  managed: string[];
  assertTarget(): void;
  loadMembers(): Promise<ScriptMember[]>;
  /** Re-reads ONE student's rosters, so --execute does not apply a plan older than the prompt. */
  reloadMemberships(memberId: string): Promise<RosterMembershipFact[]>;
  /** Null only for `--no-discord-read`. */
  adapter: Pick<CommunityPlatformPort, 'getMemberRoles' | 'syncManagedRoles' | 'checkTierRolesAssignable'> | null;
  prompt(question: string): Promise<string>;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
  /** Pause between Discord calls. */
  paceMs?: number;
}

export interface SyncScriptResult {
  mode: 'dry-run' | 'execute';
  members: number;
  inSync: number;
  toChange: number;
  adds: number;
  removes: number;
  notInGuild: number;
  readFailed: number;
  applied: number;
  applyFailed: number;
  /** Students whose desired roles changed between the plan and the write (--execute). */
  planChanged: number;
  /** Set when the bot preflight refused the run; nothing was read from or written to Discord roles. */
  blockedReason?: string;
  stripAll: boolean;
  exitCode: 0 | 2;
}

/** Retries a Discord call a few times when rate limited, waiting what Discord asks for. */
async function withRateLimitRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof DiscordError && error.code === 'rate_limited' && attempt < 3) {
        await sleep(Math.ceil((error.retryAfterSeconds ?? 5) * 1000));
        continue;
      }
      throw error;
    }
  }
}

const failureText = (error: unknown) =>
  error instanceof DiscordError ? error.code : error instanceof Error ? error.name : 'unknown';

/** A failure that would repeat for every remaining student, so the run stops instead of trying each. */
const isAbortError = (error: unknown) =>
  error instanceof DiscordError && (error.code === 'bot_misconfigured' || error.code === 'role_not_found' || error.code === 'rate_limited');

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

interface PlannedMember {
  member: ScriptMember;
  desired: string[];
  toAdd: string[];
  toRemove: string[];
}

export async function runRoleSync(opts: SyncOptions, deps: SyncScriptDeps): Promise<SyncScriptResult> {
  const { log } = deps;
  const labels = roleLabels(deps.roles);
  const label = (ids: string[]) => `[${ids.map((id) => labels.get(id) ?? '?').join(', ')}]`;
  const pace = async () => {
    if (deps.paceMs) await deps.sleep(deps.paceMs);
  };

  if (opts.execute) {
    // Before reading anything: a refused target should cost nothing.
    deps.assertTarget();
    if (!deps.adapter) throw new Error('--execute needs the Discord bot (DISCORD_BOT_TOKEN and DISCORD_GUILD_ID). Nothing was changed.');
  }
  if (!opts.noDiscordRead && !deps.adapter) {
    throw new Error('Reading roles from Discord needs DISCORD_BOT_TOKEN and DISCORD_GUILD_ID. Use --no-discord-read to only list desired roles.');
  }

  log(opts.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (nothing is changed)');
  log(`Target host: ${deps.host}`);

  // Fail closed before any role is read or written.
  let blockedReason: string | undefined;
  if (deps.adapter) {
    const pre = await deps.adapter.checkTierRolesAssignable(deps.managed);
    if (!pre.ok) {
      blockedReason = pre.reason;
      log(`\nBLOCKED (${pre.reason}): ${TIER_BLOCKED_LABELS[pre.reason]}`);
      if (opts.execute) throw new Error(`The bot cannot assign the tier roles (${pre.reason}). Nothing was changed.`);
      log('The dry run continues with the database only; fix this before --execute.');
    }
  }

  log('Reading the database (read-only)...');
  const members = await deps.loadMembers();
  log(`Students with a connected Discord account: ${members.length}\n`);

  const desiredByMember = new Map(members.map((m) => [m.id, desiredRoleIds(m.memberships, deps.roles)]));
  const withTierRoles = [...desiredByMember.values()].filter((d) => d.length > 0).length;
  const stripAll = members.length > 0 && withTierRoles === 0;

  const result: SyncScriptResult = {
    mode: opts.execute ? 'execute' : 'dry-run',
    members: members.length,
    inSync: 0, toChange: 0, adds: 0, removes: 0, notInGuild: 0, readFailed: 0, applied: 0, applyFailed: 0, planChanged: 0,
    blockedReason,
    stripAll,
    exitCode: blockedReason ? 2 : 0,
  };

  if (stripAll) {
    log(
      `WARNING: none of the ${members.length} connected students would hold a Varsity or JV role (no tier roster in an active season). ` +
        'A sync would REMOVE the tier roles from every one of them. This is what an empty, newly activated season looks like.\n'
    );
    if (opts.execute && !opts.allowStripAll) {
      throw new Error('Refusing to remove the tier roles from every student. Re-run with --allow-strip-all if that is really intended. Nothing was changed.');
    }
  }

  const readDiscord = !opts.noDiscordRead && !blockedReason && deps.adapter;
  const planned: PlannedMember[] = [];
  let first = true;
  let aborted = false;
  for (const member of members) {
    const desired = desiredByMember.get(member.id) ?? [];
    const head = `  ${maskName(member.firstName, member.lastName)}  member=${maskMember(member.id)}  discord=${maskDiscord(member.discordUserId)}`;

    if (!readDiscord) {
      log(`${head}  desired=${label(desired)}`);
      continue;
    }
    if (aborted) {
      result.readFailed++;
      log(`${head}  NOT READ: the run stopped on a bot or rate-limit error`);
      continue;
    }
    if (!first) await pace();
    first = false;
    try {
      const adapter = deps.adapter!;
      const current = await withRateLimitRetry(() => adapter.getMemberRoles(member.discordUserId), deps.sleep);
      if (current === null) {
        result.notInGuild++;
        log(`${head}  not in the Discord server`);
        continue;
      }
      const { toAdd, toRemove } = planRoleChanges(current, { managed: deps.managed, desired });
      if (toAdd.length === 0 && toRemove.length === 0) {
        result.inSync++;
        log(`${head}  in sync ${label(desired)}`);
        continue;
      }
      result.toChange++;
      result.adds += toAdd.length;
      result.removes += toRemove.length;
      planned.push({ member, desired, toAdd, toRemove });
      log(`${head}  add ${label(toAdd)} remove ${label(toRemove)}`);
    } catch (error) {
      result.readFailed++;
      log(`${head}  READ FAILED: ${failureText(error)}`);
      if (isAbortError(error)) aborted = true;
    }
  }

  log(
    `\nSummary: ${result.members} students, ${result.inSync} in sync, ${result.toChange} to change ` +
      `(${result.adds} role adds, ${result.removes} role removals), ${result.notInGuild} not in the server, ${result.readFailed} unreadable.`
  );

  if (!opts.execute) {
    log('\nDry run complete: 0 mutations executed.');
    return result;
  }
  if (result.readFailed > 0 && aborted) {
    throw new Error('The run stopped on a bot or rate-limit error while reading Discord. Nothing was changed.');
  }
  if (planned.length === 0) {
    log('\nNothing to change. Done.');
    return result;
  }

  const phrase = confirmationPhrase(deps.host, result.toChange, result.adds, result.removes);
  const answer = (
    await deps.prompt(
      `\n${result.toChange} student(s) will have ${result.adds} role(s) added and ${result.removes} removed in the live Discord server.\n` +
        `Type exactly "${phrase}" to proceed: `
    )
  ).trim();
  if (answer !== phrase) throw new Error('Confirmation did not match. Aborted; nothing was changed.');

  log('\nApplying, one student at a time...');
  const adapter = deps.adapter!;
  let stopped = false;
  for (const p of planned) {
    const tag = `${maskName(p.member.firstName, p.member.lastName)}  member=${maskMember(p.member.id)}`;
    if (stopped) {
      result.applyFailed++;
      log(`  SKIPPED ${tag}  the run stopped on a bot or rate-limit error`);
      continue;
    }
    await pace();
    try {
      // The plan is as old as the prompt answer. Re-read this student's rosters and use what is true now.
      const desiredNow = desiredRoleIds(await deps.reloadMemberships(p.member.id), deps.roles);
      if (!sameSet(desiredNow, p.desired)) {
        result.planChanged++;
        log(`  changed since the plan: ${tag}  was ${label(p.desired)}, now ${label(desiredNow)}`);
      }
      // syncManagedRoles re-reads the live roles, so a change made since the plan is respected.
      const out = await withRateLimitRetry(
        () => adapter.syncManagedRoles(p.member.discordUserId, { managed: deps.managed, desired: desiredNow }),
        deps.sleep
      );
      result.applied++;
      log(`  ok     ${tag}  ${out.inGuild ? `+${out.added.length} -${out.removed.length}` : 'left the server'}`);
    } catch (error) {
      result.applyFailed++;
      log(`  FAILED ${tag}  ${failureText(error)}`);
      if (isAbortError(error)) stopped = true;
    }
  }
  log(`\nDone: ${result.applied} applied, ${result.applyFailed} failed${result.planChanged ? `, ${result.planChanged} had a changed plan (their current rosters were used)` : ''}.`);
  if (result.applyFailed > 0) result.exitCode = 2;
  return result;
}

// ---------------------------------------------------------------------------
// Real SQL (also run against PGlite in the tests)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
export interface SqlLike {
  unsafe(query: string, params?: unknown[]): PromiseLike<Row[]>;
}

const IDENTITIES_SQL = `select pi.member_id, pi.provider_user_id, m.first_name, m.last_name
       from player_identities pi join members m on m.id = pi.member_id
      where pi.provider = 'discord'
      order by pi.member_id, pi.last_verified_at desc`;

const MEMBERSHIPS_SELECT = `select p.member_id, g.slug as game_slug, r.name as roster_name, s.is_active, p.role
       from players p
       join rosters r on r.id = p.roster_id
       join teams t on t.id = r.team_id
       join seasons s on s.id = t.season_id
       join games g on g.id = t.game_id`;

const toFact = (r: Row): RosterMembershipFact => ({
  gameSlug: String(r.game_slug),
  rosterName: String(r.roster_name),
  seasonIsActive: r.is_active === true,
  playerRole: String(r.role),
});

/** One student's memberships (the same join as the bulk read, filtered). */
export async function loadMembershipsFor(sql: SqlLike, memberId: string): Promise<RosterMembershipFact[]> {
  const rows = (await sql.unsafe(`${MEMBERSHIPS_SELECT} where p.member_id = $1::uuid`, [memberId])) as Row[];
  return rows.map(toFact);
}

/** Two queries, awaited one after the other (never pipelined: the prod pooler hangs on that). */
export async function loadMembersFrom(sql: SqlLike): Promise<ScriptMember[]> {
  const identities = (await sql.unsafe(IDENTITIES_SQL)) as Row[];
  const memberships = (await sql.unsafe(MEMBERSHIPS_SELECT)) as Row[];

  const byMember = new Map<string, RosterMembershipFact[]>();
  for (const r of memberships) {
    const id = String(r.member_id);
    if (!byMember.has(id)) byMember.set(id, []);
    byMember.get(id)!.push(toFact(r));
  }

  // The freshest VALID snowflake per member, matching the live sync.
  const out = new Map<string, ScriptMember>();
  for (const r of identities) {
    const id = String(r.member_id);
    const discord = String(r.provider_user_id);
    if (out.has(id) || !isDiscordSnowflake(discord)) continue;
    out.set(id, {
      id,
      firstName: String(r.first_name),
      lastName: String(r.last_name),
      discordUserId: discord,
      memberships: byMember.get(id) ?? [],
    });
  }
  return [...out.values()];
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const host = seedTargetHost(url) ?? 'unknown-host';

  const config = getTierRoleConfig();
  if (config.status !== 'enabled') {
    throw new Error(
      config.status === 'invalid'
        ? `DISCORD_TIER_ROLES is invalid: ${config.errors.join(' ')}`
        : 'DISCORD_TIER_ROLES is not set; there are no tier roles to sync.'
    );
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const adapter = botToken && guildId ? new DiscordRestAdapter({ botToken, guildId }) : null;

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const result = await runRoleSync(opts, {
      host,
      roles: config.roles,
      managed: config.managed,
      assertTarget: () => assertSeedTargetAllowed(url),
      loadMembers: () => loadMembersFrom(sql as unknown as SqlLike),
      reloadMemberships: (id) => loadMembershipsFor(sql as unknown as SqlLike, id),
      adapter,
      prompt: async (q) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          return await rl.question(q);
        } finally {
          rl.close();
        }
      },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      log: (l) => console.log(l),
      paceMs: 250,
    });
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && /sync-discord-roles\.ts$/.test(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((err) => {
    console.error('Role sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
