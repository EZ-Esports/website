import { describe, expect, it } from 'vitest';
import {
  countSeasonsByStatus,
  filterSeasonsByStatus,
  leagueStatusHref,
  matchFilterQuery,
  parseMatchFilterParams,
  parseSeasonStatus,
  seasonMatchesHref,
} from '@/app/lib/admin-season-filters';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';
const games = [
  { id: 'g-val', slug: 'valorant' },
  { id: 'g-lol', slug: 'league-of-legends' },
];
const seasons = [
  { id: S1, gameId: 'g-val', isActive: true },
  { id: S2, gameId: 'g-val', isActive: false },
  { id: S3, gameId: 'g-lol', isActive: false },
];

describe('season status tabs', () => {
  it('defaults to active and ignores unknown values', () => {
    expect(parseSeasonStatus(undefined)).toBe('active');
    expect(parseSeasonStatus('bogus')).toBe('active');
    expect(parseSeasonStatus('inactive')).toBe('inactive');
    expect(parseSeasonStatus('all')).toBe('all');
    expect(parseSeasonStatus(['all', 'inactive'])).toBe('all');
  });

  it('filters and counts', () => {
    expect(filterSeasonsByStatus(seasons, 'active').map((s) => s.id)).toEqual([S1]);
    expect(filterSeasonsByStatus(seasons, 'inactive').map((s) => s.id)).toEqual([S2, S3]);
    expect(filterSeasonsByStatus(seasons, 'all')).toHaveLength(3);
    expect(countSeasonsByStatus(seasons)).toEqual({ active: 1, inactive: 2, all: 3 });
    expect(countSeasonsByStatus([])).toEqual({ active: 0, inactive: 0, all: 0 });
  });

  it('builds tab hrefs', () => {
    expect(leagueStatusHref('active')).toBe('/admin/league');
    expect(leagueStatusHref('inactive')).toBe('/admin/league?status=inactive');
    expect(leagueStatusHref('all')).toBe('/admin/league?status=all');
  });
});

describe('seasonMatchesHref', () => {
  it('links to matches filtered by season and game', () => {
    expect(seasonMatchesHref(S1, 'valorant')).toBe(`/admin/matches?season=${S1}&game=valorant`);
  });
  it('omits the game when unknown', () => {
    expect(seasonMatchesHref(S1)).toBe(`/admin/matches?season=${S1}`);
  });
});

describe('parseMatchFilterParams', () => {
  it('resolves a deep link', () => {
    expect(parseMatchFilterParams({ season: S2, game: 'valorant' }, games, seasons)).toEqual({ gameId: 'g-val', seasonId: S2 });
  });
  it('a season alone selects its game', () => {
    expect(parseMatchFilterParams({ season: S3 }, games, seasons)).toEqual({ gameId: 'g-lol', seasonId: S3 });
  });
  it('a season wins over a conflicting game', () => {
    expect(parseMatchFilterParams({ season: S3, game: 'valorant' }, games, seasons)).toEqual({ gameId: 'g-lol', seasonId: S3 });
  });
  it('a game alone defaults to its active season', () => {
    expect(parseMatchFilterParams({ game: 'valorant' }, games, seasons)).toEqual({ gameId: 'g-val', seasonId: S1 });
  });
  it('a game with no active season keeps all seasons', () => {
    expect(parseMatchFilterParams({ game: 'league-of-legends' }, games, seasons)).toEqual({ gameId: 'g-lol', seasonId: '' });
  });
  it('season=all keeps all seasons for the game', () => {
    expect(parseMatchFilterParams({ game: 'valorant', season: 'all' }, games, seasons)).toEqual({ gameId: 'g-val', seasonId: '' });
  });
  it('no params selects nothing', () => {
    expect(parseMatchFilterParams({}, games, seasons)).toEqual({ gameId: '', seasonId: '' });
  });
  it('ignores unknown or malformed ids and slugs', () => {
    expect(parseMatchFilterParams({ season: 'nope', game: 'nope' }, games, seasons)).toEqual({ gameId: '', seasonId: '' });
    expect(parseMatchFilterParams({ season: '44444444-4444-4444-8444-444444444444' }, games, seasons)).toEqual({ gameId: '', seasonId: '' });
    expect(parseMatchFilterParams({ season: ["'; drop table"], game: ['VALORANT'] }, games, seasons)).toEqual({ gameId: 'g-val', seasonId: S1 });
  });
});

describe('matchFilterQuery', () => {
  it('writes season and game', () => {
    expect(matchFilterQuery('valorant', S1)).toBe(`season=${S1}&game=valorant`);
  });
  it('marks an explicit all-seasons choice for a game', () => {
    expect(matchFilterQuery('valorant', '')).toBe('season=all&game=valorant');
  });
  it('is empty with no filters, and round-trips', () => {
    expect(matchFilterQuery(undefined, '')).toBe('');
    const q = new URLSearchParams(matchFilterQuery('valorant', ''));
    expect(parseMatchFilterParams({ season: q.get('season')!, game: q.get('game')! }, games, seasons)).toEqual({ gameId: 'g-val', seasonId: '' });
  });
});
