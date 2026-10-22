import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminFilterTabs, AdminToast } from '@/app/components/admin/AdminUI';
import {
  leagueStatusHref,
  matchExplorerKey,
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

describe('Matches explorer remount key', () => {
  it('is stable for identical validated filters', () => {
    expect(matchExplorerKey('g-val', 's1')).toBe(matchExplorerKey('g-val', 's1'));
  });

  it('changes when the validated game or season changes, so the explorer remounts', () => {
    const base = matchExplorerKey('g-val', 's1');
    expect(matchExplorerKey('g-lol', 's1')).not.toBe(base);
    expect(matchExplorerKey('g-val', 's2')).not.toBe(base);
    expect(matchExplorerKey('', '')).not.toBe(base);
  });

  it('distinguishes "all games" from "game with all seasons" and never collides across fields', () => {
    expect(matchExplorerKey('', '')).not.toBe(matchExplorerKey('g-val', ''));
    expect(matchExplorerKey('g-val', '')).not.toBe(matchExplorerKey('', 'g-val'));
  });

  it('follows the server-validated filters: sidebar link (no query) differs from a deep link', () => {
    const deep = parseMatchFilterParams({ season: seasons[1].id }, games, seasons);
    const plain = parseMatchFilterParams({}, games, seasons);
    expect(matchExplorerKey(deep.gameId, deep.seasonId)).not.toBe(matchExplorerKey(plain.gameId, plain.seasonId));
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
