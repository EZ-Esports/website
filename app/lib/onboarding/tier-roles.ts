import { isDiscordSnowflake } from './adapters/discord-rest';

/**
 * Pure rules for Discord tier roles ("Valorant Varsity", "Valorant JV", ...): the configuration
 * that maps a game and tier to a Discord role id, and the reconciler that turns a member's roster
 * memberships into the set of role ids they should hold. No I/O lives here, so every rule is
 * unit-testable and shared by the live hook, the staff action and the backfill script.
 */

export const TIERS = ['varsity', 'jv'] as const;
export type Tier = (typeof TIERS)[number];

/** Normalised config: game slug -> tier -> Discord role id. A tier left out grants nothing. */
export type TierRoleMap = Record<string, Partial<Record<Tier, string>>>;

export type TierRoleConfig =
  | { status: 'disabled'; reason: 'unset' }
  | { status: 'invalid'; errors: string[] }
  | {
      status: 'enabled';
      roles: TierRoleMap;
      /**
       * Exactly the role ids named in the config. The sync may add or remove only these, so a
       * role staff assign by hand (Captain, Coach, a school role) is never touched.
       */
      managed: string[];
    };

const GAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Parses `DISCORD_TIER_ROLES`. Unset, blank or `{}` disables the sync. Anything malformed also
 * disables it, with every problem listed, because a half-understood mapping could grant or strip
 * the wrong role. Never throws.
 */
export function parseTierRoles(raw: string | undefined | null): TierRoleConfig {
  if (raw === undefined || raw === null || raw.trim() === '') return { status: 'disabled', reason: 'unset' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', errors: ['DISCORD_TIER_ROLES is not valid JSON.'] };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'invalid', errors: ['DISCORD_TIER_ROLES must be a JSON object keyed by game slug.'] };
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return { status: 'disabled', reason: 'unset' };

  const errors: string[] = [];
  const roles: TierRoleMap = {};
  const seen = new Map<string, string>();

  for (const [slug, value] of entries) {
    if (!GAME_SLUG.test(slug)) {
      errors.push(`"${slug}" is not a valid game slug (lowercase letters, digits and hyphens).`);
      continue;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`"${slug}" must be an object like {"varsity":"<roleId>","jv":"<roleId>"}.`);
      continue;
    }
    const tiers = Object.entries(value as Record<string, unknown>);
    if (tiers.length === 0) {
      errors.push(`"${slug}" has no tiers.`);
      continue;
    }
    const mapped: Partial<Record<Tier, string>> = {};
    for (const [tier, id] of tiers) {
      if (!(TIERS as readonly string[]).includes(tier)) {
        errors.push(`"${slug}" has unknown tier "${tier}" (allowed: ${TIERS.join(', ')}).`);
        continue;
      }
      if (!isDiscordSnowflake(id)) {
        errors.push(`"${slug}.${tier}" is not a valid Discord role id (a 17-20 digit number in quotes).`);
        continue;
      }
      const prior = seen.get(id);
      if (prior) {
        errors.push(`Role id for "${slug}.${tier}" is already used by "${prior}"; each tier needs its own role.`);
        continue;
      }
      seen.set(id, `${slug}.${tier}`);
      mapped[tier as Tier] = id;
    }
    roles[slug] = mapped;
  }

  if (errors.length > 0) return { status: 'invalid', errors };
  return { status: 'enabled', roles, managed: [...seen.keys()] };
}

let lastLogged: string | undefined;

/** Reads the config from the environment and logs a disabled/invalid state once per distinct value. */
export function getTierRoleConfig(env: NodeJS.ProcessEnv = process.env): TierRoleConfig {
  const raw = env.DISCORD_TIER_ROLES;
  const config = parseTierRoles(raw);
  const key = `${config.status}:${raw ?? ''}`;
  if (config.status !== 'enabled' && lastLogged !== key) {
    lastLogged = key;
    if (config.status === 'invalid') {
      console.error(`Discord tier role sync is DISABLED: invalid DISCORD_TIER_ROLES. ${config.errors.join(' ')}`);
    } else {
      console.info('Discord tier role sync is disabled: DISCORD_TIER_ROLES is not set.');
    }
  }
  return config;
}

/** Test hook: forget what was already logged. */
export function resetTierRoleConfigLog(): void {
  lastLogged = undefined;
}

/**
 * Maps a roster name to a tier. Case-insensitive and whitespace-tolerant; the rosters this site
 * creates are named "Varsity" and "JV" (the public pages also spell JV out as "Junior Varsity").
 * Any other name, such as "Academy" or "Varsity 2", grants nothing: a guess here would hand out
 * a competitive-tier role to the wrong people.
 */
export function tierOfRosterName(name: string): Tier | null {
  const n = name.trim().replace(/\s+/g, ' ').toLowerCase();
  if (n === 'varsity') return 'varsity';
  if (n === 'jv' || n === 'junior varsity') return 'jv';
  return null;
}

export interface RosterMembershipFact {
  gameSlug: string;
  rosterName: string;
  /** `seasons.is_active` of the roster's season. */
  seasonIsActive: boolean;
  /** `players.role`. */
  playerRole: string;
}

/**
 * Player roles that earn a tier role. Coaches are staff of a team, not students on the roster, so
 * they are excluded; captains and subs are students and count.
 */
export const TIER_ELIGIBLE_ROLES: readonly string[] = ['player', 'sub', 'captain'];

/**
 * The role ids a member should hold, derived only from their memberships in each game's ACTIVE
 * season. Different games are independent. The app allows one tier per game, but the reconciler
 * does not rely on it: if data ever holds both, the member simply gets both roles.
 */
export function desiredRoleIds(memberships: RosterMembershipFact[], config: TierRoleMap): string[] {
  const desired = new Set<string>();
  for (const m of memberships) {
    if (!m.seasonIsActive) continue;
    if (!TIER_ELIGIBLE_ROLES.includes(m.playerRole)) continue;
    const tier = tierOfRosterName(m.rosterName);
    if (!tier) continue;
    const id = config[m.gameSlug]?.[tier];
    if (id) desired.add(id);
  }
  return [...desired];
}

/** Human labels for managed ids ("valorant/varsity"), for masked logs and reports. */
export function roleLabels(config: TierRoleMap): Map<string, string> {
  const labels = new Map<string, string>();
  for (const [slug, tiers] of Object.entries(config)) {
    for (const tier of TIERS) {
      const id = tiers[tier];
      if (id) labels.set(id, `${slug}/${tier}`);
    }
  }
  return labels;
}
