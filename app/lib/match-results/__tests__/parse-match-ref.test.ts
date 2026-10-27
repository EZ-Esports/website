import { describe, expect, it } from 'vitest';
import { parseMatchReference, parseMatchReferences } from '../parse-match-ref';
import { uuid } from './fixtures';

describe('parseMatchReference', () => {
  it('accepts a bare uuid and lower-cases it', () => {
    expect(parseMatchReference('ABCDEF12-0000-4000-8000-000000000001')).toBe('abcdef12-0000-4000-8000-000000000001');
  });

  it('accepts tracker.gg links with or without scheme, www, trailing path or query', () => {
    const id = uuid(1);
    expect(parseMatchReference(`https://tracker.gg/valorant/match/${id}`)).toBe(id);
    expect(parseMatchReference(`tracker.gg/valorant/match/${id}`)).toBe(id);
    expect(parseMatchReference(`https://www.tracker.gg/valorant/match/${id}?handle=a%23b`)).toBe(id);
    expect(parseMatchReference(`https://tracker.gg/valorant/match/${id}/overview#x`)).toBe(id);
  });

  it('rejects other hosts, other games, and junk', () => {
    const id = uuid(1);
    expect(parseMatchReference(`https://evil.example/valorant/match/${id}`)).toBeNull();
    expect(parseMatchReference(`https://tracker.gg.evil.example/valorant/match/${id}`)).toBeNull();
    expect(parseMatchReference(`https://tracker.gg/lol/match/${id}`)).toBeNull();
    expect(parseMatchReference('not-a-match')).toBeNull();
    expect(parseMatchReference('')).toBeNull();
    expect(parseMatchReference('javascript:alert(1)')).toBeNull();
  });
});

describe('parseMatchReferences', () => {
  it('splits on newlines, commas and spaces', () => {
    const r = parseMatchReferences(`${uuid(1)}, https://tracker.gg/valorant/match/${uuid(2)}\n${uuid(3)}`);
    expect(r.errors).toEqual([]);
    expect(r.ids).toEqual([uuid(1), uuid(2), uuid(3)]);
  });

  it('requires at least two and at most three games', () => {
    expect(parseMatchReferences(uuid(1)).errors).toEqual(['A best-of-3 needs at least 2 games.']);
    expect(parseMatchReferences([1, 2, 3, 4].map(uuid).join(' ')).errors).toEqual(['A best-of-3 has at most 3 games.']);
    expect(parseMatchReferences('').errors).toHaveLength(1);
  });

  it('flags malformed entries and repeats before any fetch', () => {
    const r = parseMatchReferences(`${uuid(1)} nope ${uuid(1)}`);
    expect(r.errors).toEqual([
      'Entry 2 is not a match ID or a tracker.gg match link.',
      'Entry 3 repeats a match that is already listed.',
    ]);
  });
});
