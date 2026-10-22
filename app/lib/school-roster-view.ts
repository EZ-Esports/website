/**
 * Pure shaping for the staff "View rosters" page under Schools: flat team /
 * roster / player rows in, season blocks out. Free of DB and Next imports so
 * ordering, division placement and the missing-team placeholders are unit
 * testable; `app/lib/db/school-rosters.ts` does the SQL and delegates here.
 */
import { GAMES, canonicalGameSlug } from '@/app/lib/constants';
import { toHubDivision, type HubDivision } from '@/app/lib/db/match-page';

export interface RosterViewPlayer {
  id: string;
  /** Member's display name. Only the fields the admin roster views already show; never demographics. */
  name: string;
  ign: string | null;
  discord: string | null;
  graduationYear: number | null;
  role: 'captain' | 'player' | 'coach' | 'sub';
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
  /** Team-model game with a Varsity/JV split: two aligned columns. */
  | 'divided'
  /** Team-model game with no JV division at all (Minecraft): one full-width "Varsity" column. */
  | 'single'
  /** Tournament-model game: its rosters listed as the old Teams & Rosters page did, no division columns. */
  | 'tournament';

export interface DivisionColumn {
  division: HubDivision;
  rosters: RosterViewRoster[];
  /** True when the school fielded nothing in this division this season; the UI shows a placeholder. */
  missing: boolean;
}

export interface SeasonBlock {
  key: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  seasonId: string;
  seasonName: string;
  isActive: boolean;
  rostersLocked: boolean;
  rostersLockedAt: string | null;
  layout: SeasonLayout;
  /** Varsity then JV for `divided`; just Varsity for `single`; empty for `tournament`. */
  columns: DivisionColumn[];
  /** Every roster, used by the tournament layout. */
  rosters: RosterViewRoster[];
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

export function gameLayout(gameSlug: string, rosters: RosterViewRoster[]): SeasonLayout {
  const config = (GAMES as Record<string, (typeof GAMES)[keyof typeof GAMES] | undefined>)[
    canonicalGameSlug(gameSlug)
  ];
  if (config?.competitionModel === 'tournament') return 'tournament';
  if (config) return config.hasJvSplit ? 'divided' : 'single';
  // A game the constants do not know: trust the data. Any JV roster means the split exists.
  return rosters.some((r) => toHubDivision(r.division) === 'JV') ? 'divided' : 'single';
}

export function buildSeasonBlocks(teams: SchoolRosterTeamInput[]): SeasonBlock[] {
  const blocks = teams.map<SeasonBlock>((t) => {
    const layout = gameLayout(t.gameSlug, t.rosters);
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
      columns = (['Varsity', 'JV'] as const).map((division) => {
        const inDivision = rosters.filter((r) => toHubDivision(r.division) === division);
        return { division, rosters: inDivision, missing: inDivision.length === 0 };
      });
    } else if (layout === 'single') {
      // No JV exists for this game, so everything (including 'All') folds onto Varsity.
      columns = [{ division: 'Varsity', rosters, missing: rosters.length === 0 }];
    }

    const lockedAt = t.rostersLockedAt ? new Date(t.rostersLockedAt).toISOString() : null;
    return {
      key: t.teamId,
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

/** Blocks for one game (null = all games). */
export function filterBlocksByGame(blocks: SeasonBlock[], gameId: string | null): SeasonBlock[] {
  return gameId ? blocks.filter((b) => b.gameId === gameId) : blocks;
}

/** Distinct games present in the blocks, alphabetical, for the game filter. */
export function buildGameOptions(blocks: SeasonBlock[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const b of blocks) seen.set(b.gameId, b.gameName);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
