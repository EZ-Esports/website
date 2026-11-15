/**
 * Validation and normalization of HenrikDev's `GET /valorant/v4/match/{affinity}/{match_id}`
 * response. Henrik is an unofficial service whose match schema has changed across v2/v3/v4, so
 * the payload is parsed with a schema that requires only the fields we use and ignores the rest
 * (rounds, kills, economy, locations ...). Anything we need that is missing or mistyped fails
 * here as `invalid_response` instead of surfacing as a bad number deep in the app.
 */
import { z } from 'zod';
import type { NormalizedGame, NormalizedPlayer, TeamSide } from './types';

const count = z.number().int().min(0);

const playerSchema = z.object({
  puuid: z.string().min(1),
  name: z.string(),
  tag: z.string(),
  team_id: z.string(),
  agent: z.object({ name: z.string() }),
  tier: z.object({ name: z.string() }).nullish(),
  stats: z.object({
    score: z.number().int(),
    kills: count,
    deaths: count,
    assists: count,
    headshots: count,
    bodyshots: count,
    legshots: count,
    damage: z.object({ dealt: z.number().int(), received: z.number().int() }),
  }),
});

const teamSchema = z.object({
  team_id: z.string(),
  won: z.boolean(),
  rounds: z.object({ won: count, lost: count }),
});

export const henrikMatchResponseSchema = z.object({
  data: z.object({
    metadata: z.object({
      match_id: z.string().min(1),
      map: z.object({ id: z.string().nullish(), name: z.string() }),
      game_version: z.string().nullish(),
      game_length_in_ms: count,
      started_at: z.string(),
      is_completed: z.boolean(),
      queue: z.object({ id: z.string(), name: z.string().nullish() }),
    }),
    players: z.array(playerSchema).min(1),
    teams: z.array(teamSchema).min(1),
  }),
});

/**
 * Henrik reports a custom game with an empty queue id and the name "Custom Game", so the id alone
 * cannot be trusted to say `custom`.
 */
function queueIdOf(queue: { id: string; name?: string | null }): string {
  const id = queue.id.trim().toLowerCase();
  if (id) return id;
  return queue.name?.trim().toLowerCase() === 'custom game' ? 'custom' : id;
}

export type HenrikMatchResponse = z.infer<typeof henrikMatchResponseSchema>;

function toSide(teamId: string): TeamSide | null {
  const lower = teamId.toLowerCase();
  if (lower === 'red') return 'Red';
  if (lower === 'blue') return 'Blue';
  return null;
}

/** Highest score, then most kills; null when two players tie on both (no MVP is invented). */
function pickTop(players: NormalizedPlayer[]): NormalizedPlayer | null {
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) => b.score - a.score || b.kills - a.kills);
  const [first, second] = sorted;
  if (second && second.score === first.score && second.kills === first.kills) return null;
  return first;
}

/**
 * Parses a raw Henrik response body. Throws a `ZodError` or an `Error` with a safe message when
 * the shape is unusable (unknown team ids, no Red/Blue split); callers map that to
 * `invalid_response`.
 */
export function normalizeHenrikMatch(body: unknown): NormalizedGame {
  const { data } = henrikMatchResponseSchema.parse(body);

  const roundsBySide: Record<TeamSide, number> = { Red: 0, Blue: 0 };
  let winningSide: TeamSide | null = null;
  for (const team of data.teams) {
    const side = toSide(team.team_id);
    if (!side) throw new Error('Unknown team id in match.');
    roundsBySide[side] = team.rounds.won;
    if (team.won) winningSide = side;
  }
  // A team can be declared the winner with fewer (or equal) rounds when the other side
  // surrendered or forfeited. That is a real, finished game, not a malformed payload, so it is
  // flagged here and refused with a clear message at scoring time.
  const endedEarly =
    winningSide !== null && roundsBySide[winningSide] <= roundsBySide[winningSide === 'Red' ? 'Blue' : 'Red'];

  const startedAt = new Date(data.metadata.started_at);
  if (Number.isNaN(startedAt.getTime())) throw new Error('Invalid start time.');

  const players: NormalizedPlayer[] = data.players.map((p) => {
    const side = toSide(p.team_id);
    if (!side) throw new Error('Unknown team id on player.');
    return {
      puuid: p.puuid,
      name: p.name,
      tag: p.tag,
      side,
      agent: p.agent.name,
      tier: p.tier?.name ?? null,
      score: p.stats.score,
      kills: p.stats.kills,
      deaths: p.stats.deaths,
      assists: p.stats.assists,
      headshots: p.stats.headshots,
      bodyshots: p.stats.bodyshots,
      legshots: p.stats.legshots,
      damageDealt: p.stats.damage.dealt,
      damageReceived: p.stats.damage.received,
      isMatchMvp: false,
      isTeamMvp: false,
    };
  });

  // MVPs are derived (the documented response has no MVP field); see NormalizedPlayer.
  if (winningSide) {
    const matchMvp = pickTop(players.filter((p) => p.side === winningSide));
    if (matchMvp) matchMvp.isMatchMvp = true;
    const teamMvp = pickTop(players.filter((p) => p.side !== winningSide));
    if (teamMvp) teamMvp.isTeamMvp = true;
  }

  return {
    matchId: data.metadata.match_id.toLowerCase(),
    mapId: data.metadata.map.id ?? data.metadata.map.name,
    mapName: data.metadata.map.name,
    startedAt,
    gameLengthMs: data.metadata.game_length_in_ms,
    queueId: queueIdOf(data.metadata.queue),
    isCompleted: data.metadata.is_completed,
    gameVersion: data.metadata.game_version ?? null,
    redRounds: roundsBySide.Red,
    blueRounds: roundsBySide.Blue,
    winningSide,
    endedEarly,
    players,
  };
}
