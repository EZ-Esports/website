import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GAMES,
  GAME_SLUGS,
  canonicalGameSlug,
  dbGameSlug,
  getGamesForShowcase,
  getGameRoute,
} from '@/app/lib/constants';

describe('TETR.IO forward-facing configuration and slug aliasing', () => {
  it('canonicalGameSlug maps DB and URL aliases to the canonical route slug', () => {
    expect(canonicalGameSlug('tetr-io')).toBe('tetris');
    expect(canonicalGameSlug('tetrio')).toBe('tetris');
    expect(canonicalGameSlug('tetris')).toBe('tetris');
    expect(canonicalGameSlug('valorant')).toBe('valorant');
    expect(canonicalGameSlug('league-of-legends')).toBe('league-of-legends');
    expect(canonicalGameSlug('team-fight-tactics')).toBe('team-fight-tactics');
  });

  it('dbGameSlug maps canonical route slug to the database slug', () => {
    expect(dbGameSlug('tetris')).toBe('tetr-io');
    expect(dbGameSlug('valorant')).toBe('valorant');
    expect(dbGameSlug('league-of-legends')).toBe('league-of-legends');
  });

  it('GAMES["tetris"] has correct configuration and dedicated banner asset', () => {
    const config = GAMES['tetris'];
    expect(config.slug).toBe('tetris');
    expect(config.displayName).toBe('TETR.IO');
    expect(config.shortName).toBe('TETR.IO');
    expect(config.hasJvSplit).toBe(false);
    expect(config.imageUrl).toBe('/images/games/tetrio-banner.png');

    const assetPath = resolve(process.cwd(), 'public/images/games/tetrio-banner.png');
    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(assetPath).size).toBeGreaterThan(1000);
  });

  it('getGamesForShowcase includes TETR.IO alongside active games', () => {
    const showcaseGames = getGamesForShowcase();
    expect(showcaseGames.length).toBe(4);

    const tetrisGame = showcaseGames.find((g) => g.id === 'tetris');
    expect(tetrisGame).toBeDefined();
    expect(tetrisGame?.title).toBe('TETR.IO');
    expect(tetrisGame?.imageUrl).toBe('/images/games/tetrio-banner.png');

    // Route resolves to /tetris
    expect(getGameRoute('tetris')).toBe('/tetris');
  });

  it('GAME_SLUGS includes tetris', () => {
    expect(GAME_SLUGS).toContain('tetris');
  });
});
