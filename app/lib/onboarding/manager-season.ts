/**
 * The pure rule that decides which season of a game a school manager works in (spec-026). It lives
 * apart from `manager-auth.ts` (which is server-only and talks to Supabase) so the onboarding
 * pipeline and the portal resolve a manager's season with the very same function.
 */

/** One `school_managers` row's grant at a school: a season (`YYYY-YY`) and the games it covers. */
export interface ManagerAffiliation {
  academicYear: string;
  /** Game slugs/ids this row covers; null or empty means every game. */
  managedGames: string[] | null;
}

export function affiliationCoversGame(
  affiliation: ManagerAffiliation,
  game: { id: string; slug: string }
): boolean {
  const games = affiliation.managedGames;
  if (!games || games.length === 0) return true;
  return games.includes(game.slug) || games.includes(game.id);
}

/**
 * Pure season-resolution rule for the manager portal (spec-026). A manager's season for a game is
 * the game's season whose `name` equals the `academic_year` (`YYYY-YY`) of one of their rows that
 * covers the game. `seasons.is_active` plays no part. When several rows match several seasons,
 * the newest by name wins (`YYYY-YY` sorts lexicographically). Returns null when no season of the
 * game has a matching name. Change the multi-match policy here and nowhere else.
 */
export function resolveManagerSeason<S extends { name: string }>(
  affiliations: ManagerAffiliation[],
  game: { id: string; slug: string },
  gameSeasons: S[]
): S | null {
  const names = new Set(
    affiliations.filter((a) => affiliationCoversGame(a, game)).map((a) => a.academicYear)
  );
  let best: S | null = null;
  for (const season of gameSeasons) {
    if (!names.has(season.name)) continue;
    if (!best || season.name > best.name) best = season;
  }
  return best;
}
