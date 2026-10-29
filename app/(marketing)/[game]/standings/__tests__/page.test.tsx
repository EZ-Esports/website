import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StandingsPage from '../page';
import { getSeasonDivisions, getSeasonStandingsFor, getSeasonsWithGames } from '@/app/lib/db/queries';
import type { StandingRow } from '@/app/lib/db/match-page';

vi.mock('@/app/lib/db/queries', () => ({
  getSeasonsWithGames: vi.fn(),
  getSeasonDivisions: vi.fn(),
  getSeasonStandingsFor: vi.fn(),
}));

describe('StandingsPage Team Click-Redirect', () => {
  const mockSeason = {
    id: 'season-1',
    name: 'Fall 2024',
    gameSlug: 'valorant',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSeasonsWithGames).mockResolvedValue([mockSeason as any]);
    vi.mocked(getSeasonDivisions).mockResolvedValue(['Varsity', 'JV']);
  });

  describe('Team Standings Table (Public Outcomes)', () => {
    it('renders team names as links to /${game}/teams/${schoolSlug} when schoolSlug is present', async () => {
      const rows: StandingRow[] = [
        {
          schoolName: 'Brooklyn Technical High School',
          schoolSlug: 'brooklyn-technical-high-school',
          division: 'Varsity',
          rank: 1,
          wins: 5,
          losses: 0,
          gamesPlayed: 5,
          winPct: 1.0,
          points: null,
          playerName: null,
          playerIgn: null,
          notes: null,
        },
        {
          schoolName: 'Stuyvesant High School',
          schoolSlug: null, // No slug available
          division: 'Varsity',
          rank: 2,
          wins: 4,
          losses: 1,
          gamesPlayed: 5,
          winPct: 0.8,
          points: null,
          playerName: null,
          playerIgn: null,
          notes: null,
        },
      ];

      vi.mocked(getSeasonStandingsFor).mockResolvedValue({
        source: 'snapshot',
        standingsFormat: 'divided',
        outcomesPublic: true,
        rows,
      });

      const jsx = await StandingsPage({
        params: Promise.resolve({ game: 'valorant' }),
        searchParams: Promise.resolve({ division: 'Varsity' }),
      });
      const html = renderToStaticMarkup(jsx);

      // Brooklyn Tech has a slug -> rendered as link
      expect(html).toContain('href="/valorant/teams/brooklyn-technical-high-school"');
      expect(html).toContain('Brooklyn Technical High School');
      expect(html).toContain('hover:text-[var(--game-accent)]');
      expect(html).toContain('hover:underline');

      // Stuyvesant has no slug -> plain text, not linked
      expect(html).toContain('Stuyvesant High School');
      expect(html).not.toContain('/valorant/teams/stuyvesant');
    });
  });

  describe('Team Standings Table (Hidden / Pending Outcomes)', () => {
    it('renders team names as links to /${game}/teams/${schoolSlug} even when outcomes are pending', async () => {
      const rows: StandingRow[] = [
        {
          schoolName: 'Bronx High School of Science',
          schoolSlug: 'bronx-high-school-of-science',
          division: 'Varsity',
          rank: null,
          wins: null,
          losses: null,
          gamesPlayed: null,
          winPct: null,
          points: null,
          playerName: null,
          playerIgn: null,
          notes: null,
        },
      ];

      vi.mocked(getSeasonStandingsFor).mockResolvedValue({
        source: 'computed',
        standingsFormat: 'divided',
        outcomesPublic: false,
        rows,
      });

      const jsx = await StandingsPage({
        params: Promise.resolve({ game: 'valorant' }),
        searchParams: Promise.resolve({ division: 'Varsity' }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('href="/valorant/teams/bronx-high-school-of-science"');
      expect(html).toContain('Bronx High School of Science');
      expect(html).toContain('0-0');
    });
  });

  describe('Player Standings Table (Individual competitions, e.g. Minecraft)', () => {
    it('links school names to /${game}/teams/${schoolSlug} when schoolSlug is present', async () => {
      // Minecraft: competitionModel is 'team' (so standings route does not redirect to bracket), hasJvSplit: false
      const mcSeason = {
        id: 'season-mc',
        name: 'Fall 2024',
        gameSlug: 'minecraft',
        isActive: true,
      };
      vi.mocked(getSeasonsWithGames).mockResolvedValue([mcSeason as any]);
      vi.mocked(getSeasonDivisions).mockResolvedValue(['All']);

      const rows: StandingRow[] = [
        {
          schoolName: 'Midwood High School',
          schoolSlug: 'midwood-high-school',
          division: 'All',
          rank: 1,
          wins: null,
          losses: null,
          gamesPlayed: null,
          winPct: null,
          points: 32,
          playerName: 'Alex Smith',
          playerIgn: 'MidwoodAce',
          notes: null,
        },
        {
          schoolName: 'Bayside High School',
          schoolSlug: null,
          division: 'All',
          rank: 2,
          wins: null,
          losses: null,
          gamesPlayed: null,
          winPct: null,
          points: 28,
          playerName: 'Sam Doe',
          playerIgn: 'SammyD',
          notes: null,
        },
      ];

      vi.mocked(getSeasonStandingsFor).mockResolvedValue({
        source: 'snapshot',
        standingsFormat: 'divided',
        outcomesPublic: true,
        rows,
      });

      const jsx = await StandingsPage({
        params: Promise.resolve({ game: 'minecraft' }),
        searchParams: Promise.resolve({ division: 'All' }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('href="/minecraft/teams/midwood-high-school"');
      expect(html).toContain('Midwood High School');
      expect(html).toContain('Bayside High School');
      expect(html).not.toContain('/minecraft/teams/bayside');
    });

    it('links school names in PlayerStandingsTable when outcomes are hidden/pending', async () => {
      const mcSeason = {
        id: 'season-mc',
        name: 'Fall 2024',
        gameSlug: 'minecraft',
        isActive: true,
      };
      vi.mocked(getSeasonsWithGames).mockResolvedValue([mcSeason as any]);
      vi.mocked(getSeasonDivisions).mockResolvedValue(['All']);

      const rows: StandingRow[] = [
        {
          schoolName: 'Townsend Harris High School',
          schoolSlug: 'townsend-harris',
          division: 'All',
          rank: null,
          wins: null,
          losses: null,
          gamesPlayed: null,
          winPct: null,
          points: null,
          playerName: 'Jordan Lee',
          playerIgn: 'JLee',
          notes: null,
        },
      ];

      vi.mocked(getSeasonStandingsFor).mockResolvedValue({
        source: 'snapshot',
        standingsFormat: 'divided',
        outcomesPublic: false,
        rows,
      });

      const jsx = await StandingsPage({
        params: Promise.resolve({ game: 'minecraft' }),
        searchParams: Promise.resolve({ division: 'All' }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('href="/minecraft/teams/townsend-harris"');
      expect(html).toContain('Townsend Harris High School');
    });
  });

  describe('Combined Standings Table Format', () => {
    it('links team names and displays squad suffix for combined format', async () => {
      const rows: StandingRow[] = [
        {
          schoolName: 'Brooklyn Technical High School',
          schoolSlug: 'brooklyn-technical-high-school',
          division: 'Varsity',
          rank: 1,
          wins: 9,
          losses: 0,
          gamesPlayed: 9,
          winPct: 1.0,
          points: null,
          playerName: null,
          playerIgn: null,
          notes: null,
        },
        {
          schoolName: 'Brooklyn Technical High School',
          schoolSlug: 'brooklyn-technical-high-school',
          division: 'JV',
          rank: 7,
          wins: 3,
          losses: 6,
          gamesPlayed: 9,
          winPct: 0.333,
          points: null,
          playerName: null,
          playerIgn: null,
          notes: null,
        },
      ];

      vi.mocked(getSeasonStandingsFor).mockResolvedValue({
        source: 'snapshot',
        standingsFormat: 'combined',
        outcomesPublic: true,
        rows,
      });

      const jsx = await StandingsPage({
        params: Promise.resolve({ game: 'valorant' }),
        searchParams: Promise.resolve({ division: 'Combined' }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain('href="/valorant/teams/brooklyn-technical-high-school"');
      expect(html).toContain('Brooklyn Technical High School — Varsity');
      expect(html).toContain('Brooklyn Technical High School — JV');
    });
  });
});
