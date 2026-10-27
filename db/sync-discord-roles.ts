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
 *   --execute               Gate (SEED_ALLOW_REMOTE) -> plan -> typed confirmation (host and
 *                           counts) -> applies the diff, one student at a time, paced.
 *
 * Only roles listed in DISCORD_TIER_ROLES are ever added or removed. Roles staff assigned by hand
 * are never touched. Output is masked: initials and truncated ids, never full names or emails.
 *
 * Queries run strictly one at a time: the production Supabase transaction pooler hangs forever
 * on pipelined queries over one connection.
 *
 * Exit codes: 0 success, 1 refused or failed to run, 2 finished but some students failed.
 *
 * Run: npm run db:sync:discord-roles [-- --no-discord-read | --execute]
 */
import { createInterface } from 'readline/promises';
import postgres from 'postgres';
import { assertSeedTargetAllowed, seedTargetHost } from './seed-target';
import { DiscordError, DiscordRestAdapter, isDiscordSnowflake, planRoleChanges } from '../app/lib/onboarding/adapters/discord-rest';
import type { CommunityPlatformPort } from '../app/lib/onboarding/core/ports/external-ports';
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
}

export function parseArgs(argv: string[]): SyncOptions {
  let execute = false;
  let dryRun = false;
  let noDiscordRead = false;
  for (const arg of argv) {
    if (arg === '--execute') execute = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--no-discord-read') noDiscordRead = true;
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}. Valid: --dry-run, --no-discord-read, --execute.`);
  }
  if (execute && dryRun) throw new Error('--execute and --dry-run are mutually exclusive.');
  if (execute && noDiscordRead) throw new Error('--no-discord-read is only valid for a dry run: --execute has to read Discord.');
  return { execute, noDiscordRead };
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
  /** Null only for `--no-discord-read`. */
  adapter: Pick<CommunityPlatformPort, 'getMemberRoles' | 'syncManagedRoles'> | null;
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
  log('Reading the database (read-only)...');
  const members = await deps.loadMembers();
  log(`Students with a connected Discord account: ${members.length}\n`);

  const result: SyncScriptResult = {
    mode: opts.execute ? 'execute' : 'dry-run',
    members: members.length,
    inSync: 0, toChange: 0, adds: 0, removes: 0, notInGuild: 0, readFailed: 0, applied: 0, applyFailed: 0,
    exitCode: 0,
  };

  const planned: PlannedMember[] = [];
  let first = true;
  for (const member of members) {
    const desired = desiredRoleIds(member.memberships, deps.roles);
    const head = `  ${maskName(member.firstName, member.lastName)}  member=${maskMember(member.id)}  discord=${maskDiscord(member.discordUserId)}`;

    if (opts.noDiscordRead || !deps.adapter) {
      log(`${head}  desired=${label(desired)}`);
      continue;
    }
    if (!first) await pace();
    first = false;
    try {
      const adapter = deps.adapter;
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
  for (const p of planned) {
    await pace();
    const tag = `${maskName(p.member.firstName, p.member.lastName)}  member=${maskMember(p.member.id)}`;
    try {
      // syncManagedRoles re-reads the live roles, so a change made since the plan is respected.
      const out = await withRateLimitRetry(
        () => adapter.syncManagedRoles(p.member.discordUserId, { managed: deps.managed, desired: p.desired }),
        deps.sleep
      );
      result.applied++;
      log(`  ok     ${tag}  ${out.inGuild ? `+${out.added.length} -${out.removed.length}` : 'left the server'}`);
    } catch (error) {
      result.applyFailed++;
      log(`  FAILED ${tag}  ${failureText(error)}`);
    }
  }
  log(`\nDone: ${result.applied} applied, ${result.applyFailed} failed.`);
  if (result.applyFailed > 0) result.exitCode = 2;
  return result;
}

// ---------------------------------------------------------------------------
// Real SQL (also run against a fake in the tests)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
export interface SqlLike {
  unsafe(query: string, params?: unknown[]): PromiseLike<Row[]>;
}

/** Two queries, awaited one after the other (never pipelined: the prod pooler hangs on that). */
export async function loadMembersFrom(sql: SqlLike): Promise<ScriptMember[]> {
  const identities = (await sql.unsafe(
    `select pi.member_id, pi.provider_user_id, m.first_name, m.last_name
       from player_identities pi join members m on m.id = pi.member_id
      where pi.provider = 'discord'
      order by pi.member_id, pi.last_verified_at desc`
  )) as Row[];
  const memberships = (await sql.unsafe(
    `select p.member_id, g.slug as game_slug, r.name as roster_name, s.is_active, p.role
       from players p
       join rosters r on r.id = p.roster_id
       join teams t on t.id = r.team_id
       join seasons s on s.id = t.season_id
       join games g on g.id = t.game_id`
  )) as Row[];

  const byMember = new Map<string, RosterMembershipFact[]>();
  for (const r of memberships) {
    const id = String(r.member_id);
    if (!byMember.has(id)) byMember.set(id, []);
    byMember.get(id)!.push({
      gameSlug: String(r.game_slug),
      rosterName: String(r.roster_name),
      seasonIsActive: r.is_active === true,
      playerRole: String(r.role),
    });
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
