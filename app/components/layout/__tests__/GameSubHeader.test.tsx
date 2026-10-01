import { describe, it, expect } from 'vitest';
import { getGameSubRoute, GAMES } from '@/app/lib/constants';

function isTeamsRouteActive(pathname: string, gameSlug: keyof typeof GAMES): boolean {
  const teamsRoute = getGameSubRoute(gameSlug, 'teams');
  return pathname === teamsRoute || pathname.startsWith(`${teamsRoute}/`);
}

function getSafeModalClassName(className?: string): string | undefined {
  return className?.replace(/\bcontents\b/g, '').trim() || undefined;
}

describe('GameSubHeader Active State Logic', () => {
  it('marks teams route active for exact match /[game]/teams', () => {
    expect(isTeamsRouteActive('/valorant/teams', 'valorant')).toBe(true);
  });

  it('marks teams route active for nested team routes /[game]/teams/[school]', () => {
    expect(isTeamsRouteActive('/valorant/teams/columbia', 'valorant')).toBe(true);
    expect(isTeamsRouteActive('/league-of-legends/teams/nyu', 'league-of-legends')).toBe(true);
  });

  it('returns false for unrelated game subroutes', () => {
    expect(isTeamsRouteActive('/valorant/schedule', 'valorant')).toBe(false);
    expect(isTeamsRouteActive('/valorant/standings', 'valorant')).toBe(false);
    expect(isTeamsRouteActive('/tetris/bracket', 'tetris')).toBe(false);
  });

  it('generates valid competition subroutes for team and tournament models', () => {
    expect(getGameSubRoute('valorant', 'schedule')).toBe('/valorant/schedule');
    expect(getGameSubRoute('tetris', 'bracket')).toBe('/tetris/bracket');
    expect(getGameSubRoute('team-fight-tactics', 'bracket')).toBe('/team-fight-tactics/bracket');
    expect(GAMES.tetris.competitionModel).toBe('tournament');
    expect(GAMES.valorant.competitionModel).toBe('team');
  });
});

describe('Overlay Modal Primitives', () => {
  it('strips display: contents from className to preserve modal container layout', () => {
    expect(getSafeModalClassName('contents w-full max-w-md')).toBe('w-full max-w-md');
    expect(getSafeModalClassName('w-full contents max-w-md')).toBe('w-full  max-w-md');
  });

  it('preserves valid classNames without contents', () => {
    expect(getSafeModalClassName('w-full max-w-md')).toBe('w-full max-w-md');
  });
});
