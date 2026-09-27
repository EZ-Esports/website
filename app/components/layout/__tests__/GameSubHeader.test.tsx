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
    expect(isTeamsRouteActive('/ssbm/teams', 'ssbm')).toBe(true);
  });

  it('marks teams route active for nested team routes /[game]/teams/[school]', () => {
    expect(isTeamsRouteActive('/ssbm/teams/columbia', 'ssbm')).toBe(true);
    expect(isTeamsRouteActive('/valorant/teams/nyu', 'valorant')).toBe(true);
  });

  it('returns false for unrelated game subroutes', () => {
    expect(isTeamsRouteActive('/ssbm/schedule', 'ssbm')).toBe(false);
    expect(isTeamsRouteActive('/ssbm/standings', 'ssbm')).toBe(false);
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
