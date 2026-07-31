import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { matchNaturalPrefix, matchSourceKeys, memberKeyOf } from '../gold-keys';
import { readRecords } from '../import-archive';

const match = (over: Record<string, string> = {}) => ({
  season: '2022-23',
  game_slug: 'valorant',
  home_school_slug: 'new-dorp-high-school',
  home_division: 'Varsity',
  away_school_slug: 'benjamin-n-cardozo-high-school',
  away_division: 'Varsity',
  scheduled_at: '2022-12-28 19:30:00',
  notes: '',
  ...over,
});

describe('memberKeyOf', () => {
  it('is `school|first|last`, lowercased', () => {
    expect(
      memberKeyOf({
        school_slug: 'aviation-career-technical-education-high-school',
        first_name: 'Dan',
        last_name: 'Lu',
      })
    ).toBe('aviation-career-technical-education-high-school|dan|lu');
  });

  it('does not lowercase the school slug, which is already canonical', () => {
    expect(memberKeyOf({ school_slug: 'a-b', first_name: 'MC', last_name: 'De La Cruz' })).toBe(
      'a-b|mc|de la cruz'
    );
  });
});

describe('matchSourceKeys', () => {
  it('appends #0 to a row that collides with nothing', () => {
    expect(matchSourceKeys([match()])).toEqual([`${matchNaturalPrefix(match())}#0`]);
  });

  it('numbers a collision group in file order', () => {
    const keys = matchSourceKeys([
      match({ notes: 'round 9' }),
      match({ away_division: 'JV' }),
      match({ notes: '' }),
    ]);
    expect(keys[0].endsWith('#0')).toBe(true);
    expect(keys[2].endsWith('#1')).toBe(true);
    expect(keys[1].endsWith('#0')).toBe(true); // different natural key, own counter
    expect(new Set(keys).size).toBe(3);
  });

  // The whole point of the ordinal over keying on `notes`: a note can be edited
  // without silently changing which row a key refers to.
  it('is unchanged when notes, scores, status or mvp change', () => {
    const before = matchSourceKeys([match({ notes: 'a' }), match({ notes: 'b' })]);
    const after = matchSourceKeys([
      match({ notes: 'a rewritten note' }),
      match({ notes: 'b', home_score: '13', away_score: '7', status: 'forfeit', mvp: 'someone' }),
    ]);
    expect(after).toEqual(before);
  });

  it('does not renumber existing rows when a later collision is added', () => {
    const two = matchSourceKeys([match({ notes: 'a' }), match({ notes: 'b' })]);
    const three = matchSourceKeys([match({ notes: 'a' }), match({ notes: 'b' }), match({ notes: 'c' })]);
    expect(three.slice(0, 2)).toEqual(two);
    expect(three[2].endsWith('#2')).toBe(true);
  });
});

// gold_data/ is gitignored (member PII), so these only run where it is present.
const GOLD = 'sharepoint/gold_data';
const haveGold = existsSync(`${GOLD}/gold_matches.csv`) && existsSync(`${GOLD}/gold_members.csv`);

describe.skipIf(!haveGold)('against the real gold archive', () => {
  it('derives a member_key matching the CSV column, uniquely, for every row', () => {
    const rows = readRecords(`${GOLD}/gold_members.csv`);
    const derived = rows.map(memberKeyOf);
    expect(derived).toEqual(rows.map((r) => r.member_key));
    expect(new Set(derived).size).toBe(rows.length);
  });

  it('derives a unique source_key for every match row', () => {
    const rows = readRecords(`${GOLD}/gold_matches.csv`);
    const keys = matchSourceKeys(rows);
    expect(new Set(keys).size).toBe(rows.length);
  });

  // Guards the reason source_key exists at all. If this ever reports 0, the
  // normalizer started emitting a real per-match time and the ordinal could be
  // reconsidered; if it grows, a new collision appeared and is being handled.
  it('still finds exactly the two known scheduled_at collisions', () => {
    const rows = readRecords(`${GOLD}/gold_matches.csv`);
    const counts = new Map<string, number>();
    for (const r of rows) {
      const p = matchNaturalPrefix(r);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const collisions = [...counts.entries()].filter(([, n]) => n > 1);
    expect(collisions.map(([p]) => p).sort()).toEqual([
      '2022-23|valorant|new-dorp-high-school|JV|benjamin-n-cardozo-high-school|JV|2022-12-28 19:30:00',
      '2022-23|valorant|new-dorp-high-school|Varsity|benjamin-n-cardozo-high-school|Varsity|2022-12-28 19:30:00',
    ]);
    expect(collisions.every(([, n]) => n === 2)).toBe(true);
  });
});
