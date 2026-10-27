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
  | 'not_attempted_after_rate_limit';

/** Staff-facing wording per reason. Contains no member data. */
export const TIER_SYNC_FAILURE_LABELS: Record<string, string> = {
  bot_misconfigured: 'The bot lacks Manage Roles, or its role is below the tier roles.',
  role_not_found: 'A tier role id in DISCORD_TIER_ROLES does not exist in the server.',
  rate_limited: 'Discord rate limit; try again in a minute.',
  outage: 'Discord did not respond.',
  unexpected_error: 'Unexpected error; see the server log.',
  not_attempted_after_rate_limit: 'Not attempted because Discord rate limited the run.',
};

export interface TierSyncFailure {
  /** Masked member id; never a name, email or Discord id. */
  member: string;
  reason: string;
}

export interface TierSyncReport {
  /** `disabled` means nothing was attempted; `disabledReason` says why. */
  status: 'ok' | 'disabled';
  disabledReason?: 'config_unset' | 'config_invalid' | 'discord_unconfigured';
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

export function maskMemberId(id: string): string {
  return `${id.slice(0, 8)}...`;
}
