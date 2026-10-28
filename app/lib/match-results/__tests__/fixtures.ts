/**
 * Builders for HenrikDev v4 match payloads and rosters. The shape follows the documented
 * `MatchesV4Response`, including fields the app ignores (rounds, kills, economy), so the tests
 * prove unknown fields are tolerated. Nothing here touches the network.
 */

export interface FixturePlayer {
  name: string;
  tag: string;
  team: 'Red' | 'Blue';
  score?: number;
  kills?: number;
}

export const RED_PLAYERS = ['RedOne', 'RedTwo', 'RedThree', 'RedFour', 'RedFive'];
export const BLUE_PLAYERS = ['BlueOne', 'BlueTwo', 'BlueThree', 'BlueFour', 'BlueFive'];

export function playersFor(names: string[], team: 'Red' | 'Blue', tag = 'NA1'): FixturePlayer[] {
  return names.map((name, i) => ({ name, tag, team, score: 4000 - i * 400, kills: 20 - i * 3 }));
}

export function henrikPayload(options: {
  matchId: string;
  winner?: 'Red' | 'Blue' | null;
  redRounds?: number;
  blueRounds?: number;
  queue?: string;
  completed?: boolean;
  startedAt?: string;
  players?: FixturePlayer[];
}): unknown {
  const winner = options.winner === undefined ? 'Red' : options.winner;
  const redRounds = options.redRounds ?? (winner === 'Red' ? 13 : 9);
  const blueRounds = options.blueRounds ?? (winner === 'Blue' ? 13 : 9);
  const players = options.players ?? [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')];
  return {
    status: 200,
    data: {
      metadata: {
        match_id: options.matchId,
        map: { id: '/Game/Maps/Ascent', name: 'Ascent' },
        game_version: 'release-10.00',
        game_length_in_ms: 2000000,
        started_at: options.startedAt ?? '2026-10-20T23:00:00.000Z',
        is_completed: options.completed ?? true,
        queue: { id: options.queue ?? 'custom', mode_type: 'Standard', name: 'Custom Game' },
        season: { id: 'abc', short: 'e10a1' },
        platform: 'PC',
        party_rr_penaltys: [],
        cluster: null,
        region: 'na',
      },
      players: players.map((p, i) => ({
        puuid: `puuid-${p.name}`,
        name: p.name,
        tag: p.tag,
        team_id: p.team,
        platform: 'PC',
        party_id: 'party',
        agent: { id: `agent-${i}`, name: ['Jett', 'Sage', 'Omen', 'Sova', 'Reyna'][i % 5] },
        stats: {
          score: p.score ?? 3000,
          kills: p.kills ?? 15,
          deaths: 12,
          assists: 4,
          headshots: 20,
          bodyshots: 60,
          legshots: 20,
          damage: { dealt: 2800, received: 2500 },
        },
        ability_casts: { ability1: 1, ability2: 2, grenade: 3, ultimate: 0 },
        tier: { id: 14, name: 'Gold 2' },
        customization: { card: 'c', title: 't', preferred_level_border: null },
        account_level: 50,
        session_playtime_in_ms: 1,
        behavior: { afk_rounds: 0, rounds_in_spawn: 0, friendly_fire: { incoming: 0, outgoing: 0 } },
        economy: { spent: { overall: 1, average: 1 }, loadout_value: { overall: 1, average: 1 } },
      })),
      teams: [
        { team_id: 'Red', won: winner === 'Red', rounds: { won: redRounds, lost: blueRounds }, premier_roster: null },
        { team_id: 'Blue', won: winner === 'Blue', rounds: { won: blueRounds, lost: redRounds }, premier_roster: null },
      ],
      rounds: [{ id: 0, result: 'Elimination', ceremony: 'CeremonyDefault', winning_team: 'Red', plant: null, defuse: null, stats: [] }],
      kills: [],
      coaches: [],
      observers: [],
    },
  };
}

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
