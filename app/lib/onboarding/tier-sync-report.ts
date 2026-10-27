/**
 * Report types and wording for the tier-role sync. Kept free of server and Discord imports so the
 * staff UI can use them in a client component.
 */

export type TierSyncFailureReason =
  | 'bot_misconfigured'
  | 'role_not_found'
  | 'rate_limited'
  | 'outage'
  | 'unexpected_error'
  | 'not_attempted_after_rate_limit'
  | 'not_attempted_after_config_error';

/** Staff-facing wording per reason. Contains no member data. */
export const TIER_SYNC_FAILURE_LABELS: Record<string, string> = {
  bot_misconfigured: 'The bot lacks Manage Roles, or its role is below the tier roles.',
  role_not_found: 'A tier role id in DISCORD_TIER_ROLES does not exist in the server.',
  rate_limited: 'Discord rate limit; try again in a minute.',
  outage: 'Discord did not respond.',
  unexpected_error: 'Unexpected error; see the server log.',
  not_attempted_after_rate_limit: 'Not attempted because Discord rate limited the run.',
  not_attempted_after_config_error: 'Not attempted because the run stopped on a bot or role configuration error.',
};

/** Why the preflight refused the whole run. Matches `TierPreflightReason` in the platform port. */
export type TierBlockedReason =
  | 'missing_manage_roles'
  | 'role_not_below_bot'
  | 'role_missing'
  | 'role_is_managed'
  | 'preflight_failed';

/** What each blocked reason means and how to fix it. Contains no ids or tokens. */
export const TIER_BLOCKED_LABELS: Record<TierBlockedReason, string> = {
  missing_manage_roles: 'The bot does not have the Manage Roles permission. Grant it to the bot in Discord server settings.',
  role_not_below_bot: 'At least one tier role is not below the bot\'s highest role. In Server Settings -> Roles, drag the bot\'s role above every tier role.',
  role_missing: 'At least one role id in DISCORD_TIER_ROLES does not exist in the server. Check the ids.',
  role_is_managed: 'At least one role in DISCORD_TIER_ROLES belongs to an integration or bot and cannot be assigned. Use ordinary roles.',
  preflight_failed: 'Discord could not be checked right now (network error, rate limit or a rejected bot token). Nothing was changed; try again in a minute.',
};

export interface TierSyncFailure {
  /** Masked label: the uuid prefix, which the staff action prefixes with the member's initials. */
  member: string;
  reason: string;
  /** Full member id. Present only inside the server; the staff action strips it before returning. */
  memberId?: string;
}

export interface TierSyncReport {
  /**
   * `disabled`: nothing attempted (`disabledReason`). `blocked`: the preflight proved the bot cannot
   * assign the roles, so no role was added or removed (`blockedReason`).
   */
  status: 'ok' | 'disabled' | 'blocked';
  disabledReason?: 'config_unset' | 'config_invalid' | 'discord_unconfigured';
  blockedReason?: TierBlockedReason;
  /** Members whose Discord roles were changed. */
  synced: number;
  /** Members already holding exactly the right tier roles. */
  unchanged: number;
  skippedNoDiscord: number;
  notInGuild: number;
  failed: number;
  failures: TierSyncFailure[];
}

export function emptyReport(): TierSyncReport {
  return { status: 'ok', synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 0, failures: [] };
}

export function disabledReport(reason: NonNullable<TierSyncReport['disabledReason']>): TierSyncReport {
  return { ...emptyReport(), status: 'disabled', disabledReason: reason };
}

export function blockedReport(reason: TierBlockedReason): TierSyncReport {
  return { ...emptyReport(), status: 'blocked', blockedReason: reason };
}

export function maskMemberId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

/** "A. F." from a name, for staff to recognise a member without the name being shown. */
export function maskInitials(first: string, last: string): string {
  const initial = (s: string) => (s.trim() ? `${s.trim()[0].toUpperCase()}.` : '?');
  return `${initial(first)} ${initial(last)}`;
}

/** What a school-wide resync would do, from the database alone (no Discord call). */
export interface TierSyncPreview {
  members: number;
  withDiscord: number;
  /** Connected members who would hold at least one tier role after the sync. */
  withTierRoles: number;
  /**
   * True when the sync would hold NO tier role for any connected member, so it would strip the tier
   * roles from everyone in scope. This is what an empty new season (not yet rostered) looks like.
   */
  stripAll: boolean;
}
