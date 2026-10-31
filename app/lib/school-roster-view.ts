/**
 * Pure shaping for the staff "View rosters" page under Schools: flat team /
 * roster / player rows in, season blocks out. Free of DB and Next imports so
 * ordering, division placement and the missing-team placeholders are unit
 * testable; `app/lib/db/school-rosters.ts` does the SQL and delegates here.
 */
import { GAMES, canonicalGameSlug } from '@/app/lib/constants';
import type { ContentFlagView } from '@/app/lib/db/content-flags';
import { toHubDivision, type CanonicalDivision, type HubDivision } from '@/app/lib/db/match-page';

export interface RosterViewPlayer {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  /** Member's display name. Only the fields the admin roster views already show. */
  name: string;
  ign: string | null;
  discord: string | null;
  graduationYear: number | null;
  role: 'captain' | 'player' | 'coach' | 'sub';
  /** Every onboarding offensive-content override for this person (a player and a manager record can both exist), newest first; absent when none or when its table is not migrated yet. */
  contentFlags?: ContentFlagView[];
}

export interface RosterViewRoster {
  id: string;
  name: string;
  /** Raw stored division ('A' | 'B' | 'Varsity' | 'JV' | 'All'). */
  division: string;
  players: RosterViewPlayer[];
}

export interface SchoolRosterTeamInput {
  teamId: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  seasonId: string;
  seasonName: string;
  seasonIsActive: boolean;
  rostersLockedAt: Date | string | null;
  rosters: RosterViewRoster[];
}

export type SeasonLayout =
  /** Team-model game: Varsity left, JV right, for every game (a game without a JV split gets a placeholder JV side). */
  | 'divided'
  /** Tournament-model game: its rosters listed as the old Teams & Rosters page did, no division columns. */
  | 'tournament';

export interface DivisionColumn {
  division: HubDivision;
  rosters: RosterViewRoster[];
  /** True when the school fielded nothing in this division this season; the UI shows a placeholder. */
  missing: boolean;
  /** False for the JV side of a game that has no JV division: the placeholder says so and no roster can be added. */
  supported: boolean;
}

export interface SeasonBlock {
  key: string;
  teamId: string;
  /** Whether the game has a JV division at all (false for tournament games and e.g. Minecraft). */
  jvSupported: boolean;
  gameId: string;
  gameName: string;
  gameSlug: string;
  seasonId: string;
  seasonName: string;
  isActive: boolean;
  rostersLocked: boolean;
  rostersLockedAt: string | null;
  layout: SeasonLayout;
  /** Varsity then JV for `divided`; empty for `tournament`. */
  columns: DivisionColumn[];
  /** Every roster, used by the tournament layout. */
  rosters: RosterViewRoster[];
}

/** Players with an onboarding content-flag override that staff have not marked reviewed, counted once per player. */
export function countUnreviewedContentFlags(blocks: SeasonBlock[]): number {
  const seen = new Set<string>();
  for (const block of blocks) {
    for (const roster of block.rosters) {
      for (const p of roster.players) {
        if (p.contentFlags?.some((f) => !f.reviewedAt)) seen.add(p.memberId);
      }
    }
  }
  return seen.size;
}

/** First calendar year of a `YYYY-YY` season name; null for anything else. */
export function seasonStartYear(name: string): number | null {
  const m = /^(\d{4})/.exec(name.trim());
  return m ? Number(m[1]) : null;
}

/** Most recent season first; unparseable names sink; game name breaks ties so the order is stable. */
export function compareSeasonBlocksNewestFirst(
  a: Pick<SeasonBlock, 'seasonName' | 'gameName'>,
  b: Pick<SeasonBlock, 'seasonName' | 'gameName'>,
): number {
  const ya = seasonStartYear(a.seasonName);
  const yb = seasonStartYear(b.seasonName);
  if (ya !== yb) {
    if (ya === null) return 1;
    if (yb === null) return -1;
    return yb - ya;
  }
  const byName = b.seasonName.localeCompare(a.seasonName);
  return byName !== 0 ? byName : a.gameName.localeCompare(b.gameName);
}

function gameConfig(gameSlug: string) {
  return (GAMES as Record<string, (typeof GAMES)[keyof typeof GAMES] | undefined>)[canonicalGameSlug(gameSlug)];
}

export function gameLayout(gameSlug: string): SeasonLayout {
  return gameConfig(gameSlug)?.competitionModel === 'tournament' ? 'tournament' : 'divided';
}

/**
 * Whether a game fields a JV division. A game the constants do not know
 * trusts the data: any JV roster means the split exists.
 */
export function gameHasJv(gameSlug: string, rosters: Pick<RosterViewRoster, 'division'>[] = []): boolean {
  const config = gameConfig(gameSlug);
  if (config) return config.competitionModel !== 'tournament' && config.hasJvSplit;
  return rosters.some((r) => toHubDivision(r.division) === 'JV');
}

/** Canonical divisions a roster of this game may be given. Tournament games run one undivided field. */
export function allowedRosterDivisions(gameSlug: string): CanonicalDivision[] {
  if (gameLayout(gameSlug) === 'tournament') return ['All'];
  return gameHasJv(gameSlug, [{ division: 'JV' }]) ? ['Varsity', 'JV'] : ['Varsity'];
}

/** Value stored in `rosters.division` for a canonical choice (A/B as the admin has always written). */
export function storedDivision(division: CanonicalDivision): string {
  return division === 'Varsity' ? 'A' : division === 'JV' ? 'B' : 'All';
}

export function buildSeasonBlocks(teams: SchoolRosterTeamInput[]): SeasonBlock[] {
  const blocks = teams.map<SeasonBlock>((t) => {
    const layout = gameLayout(t.gameSlug);
    const jvSupported = gameHasJv(t.gameSlug, t.rosters);
    const rosters = [...t.rosters]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        ...r,
        players: [...r.players].sort(
          (a, b) =>
            Number(b.role === 'captain') - Number(a.role === 'captain') || a.name.localeCompare(b.name),
        ),
      }));

    let columns: DivisionColumn[] = [];
    if (layout === 'divided') {
      // Every team-model game gets the same two columns. A roster stored as JV/B always lands
      // in JV, even for a game with no JV split, so it is never silently folded into Varsity.
      columns = (['Varsity', 'JV'] as const).map((division) => {
        const inDivision = rosters.filter((r) => toHubDivision(r.division) === division);
        return {
          division,
          rosters: inDivision,
          missing: inDivision.length === 0,
          supported: division === 'Varsity' || jvSupported || inDivision.length > 0,
        };
      });
    }

    const lockedAt = t.rostersLockedAt ? new Date(t.rostersLockedAt).toISOString() : null;
    return {
      key: t.teamId,
      teamId: t.teamId,
      jvSupported,
      gameId: t.gameId,
      gameName: t.gameName,
      gameSlug: t.gameSlug,
      seasonId: t.seasonId,
      seasonName: t.seasonName,
      isActive: t.seasonIsActive,
      rostersLocked: lockedAt !== null,
      rostersLockedAt: lockedAt,
      layout,
      columns,
      rosters,
    };
  });
  return blocks.sort(compareSeasonBlocksNewestFirst);
}

/** Keys of the blocks open on first render: every active season, or the newest block when none is active. */
export function defaultExpandedKeys(blocks: SeasonBlock[]): string[] {
  const active = blocks.filter((b) => b.isActive).map((b) => b.key);
  if (active.length > 0) return active;
  return blocks.length > 0 ? [blocks[0].key] : [];
}

export type DivisionFilter = 'both' | 'Varsity' | 'JV';
export type PhoneDivision = 'Varsity' | 'JV';

/** Blocks for one game (null = all games). */
export function filterBlocksByGame(blocks: SeasonBlock[], gameId: string | null): SeasonBlock[] {
  return gameId ? blocks.filter((b) => b.gameId === gameId) : blocks;
}

/** Distinct games present in the blocks, alphabetical, for the game filter. */
export function buildGameOptions(blocks: SeasonBlock[]): { id: string; slug: string; name: string }[] {
  const seen = new Map<string, { slug: string; name: string }>();
  for (const b of blocks) seen.set(b.gameId, { slug: b.gameSlug, name: b.gameName });
  return [...seen]
    .map(([id, g]) => ({ id, slug: g.slug, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* URL-persisted filters: ?game=<slug>&division=varsity|jv&phone=jv. Defaults are never written. */

export interface RosterViewFilters {
  /** Game slug, or '' for all games. */
  game: string;
  division: DivisionFilter;
  phone: PhoneDivision;
}

export const DEFAULT_ROSTER_FILTERS: RosterViewFilters = { game: '', division: 'both', phone: 'Varsity' };

type RawParam = string | string[] | null | undefined;
const first = (v: RawParam) => (Array.isArray(v) ? v[0] : v) ?? undefined;

/** Reads and validates the filter params; unknown values fall back to the default. `gameSlugs` are the games this school has. */
export function parseRosterFilters(
  raw: { game?: RawParam; division?: RawParam; phone?: RawParam },
  gameSlugs: string[],
): RosterViewFilters {
  const game = first(raw.game);
  const division = first(raw.division)?.toLowerCase();
  const phone = first(raw.phone)?.toLowerCase();
  return {
    game: game && gameSlugs.includes(game) ? game : '',
    division: division === 'varsity' ? 'Varsity' : division === 'jv' ? 'JV' : 'both',
    phone: phone === 'jv' ? 'JV' : 'Varsity',
  };
}

/** Query string (no leading '?') for the filters; empty when everything is default. */
export function rosterFilterQuery(f: RosterViewFilters): string {
  const sp = new URLSearchParams();
  if (f.game) sp.set('game', f.game);
  if (f.division !== 'both') sp.set('division', f.division.toLowerCase());
  if (f.division === 'both' && f.phone !== 'Varsity') sp.set('phone', f.phone.toLowerCase());
  return sp.toString();
}

/**
 * Applies the filters to an existing query string (with or without a leading '?') and returns the
 * new one (no '?'). Only `game`, `division` and `phone` are set or removed; every other param is kept.
 */
export function mergeRosterFilterQuery(currentSearch: string, f: RosterViewFilters): string {
  const sp = new URLSearchParams(currentSearch);
  for (const key of ['game', 'division', 'phone']) sp.delete(key);
  const own = new URLSearchParams(rosterFilterQuery(f));
  own.forEach((value, key) => sp.set(key, value));
  return sp.toString();
}

/** What the staff editing controls need beyond the rosters themselves. Display fields only. */
export interface RosterEditOptions {
  /** The school's members, for the add-player picker. */
  members: { id: string; firstName: string; lastName: string; discord: string | null; graduationYear: number | null }[];
  games: { id: string; slug: string; name: string }[];
  seasons: { id: string; gameId: string; name: string; isActive: boolean }[];
}
