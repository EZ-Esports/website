import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { countsForStandings } from '../../db/seed-gold';

/**
 * The 2025-26 Valorant A-team (Varsity) playoff bracket, as reported in
 * Discord. This file is the reviewable record. Nothing here writes to the
 * database; gold ingest is a separate, explicit step.
 */

interface PlayoffMatch {
  season: string;
  game_slug: string;
  home_division: string;
  away_division: string;
  scheduled_at: string;
  home_school_slug: string;
  away_school_slug: string;
  home_score: string;
  away_score: string;
  status: string;
  mvp: string;
  notes: string;
  counts_for_standings: string;
}

const rows = JSON.parse(
  readFileSync(resolve(__dirname, '../manual/valorant-2025-26-a-playoffs.json'), 'utf8')
) as PlayoffMatch[];

const byPair = (home: string, away: string) =>
  rows.find((row) => row.home_school_slug === home && row.away_school_slug === away);

describe('2025-26 Valorant A-team playoffs', () => {
  it('records the seven-match single-elimination bracket and no regular-season games', () => {
    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((row) => row.season))).toEqual(new Set(['2025-26']));
    expect(new Set(rows.map((row) => row.game_slug))).toEqual(new Set(['valorant']));
    expect(rows.every((row) => row.home_division === 'Varsity' && row.away_division === 'Varsity')).toBe(true);
    expect(rows.every((row) => row.counts_for_standings === 'false')).toBe(true);
    expect(rows.every((row) => countsForStandings(row.counts_for_standings) === false)).toBe(true);
  });

  it('keeps a blank standings flag counting, and only an explicit false opts out', () => {
    expect(countsForStandings(undefined)).toBe(true);
    expect(countsForStandings('')).toBe(true);
    expect(countsForStandings('true')).toBe(true);
    expect(countsForStandings('false')).toBe(false);
  });

  it('places the higher seed at home and gives that side the series', () => {
    // The Discord posts name a winner and a seed, not a home team. Higher
    // seed is home so the series score reads winner-first on the schedule.
    expect(rows.every((row) => Number(row.home_score) > Number(row.away_score))).toBe(true);
  });

  it('uses distinct kickoffs so a playoff cannot share a source key with a 7:00 PM sheet row', () => {
    const keys = rows.map((row) =>
      [row.season, row.game_slug, row.home_school_slug, row.home_division, row.away_school_slug, row.away_division, row.scheduled_at].join('|')
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.every((row) => row.scheduled_at.endsWith('19:00:00'))).toBe(false);
  });

  it('records the quarterfinals, including the two forfeits as 2-0', () => {
    const stuy = byPair('stuyvesant-high-school', 'tottenville-high-school');
    const goldstein = byPair('brooklyn-technical-high-school', 'leon-m-goldstein-high-school');
    const midwood = byPair('bayside-high-school', 'midwood-high-school');
    const sitech = byPair('bronx-high-school-of-science', 'staten-island-technical-high-school');

    expect(stuy).toMatchObject({
      home_score: '2', away_score: '0', status: 'completed', mvp: 'Yi "gravy" Jiang',
      scheduled_at: '2026-04-04 19:41:00',
    });
    expect(stuy?.notes).toContain('Pearl: Stuyvesant High School 13-6');
    expect(stuy?.notes).toContain('Bind: Stuyvesant High School 13-7');
    expect(stuy?.notes).toContain('placeholder');

    expect(goldstein).toMatchObject({
      home_score: '2', away_score: '0', status: 'forfeit', mvp: 'Ryan "Comaticx" Lai',
      scheduled_at: '2026-04-04 19:42:00',
    });
    expect(goldstein?.notes).toContain('forfeited');

    expect(midwood).toMatchObject({
      home_score: '2', away_score: '0', status: 'completed', mvp: 'Ethan "global ixia" L',
      scheduled_at: '2026-04-04 21:42:00',
    });
    expect(midwood?.notes).toContain('Lotus: Bayside High School 13-7');

    expect(sitech).toMatchObject({
      home_score: '2', away_score: '0', status: 'forfeit', mvp: 'Jacky "Truth" Zhang',
      scheduled_at: '2026-04-07 10:35:00',
    });
    expect(sitech?.notes).toContain('forfeited');
  });

  it('records the semifinals and Brooklyn Tech’s 3-1 final over Bayside', () => {
    const stuy = byPair('bayside-high-school', 'stuyvesant-high-school');
    const bxsci = byPair('brooklyn-technical-high-school', 'bronx-high-school-of-science');
    const final = byPair('brooklyn-technical-high-school', 'bayside-high-school');

    expect(stuy).toMatchObject({
      home_score: '2', away_score: '0', status: 'completed', mvp: 'Jonathan "Always" M',
      scheduled_at: '2026-04-11 23:03:00',
    });
    expect(stuy?.notes).toContain('Playoff semifinal');

    expect(bxsci).toMatchObject({
      home_score: '2', away_score: '1', status: 'completed', mvp: 'Calvin "racecar" Lam',
      scheduled_at: '2026-04-11 23:15:00',
    });
    expect(bxsci?.notes).toContain('Split: Bronx High School of Science 13-7');

    expect(final).toMatchObject({
      home_score: '3', away_score: '1', status: 'completed', mvp: 'Ryan "Comaticx" Lai',
      scheduled_at: '2026-04-18 16:43:00',
    });
    expect(final?.notes).toContain('Playoff final');
    expect(final?.notes).toContain('Breeze: Brooklyn Technical High School 13-11');
  });
});
