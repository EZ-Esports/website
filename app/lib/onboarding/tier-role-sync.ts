import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { DiscordRestAdapter, isDiscordSnowflake } from './adapters/discord-rest';
import type { CommunityPlatformPort } from './core/ports/external-ports';
import {
  disabledReport,
  emptyReport,
  runTierRoleSync,
  type TierSyncReport,
} from './tier-role-sync-core';
import { getTierRoleConfig, type RosterMembershipFact } from './tier-roles';

/** Gap between members, so a school-wide resync stays under Discord's per-route rate limits. */
const PACE_MS = 150;

let warnedDiscordEnv = false;

/**
 * Builds the bot adapter from the two env vars the sync needs. Unlike `getDiscordConfig` it does
 * not demand the OAuth client keys, and a missing value is a quiet no-op rather than an error.
 */
function adapterFromEnv(env: NodeJS.ProcessEnv = process.env): CommunityPlatformPort | null {
  const botToken = env.DISCORD_BOT_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) {
    if (!warnedDiscordEnv) {
      warnedDiscordEnv = true;
      console.info('Discord tier role sync skipped: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not set.');
    }
    return null;
  }
  return new DiscordRestAdapter({ botToken, guildId });
}

/** The member's Discord snowflake. `player_identities` is not unique per member, so the freshest valid one wins. */
async function loadDiscordUserId(memberId: string): Promise<string | null> {
  const rows = await db
    .select({ providerUserId: schema.playerIdentities.providerUserId })
    .from(schema.playerIdentities)
    .where(and(eq(schema.playerIdentities.memberId, memberId), eq(schema.playerIdentities.provider, 'discord')))
    .orderBy(desc(schema.playerIdentities.lastVerifiedAt));
  return rows.map((r) => r.providerUserId).find(isDiscordSnowflake) ?? null;
}

/** Every roster the member is on, across all games and seasons; the reconciler filters to active seasons. */
async function loadMemberships(memberId: string): Promise<RosterMembershipFact[]> {
  return db
    .select({
      gameSlug: schema.games.slug,
      rosterName: schema.rosters.name,
      seasonIsActive: schema.seasons.isActive,
      playerRole: schema.players.role,
    })
    .from(schema.players)
    .innerJoin(schema.rosters, eq(schema.rosters.id, schema.players.rosterId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.rosters.teamId))
    .innerJoin(schema.seasons, eq(schema.seasons.id, schema.teams.seasonId))
    .innerJoin(schema.games, eq(schema.games.id, schema.teams.gameId))
    .where(eq(schema.players.memberId, memberId));
}

/**
 * Syncs the Discord tier roles of the given members from their current roster memberships.
 * A no-op (never an error) when `DISCORD_TIER_ROLES` or the bot env vars are not configured.
 * Never throws; per-member failures are isolated and reported.
 */
export async function syncTierRolesForMembers(memberIds: string[]): Promise<TierSyncReport> {
  try {
    const config = getTierRoleConfig();
    if (config.status === 'disabled') return disabledReport('config_unset');
    if (config.status === 'invalid') return disabledReport('config_invalid');
    if (memberIds.length === 0) return emptyReport();

    const adapter = adapterFromEnv();
    if (!adapter) return disabledReport('discord_unconfigured');

    return await runTierRoleSync(memberIds, {
      roles: config.roles,
      managed: config.managed,
      loadDiscordUserId,
      loadMemberships,
      adapter,
      paceMs: PACE_MS,
    });
  } catch (error) {
    console.error('Discord tier role sync failed:', error instanceof Error ? error.name : 'unknown error');
    return { ...emptyReport(), failed: memberIds.length };
  }
}
