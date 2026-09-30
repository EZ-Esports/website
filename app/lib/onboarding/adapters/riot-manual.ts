import type { GameIdentityPort, ResolvedGameIdentity } from '../ports';

/**
 * Riot ID regex per specification:
 * - 3 to 16 characters for game name
 * - '#' separator
 * - 3 to 5 alphanumeric characters for tagline
 */
export const RIOT_ID_REGEX = /^.{3,16}#[a-zA-Z0-9]{3,5}$/;

/**
 * Derives the public tracker.gg profile URL for the given game slug and raw Riot identifier.
 */
export function deriveTrackerUrl(gameSlug: string, rawIdentifier: string): string {
  const cleanSlug = gameSlug.toLowerCase().trim();
  const trackerGame = cleanSlug === 'league-of-legends' || cleanSlug === 'lol' ? 'lol' : 'valorant';
  const encodedIdentifier = encodeURIComponent(rawIdentifier);
  return `https://tracker.gg/${trackerGame}/profile/riot/${encodedIdentifier}/overview`;
}

export interface ManualRiotIdAdapterOptions {
  isVerified?: boolean;
}

/**
 * V1 Manual Riot ID Adapter.
 * Validates player-submitted Riot IDs against Riot naming conventions, extracts display names,
 * and auto-derives public tracker.gg profile links for competition operations.
 */
export class ManualRiotIdAdapter implements GameIdentityPort {
  private readonly defaultVerified: boolean;

  constructor(options?: ManualRiotIdAdapterOptions | boolean) {
    if (typeof options === 'boolean') {
      this.defaultVerified = options;
    } else {
      this.defaultVerified = options?.isVerified ?? false;
    }
  }

  async resolveIdentity(gameSlug: string, identifier: string): Promise<ResolvedGameIdentity> {
    const trimmed = (identifier || '').trim();

    if (!trimmed || !RIOT_ID_REGEX.test(trimmed)) {
      throw new Error(
        `Invalid Riot ID format: "${identifier}". Expected Name#Tag (e.g., Player#NA1), where name is 3-16 characters and tag is 3-5 alphanumeric characters.`
      );
    }

    const hashIndex = trimmed.indexOf('#');
    const displayName = trimmed.slice(0, hashIndex);
    const trackerUrl = deriveTrackerUrl(gameSlug, trimmed);

    return {
      gameId: trimmed,
      displayName,
      rawIdentifier: trimmed,
      isVerified: this.defaultVerified,
      trackerUrl,
    };
  }
}
