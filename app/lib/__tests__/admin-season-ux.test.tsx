import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminFilterTabs, AdminToast } from '@/app/components/admin/AdminUI';
import {
  DEFAULT_MATCH_FACETS,
  leagueStatusHref,
  matchCountsKey,
  matchFacetsKey,
  matchFetchDelayMs,
  shouldAdoptServerPage,
  nextMatchFilterSearch,
  nextFiltersOnSeasonChange,
  parseMatchFilterParams,
  seasonMatchesTab,
  seasonMovedHint,
  seasonTab,
} from '@/app/lib/admin-season-filters';

const seasons = [
  { id: '11111111-1111-4111-8111-111111111111', gameId: 'g-val', isActive: true },
  { id: '22222222-2222-4222-8222-222222222222', gameId: 'g-lol', isActive: false },
];
const games = [
  { id: 'g-val', slug: 'valorant' },
  { id: 'g-lol', slug: 'league-of-legends' },
];

describe('season tab membership and moved hint', () => {
  it('maps a season to its tab and matches tabs correctly', () => {
    expect(seasonTab(true)).toBe('active');
    expect(seasonTab(false)).toBe('inactive');
    expect(seasonMatchesTab(true, 'active')).toBe(true);
    expect(seasonMatchesTab(true, 'inactive')).toBe(false);
    expect(seasonMatchesTab(false, 'inactive')).toBe(true);
    expect(seasonMatchesTab(false, 'active')).toBe(false);
    expect(seasonMatchesTab(false, 'all')).toBe(true);
    expect(seasonMatchesTab(true, 'all')).toBe(true);
  });

  it('gives no hint when the season is still visible', () => {
    expect(seasonMovedHint(true, 'active')).toBeNull();
    expect(seasonMovedHint(false, 'inactive')).toBeNull();
    expect(seasonMovedHint(false, 'all')).toBeNull();
  });

  it('names the tab and links to it when the season moved', () => {
    expect(seasonMovedHint(false, 'active')).toEqual({
      tab: 'inactive',
      text: 'It is now under the Inactive tab.',
      actionLabel: 'Show Inactive',
      href: '/admin/league?status=inactive',
    });
    const toActive = seasonMovedHint(true, 'inactive');
    expect(toActive?.text).toBe('It is now under the Active tab.');
    expect(toActive?.href).toBe(leagueStatusHref('active'));
    expect(toActive?.href).toBe('/admin/league');
  });
});

describe('Matches explorer: picking a season selects its game', () => {
  it('sets the game from the season even when the game was "All games"', () => {
    expect(nextFiltersOnSeasonChange(seasons[1].id, '', seasons)).toEqual({ gameId: 'g-lol', seasonId: seasons[1].id });
  });

  it('agrees with what a reload would show (parseMatchFilterParams)', () => {
    const picked = nextFiltersOnSeasonChange(seasons[0].id, '', seasons);
    expect(parseMatchFilterParams({ season: picked.seasonId }, games, seasons)).toEqual(picked);
  });

  it('"All seasons" keeps the current game and clears the season', () => {
    expect(nextFiltersOnSeasonChange('', 'g-val', seasons)).toEqual({ gameId: 'g-val', seasonId: '' });
  });

  it('an unknown season id leaves the game untouched', () => {
    expect(nextFiltersOnSeasonChange('nope', 'g-val', seasons).gameId).toBe('g-val');
  });
});

describe('rendered tabs and toast hint', () => {
  it('renders the season tabs with counts and marks only the selected one current', () => {
    const html = renderToStaticMarkup(
      <AdminFilterTabs
        label="Filter seasons by status"
        items={(['active', 'inactive', 'all'] as const).map((key) => ({
          key,
          label: key,
          href: leagueStatusHref(key),
          active: key === 'inactive',
          count: key === 'all' ? 3 : 1,
        }))}
      />,
    );
    expect(html).toContain('aria-label="Filter seasons by status"');
    expect(html).toContain('href="/admin/league?status=inactive"');
    expect(html).toContain('href="/admin/league"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('renders the hint text and a visible (not hover-gated) link to the destination tab', () => {
    const hint = seasonMovedHint(false, 'active')!;
    const html = renderToStaticMarkup(
      <AdminToast
        toast={{ message: `Season created. ${hint.text}`, type: 'success', action: { label: hint.actionLabel, href: hint.href } }}
      />,
    );
    expect(html).toContain('It is now under the Inactive tab.');
    expect(html).toContain('href="/admin/league?status=inactive"');
    expect(html).toContain('Show Inactive');
    expect(html).not.toContain('hover:');
  });

  it('renders a plain toast with no link when there is no action', () => {
    const html = renderToStaticMarkup(<AdminToast toast={{ message: 'Season updated.', type: 'success' }} />);
    expect(html).toContain('Season updated.');
    expect(html).not.toContain('<a ');
  });
});

describe('nextMatchFilterSearch (URL is the source of truth)', () => {
  const S1 = seasons[0].id;
  const S2 = seasons[1].id;
  const next = (cur: string, change: Parameters<typeof nextMatchFilterSearch>[1]) =>
    new URLSearchParams(nextMatchFilterSearch(cur, change, games, seasons));

  it('picking a season from a bare URL writes the season and its game', () => {
    const q = next('', { season: S2 });
    expect(q.get('season')).toBe(S2);
    expect(q.get('game')).toBe('league-of-legends');
  });

  it('picking a game from a bare URL writes season=all (explicit all seasons)', () => {
    const q = next('', { game: 'g-val' });
    expect(q.get('game')).toBe('valorant');
    expect(q.get('season')).toBe('all');
  });

  it('switching game drops a season of another game, keeps one of the same game', () => {
    expect(next(`season=${S1}&game=valorant`, { game: 'g-lol' }).get('season')).toBe('all');
    expect(next(`season=${S1}&game=valorant`, { game: 'g-val' }).get('season')).toBe(S1);
  });

  it('"All games" clears game and season', () => {
    expect(nextMatchFilterSearch(`season=${S1}&game=valorant`, { game: '' }, games, seasons)).toBe('');
  });

  it('"All seasons" keeps the game', () => {
    const q = next(`season=${S1}&game=valorant`, { season: '' });
    expect(q.get('game')).toBe('valorant');
    expect(q.get('season')).toBe('all');
  });

  it('preserves unrelated params such as from=league, with or without a leading "?"', () => {
    expect(next(`?from=league&season=${S1}&game=valorant`, { season: S2 }).get('from')).toBe('league');
    expect(next('from=league', { game: 'g-val' }).get('from')).toBe('league');
  });

  it('treats invalid current params like the server does (fall back safely)', () => {
    const q = next('game=bogus&season=nope&from=league', { game: 'g-lol' });
    expect(q.get('game')).toBe('league-of-legends');
    expect(q.get('season')).toBe('all');
    expect(q.get('from')).toBe('league');
  });

  it('rapid successive changes build on the latest URL: the last choice wins', () => {
    let search = '';
    search = nextMatchFilterSearch(search, { game: 'g-val' }, games, seasons);
    search = nextMatchFilterSearch(search, { season: S2 }, games, seasons);
    search = nextMatchFilterSearch(search, { game: 'g-val' }, games, seasons);
    const parsed = new URLSearchParams(search);
    expect(parseMatchFilterParams({ game: parsed.get('game') ?? undefined, season: parsed.get('season') ?? undefined }, games, seasons))
      .toEqual({ gameId: 'g-val', seasonId: '' });
  });

  it('round-trips through parseMatchFilterParams for every change', () => {
    for (const change of [{ game: 'g-val' }, { game: 'g-lol' }, { game: '' }, { season: S1 }, { season: S2 }, { season: '' }] as const) {
      const q = new URLSearchParams(nextMatchFilterSearch(`season=${S1}&game=valorant`, change, games, seasons));
      const got = parseMatchFilterParams({ game: q.get('game') ?? undefined, season: q.get('season') ?? undefined }, games, seasons);
      if ('game' in change) expect(got.gameId).toBe(change.game);
      else if (change.season) expect(got.seasonId).toBe(change.season);
      else expect(got.seasonId).toBe('');
    }
  });
});

describe('explorer fetch/adoption helpers', () => {
  const base = { ...DEFAULT_MATCH_FACETS, gameId: 'g1', seasonId: 's1', tab: 'needs-results' as const };

  it('keys by value, not identity', () => {
    expect(matchFacetsKey({ ...base })).toBe(matchFacetsKey(base));
    expect(matchFacetsKey({ ...base, search: 'a' })).not.toBe(matchFacetsKey(base));
    expect(matchFacetsKey({ ...base, tab: 'all' })).not.toBe(matchFacetsKey(base));
  });

  it('a tab or sort change refetches at once; counts only depend on game/season/division/search', () => {
    expect(matchFetchDelayMs(base, { ...base, tab: 'completed' })).toBe(0);
    expect(matchCountsKey({ ...base, search: '' })).toBe(matchCountsKey(base));
    expect(matchCountsKey(base)).not.toBe(matchCountsKey({ ...base, division: 'JV' }));
    expect(matchCountsKey(base)).not.toBe(matchCountsKey({ ...base, search: 'x' }));
  });

  it('debounces only a pure search change', () => {
    expect(matchFetchDelayMs(base, { ...base, search: 'ab' })).toBe(300);
    expect(matchFetchDelayMs(base, { ...base, seasonId: 's2' })).toBe(0);
    expect(matchFetchDelayMs(base, { ...base, gameId: 'g2', seasonId: '' })).toBe(0);
    expect(matchFetchDelayMs(base, { ...base, search: 'ab', division: 'JV' })).toBe(0);
    expect(matchFetchDelayMs(base, { ...base, division: 'JV' })).toBe(0);
  });

  it('adopts a server page only when game/season differ from the rows shown', () => {
    expect(shouldAdoptServerPage({ gameId: 'g1', seasonId: 's2' }, base)).toBe(true);
    expect(shouldAdoptServerPage({ gameId: 'g2', seasonId: '' }, base)).toBe(true);
    expect(shouldAdoptServerPage({ gameId: 'g1', seasonId: 's1' }, base)).toBe(false);
  });

  it('does not adopt a server page for filters the explorer itself just wrote', () => {
    const own = { gameId: 'g2', seasonId: '' };
    // select change to g2 pending (shown still g1/s1); a refresh for g2 must not reset local facets
    expect(shouldAdoptServerPage({ gameId: 'g2', seasonId: '' }, base, own)).toBe(false);
    // a navigation to different filters is still adopted
    expect(shouldAdoptServerPage({ gameId: 'g1', seasonId: 's2' }, base, own)).toBe(true);
    expect(shouldAdoptServerPage({ gameId: 'g2', seasonId: '' }, base, null)).toBe(true);
  });
});
