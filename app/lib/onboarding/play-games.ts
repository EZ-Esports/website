const MAX_PLAY_GAMES = 20;

/**
 * Bounded list of unique id strings from untrusted input (a draft or a submission). The submit step
 * re-validates every id against the games table, so this only keeps the shape sane.
 */
export function sanitizeGameIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64);
  return [...new Set(ids)].slice(0, MAX_PLAY_GAMES);
}

/**
 * Restricts the games a manager can say they play to the games staff let them manage. `managedGames`
 * is the staff-seeded list of game slugs on the manager invite; null or empty means every game, the
 * same rule `getAuthorizedGameScopes` uses, so a manager can never pick a game whose application
 * they could not then see or approve in the portal.
 */
export function filterGamesByManaged<T extends { slug: string }>(games: T[], managedGames: unknown): T[] {
  if (!Array.isArray(managedGames) || managedGames.length === 0) return games;
  const allowed = new Set(managedGames.filter((g): g is string => typeof g === 'string'));
  return games.filter((g) => allowed.has(g.slug));
}
