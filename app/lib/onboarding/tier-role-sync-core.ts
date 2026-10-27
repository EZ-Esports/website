import { DiscordError, isDiscordSnowflake } from './adapters/discord-rest';
import type { CommunityPlatformPort, TierPreflightResult } from './core/ports/external-ports';
import {
  blockedReport,
  emptyReport,
  maskMemberId,
  type TierSyncPreview,
  type TierSyncReport,
} from './tier-sync-report';
import { desiredRoleIds, type RosterMembershipFact, type TierRoleMap } from './tier-roles';

export * from './tier-sync-report';

/**
 * The tier-role sync with every dependency injected (database reads, Discord adapter, clock), so
 * it runs the same under the live hook, the staff action and the backfill script and is testable
 * with fakes. The database-backed wiring lives in `tier-role-sync.ts`.
 */

export interface TierSyncDeps {
  roles: TierRoleMap;
  /** Role ids the sync may touch (the ids in `roles`). */
  managed: string[];
  /** The member's Discord snowflake, or null when they have none. Read before memberships. */
  loadDiscordUserId(memberId: string): Promise<string | null>;
  loadMemberships(memberId: string): Promise<RosterMembershipFact[]>;
  adapter: Pick<CommunityPlatformPort, 'syncManagedRoles' | 'checkTierRolesAssignable'>;
  /** Pause between Discord calls for different members, to stay under Discord's rate limits. */
  paceMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

/** Failures that will repeat identically for every remaining member, so the run stops instead of retrying each. */
const ABORT_CODES = new Set(['rate_limited', 'bot_misconfigured', 'role_not_found']);

const loggedBlocked = new Set<string>();
/** Test hook: forget which blocked reasons were already logged. */
export function resetBlockedLog(): void {
  loggedBlocked.clear();
}

/**
 * Brings each member's tier roles in line with their roster memberships. Members are processed
 * strictly one at a time (one database query, then one Discord call at a time) and a failure on
 * one never stops the others, except a failure that would repeat for every member (rate limit,
 * bot permissions, a missing role), which aborts the rest of the run.
 *
 * Fails closed: before any member is touched the bot is checked once (cached by the adapter) to be
 * able to assign every configured tier role. If it cannot, or the check itself cannot complete,
 * the run changes nothing and reports `blocked`.
 *
 * Never throws. Idempotent: a second run over unchanged data makes no Discord write.
 */
export async function runTierRoleSync(memberIds: string[], deps: TierSyncDeps): Promise<TierSyncReport> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? ((line: string) => console.error(line));
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return emptyReport();

  let preflight: TierPreflightResult;
  try {
    preflight = await deps.adapter.checkTierRolesAssignable(deps.managed);
  } catch {
    preflight = { ok: false, reason: 'preflight_failed' };
  }
  if (!preflight.ok) {
    if (!loggedBlocked.has(preflight.reason)) {
      loggedBlocked.add(preflight.reason);
      log(`Discord tier role sync is BLOCKED (${preflight.reason}); no roles were changed. See docs/dev/DISCORD.md.`);
    }
    return blockedReport(preflight.reason);
  }

  const report = emptyReport();
  let abortReason: string | null = null;
  let madeDiscordCall = false;

  for (const memberId of unique) {
    if (abortReason) {
      report.failed++;
      report.failures.push({
        member: maskMemberId(memberId),
        memberId,
        reason: abortReason === 'rate_limited' ? 'not_attempted_after_rate_limit' : 'not_attempted_after_config_error',
      });
      continue;
    }

    try {
      // Identity first: a member with no Discord account costs no pause and no Discord call.
      const discordUserId = await deps.loadDiscordUserId(memberId);
      if (!discordUserId || !isDiscordSnowflake(discordUserId)) {
        report.skippedNoDiscord++;
        continue;
      }
      if (madeDiscordCall && deps.paceMs) await sleep(deps.paceMs);
      madeDiscordCall = true;

      // Read immediately before writing, so a concurrent roster change is as fresh as possible.
      const memberships = await deps.loadMemberships(memberId);
      const desired = desiredRoleIds(memberships, deps.roles);
      const outcome = await deps.adapter.syncManagedRoles(discordUserId, { managed: deps.managed, desired });
      if (!outcome.inGuild) report.notInGuild++;
      else if (outcome.added.length > 0 || outcome.removed.length > 0) report.synced++;
      else report.unchanged++;
    } catch (error) {
      // Only a Discord failure code is logged. Other errors (a database error message can embed
      // the query parameters) are reduced to their class name.
      const reason: string = error instanceof DiscordError ? error.code : 'unexpected_error';
      report.failed++;
      report.failures.push({ member: maskMemberId(memberId), memberId, reason });
      log(`Discord tier role sync failed for member ${maskMemberId(memberId)}: ${error instanceof DiscordError ? error.code : (error instanceof Error ? error.name : 'unknown')}`);
      if (ABORT_CODES.has(reason)) abortReason = reason;
    }
  }
  return report;
}

/**
 * What a school-wide sync would do, from the database alone (sequential reads, no Discord call).
 * `stripAll` flags the dangerous case: connected members exist but none would hold a tier role, so
 * the sync would take the tier roles from everyone. That is exactly what a school looks like just
 * after a new season is activated and before it has rosters.
 */
export async function previewTierSync(
  memberIds: string[],
  deps: Pick<TierSyncDeps, 'roles' | 'loadDiscordUserId' | 'loadMemberships'>
): Promise<TierSyncPreview> {
  const unique = [...new Set(memberIds)];
  let withDiscord = 0;
  let withTierRoles = 0;
  for (const id of unique) {
    const discord = await deps.loadDiscordUserId(id);
    if (!discord || !isDiscordSnowflake(discord)) continue;
    withDiscord++;
    if (desiredRoleIds(await deps.loadMemberships(id), deps.roles).length > 0) withTierRoles++;
  }
  return { members: unique.length, withDiscord, withTierRoles, stripAll: withDiscord > 0 && withTierRoles === 0 };
}
