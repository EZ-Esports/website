import { describe, it, expect } from 'vitest';
import {
  defaultSortForTab,
  effectiveSort,
  isMatchTab,
  matchInTab,
  matchTabOf,
  needsResult,
  type MatchPageItemDto,
  type MatchStatus,
} from '../db/match-page';
import { applySavedMatch, groupMatchesByDay, parseScoreInput } from '../admin-match-list';
import {
  defaultMatchTab,
  hasActiveMoreFilters,
  matchesBackLink,
  seasonMatchesHref,
} from '../admin-season-filters';

const NOW = new Date('2026-10-23T22:00:00Z'); // 6pm EDT
const S1 = '11111111-1111-4111-8111-111111111111';

const m = (status: MatchStatus, scheduledAt: string) => ({ status, scheduledAt });
const PAST = '2026-10-22T23:00:00Z';
const FUTURE = '2026-10-24T23:00:00Z';

describe('match tab membership (UTC instants)', () => {
  it('puts a past scheduled match under Needs results only', () => {
    expect(matchTabOf(m('scheduled', PAST), NOW)).toBe('needs-results');
    expect(matchInTab(m('scheduled', PAST), 'upcoming', NOW)).toBe(false);
    expect(needsResult(m('scheduled', PAST), NOW)).toBe(true);
  });

  it('puts future scheduled and any live match under Upcoming', () => {
    expect(matchTabOf(m('scheduled', FUTURE), NOW)).toBe('upcoming');
    expect(matchTabOf(m('live', PAST), NOW)).toBe('upcoming');
    expect(needsResult(m('live', PAST), NOW)).toBe(false);
  });

  it('treats the exact start instant as not yet past', () => {
    expect(matchTabOf(m('scheduled', NOW.toISOString()), NOW)).toBe('upcoming');
  });

  it('puts completed, forfeit and cancelled under Completed regardless of date', () => {
    for (const status of ['completed', 'forfeit', 'cancelled'] as const) {
      expect(matchTabOf(m(status, PAST), NOW)).toBe('completed');
      expect(matchTabOf(m(status, FUTURE), NOW)).toBe('completed');
    }
  });

  it('All holds everything and each match is in exactly one other tab', () => {
    const all: MatchStatus[] = ['scheduled', 'live', 'completed', 'forfeit', 'cancelled'];
    for (const status of all) {
      for (const at of [PAST, FUTURE]) {
        expect(matchInTab(m(status, at), 'all', NOW)).toBe(true);
        const hits = (['needs-results', 'upcoming', 'completed'] as const).filter((t) => matchInTab(m(status, at), t, NOW));
        expect(hits).toHaveLength(1);
      }
    }
  });

  it('validates tab values', () => {
    expect(isMatchTab('upcoming')).toBe(true);
    expect(isMatchTab('nope')).toBe(false);
    expect(isMatchTab(undefined)).toBe(false);
  });
});

describe('default sort per tab', () => {
  it('reads work queues oldest first and history newest first', () => {
    expect(defaultSortForTab('needs-results')).toBe('asc');
    expect(defaultSortForTab('upcoming')).toBe('asc');
    expect(defaultSortForTab('completed')).toBe('desc');
    expect(defaultSortForTab('all')).toBe('desc');
  });

  it('an explicit pick wins over the tab default', () => {
    expect(effectiveSort('needs-results', 'auto')).toBe('asc');
    expect(effectiveSort('needs-results', 'desc')).toBe('desc');
    expect(effectiveSort('completed', 'asc')).toBe('asc');
  });
});

describe('default tab from the URL', () => {
  it('a plain visit lands on Needs results', () => {
    expect(defaultMatchTab({})).toBe('needs-results');
    expect(defaultMatchTab({ game: 'valorant' } as never)).toBe('needs-results');
  });

  it('from=league lands on All', () => {
    expect(defaultMatchTab({ from: 'league' })).toBe('all');
    expect(defaultMatchTab({ from: ['league', 'x'] })).toBe('all');
  });

  it('a season param lands on All, but the explorer own season=all marker does not', () => {
    expect(defaultMatchTab({ season: S1 })).toBe('all');
    expect(defaultMatchTab({ season: 'all' })).toBe('needs-results');
    expect(defaultMatchTab({ season: '' })).toBe('needs-results');
  });

  it('the View matches link from League Setup lands on All and keeps its back link', () => {
    const url = new URL(seasonMatchesHref(S1, 'valorant'), 'http://x');
    const params = { season: url.searchParams.get('season') ?? undefined, from: url.searchParams.get('from') ?? undefined };
    expect(defaultMatchTab(params)).toBe('all');
    expect(matchesBackLink(params.from, { isActive: true })).toEqual({ href: '/admin/league', label: 'League Setup' });
  });
});

describe('More filters indicator', () => {
  it('is on only for a non-default division or sort', () => {
    expect(hasActiveMoreFilters({ division: '', sort: 'auto' })).toBe(false);
    expect(hasActiveMoreFilters({ division: 'JV', sort: 'auto' })).toBe(true);
    expect(hasActiveMoreFilters({ division: '', sort: 'asc' })).toBe(true);
  });
});

describe('day grouping in Eastern time', () => {
  const row = (id: string, scheduledAt: string) => ({ id, scheduledAt });

  it('groups by the New York calendar day, not the UTC day', () => {
    // 11:30pm and 12:30am ET straddle UTC midnight and a New York midnight respectively.
    const groups = groupMatchesByDay([
      row('a', '2026-10-22T03:30:00Z'), // Oct 21 11:30pm EDT
      row('b', '2026-10-22T20:00:00Z'), // Oct 22 4:00pm EDT
      row('c', '2026-10-23T04:30:00Z'), // Oct 23 12:30am EDT
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
    expect(groups[0].heading).toContain('October 21');
  });

  it('keeps the given order and stays correct when more rows are appended', () => {
    const first = [row('a', '2026-10-22T20:00:00Z'), row('b', '2026-10-22T22:00:00Z')];
    const more = [row('c', '2026-10-22T23:00:00Z'), row('d', '2026-10-23T20:00:00Z')];
    const groups = groupMatchesByDay([...first, ...more]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a', 'b', 'c'], ['d']]);
  });
});

describe('local effect of a saved edit', () => {
  const item = (id: string, status: MatchStatus, scheduledAt: string): MatchPageItemDto => ({
    id,
    seasonId: 's',
    scheduledAt,
    status,
    homeScore: null,
    awayScore: null,
    division: 'Varsity',
    homeTeam: 'A',
    awayTeam: 'B',
  });
  const list = [item('1', 'scheduled', PAST), item('2', 'scheduled', PAST)];

  it('a saved result leaves the Needs results tab', () => {
    const res = applySavedMatch(list, '1', { status: 'completed', homeScore: 13, awayScore: 9 }, 'needs-results', NOW);
    expect(res.removed).toBe(true);
    expect(res.items.map((i) => i.id)).toEqual(['2']);
  });

  it('stays in place on All and takes the new values', () => {
    const res = applySavedMatch(list, '1', { status: 'completed', homeScore: 13, awayScore: 9 }, 'all', NOW);
    expect(res.removed).toBe(false);
    expect(res.items[0]).toMatchObject({ status: 'completed', homeScore: 13, awayScore: 9 });
  });

  it('applied to the latest list (functional update), rows appended meanwhile survive', () => {
    const stale = list;
    const latest = [...stale, item('9', 'scheduled', PAST)]; // "Load more" landed during the save
    const res = applySavedMatch(latest, '1', { status: 'completed', homeScore: 1, awayScore: 0 }, 'needs-results', NOW);
    expect(res.items.map((i) => i.id)).toEqual(['2', '9']);
  });

  it('marking cancelled moves a row out of Upcoming', () => {
    const res = applySavedMatch([item('3', 'scheduled', FUTURE)], '3', { status: 'cancelled', homeScore: null, awayScore: null }, 'upcoming', NOW);
    expect(res.items).toHaveLength(0);
  });
});

describe('score input parsing', () => {
  it('blank is null, digits parse, anything else is NaN', () => {
    expect(parseScoreInput('')).toBeNull();
    expect(parseScoreInput('  ')).toBeNull();
    expect(parseScoreInput(' 13 ')).toBe(13);
    expect(parseScoreInput('0')).toBe(0);
    expect(parseScoreInput('-1')).toBeNaN();
    expect(parseScoreInput('1a')).toBeNaN();
  });
});
