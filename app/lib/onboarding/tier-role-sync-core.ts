import { DiscordError, isDiscordSnowflake } from './adapters/discord-rest';
import type { CommunityPlatformPort } from './core/ports/external-ports';
import { emptyReport, maskMemberId, type TierSyncReport } from './tier-sync-report';
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
  adapter: Pick<CommunityPlatformPort, 'syncManagedRoles'>;
  /** Pause between members, to stay under Discord's rate limits. */
  paceMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

/**
 * Brings each member's tier roles in line with their roster memberships. Members are processed
 * strictly one at a time (one database query, then one Discord call at a time) and a failure on
 * one never stops the others. Never throws. Idempotent: a second run over unchanged data makes
 * no Discord write.
 */
export async function runTierRoleSync(memberIds: string[], deps: TierSyncDeps): Promise<TierSyncReport> {
  const report = emptyReport();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? ((line: string) => console.error(line));
  const unique = [...new Set(memberIds)];
  let rateLimited = false;

  for (let i = 0; i < unique.length; i++) {
    const memberId = unique[i];
    if (rateLimited) {
      report.failed++;
      report.failures.push({ member: maskMemberId(memberId), reason: 'not_attempted_after_rate_limit' });
      continue;
    }
    if (i > 0 && deps.paceMs) await sleep(deps.paceMs);

    try {
      const discordUserId = await deps.loadDiscordUserId(memberId);
      if (!discordUserId || !isDiscordSnowflake(discordUserId)) {
        report.skippedNoDiscord++;
        continue;
      }
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
      report.failures.push({ member: maskMemberId(memberId), reason });
      log(`Discord tier role sync failed for member ${maskMemberId(memberId)}: ${error instanceof DiscordError ? error.code : (error instanceof Error ? error.name : 'unknown')}`);
      if (reason === 'rate_limited') rateLimited = true;
    }
  }
  return report;
}
