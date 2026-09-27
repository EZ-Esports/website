/**
 * The rules that decide what a leadership import does to a row it already
 * matches. `mergeLeadership` itself needs a database; `planRecord` and
 * `dedupeRecords` hold every judgement it makes, and are tested here.
 *
 * These encode a deliberate asymmetry: the import may add what is missing, and
 * may fill a blank, and may do nothing — but it may never remove or overwrite.
 * That is the whole reason the table stopped being wiped.
 */
import { describe, it, expect } from 'vitest';
import {
  planRecord,
  dedupeRecords,
  personKey,
  termKey,
  leadershipKey,
  type LeadershipRecord,
} from '../leadership-merge';

const record = (over: Partial<LeadershipRecord> = {}): LeadershipRecord => ({
  name: 'Jane Doe',
  role: 'VALORANT Director',
  year: '2022',
  bio: 'likes cats',
  ...over,
});

const row = (
  over: Partial<{
    id: string;
    role?: string;
    bio: string | null;
    highSchool?: string | null;
    university?: string | null;
    deletedAt: Date | null;
  }> = {}
) => ({
  id: 'row-1',
  role: 'VALORANT Director',
  bio: null as string | null,
  highSchool: null as string | null,
  university: null as string | null,
  deletedAt: null as Date | null,
  ...over,
});

describe('personKey', () => {
  it('is stable across casing and surrounding whitespace', () => {
    expect(personKey({ name: ' Jane Doe ' })).toBe(personKey({ name: 'jane doe' }));
  });

  it('groups the same person regardless of year or role', () => {
    expect(personKey({ name: 'Jane Doe' })).toBe('jane doe');
  });
});

describe('termKey and leadershipKey', () => {
  it('is stable across casing and surrounding whitespace', () => {
    expect(termKey({ name: ' Jane Doe ', year: '2022', role: 'President' })).toBe(
      termKey({ name: 'jane doe', year: '2022', role: 'president' })
    );
  });

  it('separates people who differ only by year', () => {
    expect(leadershipKey({ name: 'Jane Doe', year: '2022' })).not.toBe(
      leadershipKey({ name: 'Jane Doe', year: '2023' })
    );
  });

  it('separates distinct roles held in the same year', () => {
    expect(
      termKey({ name: 'Jane Doe', year: '2025', role: 'President' })
    ).not.toBe(
      termKey({ name: 'Jane Doe', year: '2025', role: 'Game Director' })
    );
  });
});

describe('planRecord', () => {
  it('inserts a record that matches nothing — the recovery case', () => {
    expect(planRecord(record(), [])).toEqual({ action: 'insert' });
  });

  it('inserts a second distinct role for the same person in the same year', () => {
    const plan = planRecord(record({ role: 'President' }), [
      row({ id: 'a', role: 'Engineering Director', bio: 'existing' }),
    ]);
    expect(plan).toEqual({ action: 'insert' });
  });

  it('fills a blank bio for matching role', () => {
    expect(planRecord(record({ bio: 'likes cats' }), [row({ bio: null })])).toEqual({
      action: 'fill-bio',
      id: 'row-1',
      fillBio: 'likes cats',
    });
  });

  it('treats a whitespace-only bio as blank', () => {
    expect(planRecord(record({ bio: 'likes cats' }), [row({ bio: '   ' })])).toEqual({
      action: 'fill-bio',
      id: 'row-1',
      fillBio: 'likes cats',
    });
  });

  it('never overwrites a bio that is already there', () => {
    // An admin edit is newer than the CSV by definition; a re-run must not undo it.
    expect(
      planRecord(record({ bio: 'from the csv' }), [row({ bio: 'edited in the admin' })])
    ).toEqual({ action: 'skip', note: '' });
  });

  it('fills missing high school and university fields', () => {
    expect(
      planRecord(
        record({ bio: 'cats', highSchool: 'Brooklyn Tech', university: 'NYU' }),
        [row({ bio: 'cats', highSchool: null, university: null })]
      )
    ).toEqual({
      action: 'fill-bio',
      id: 'row-1',
      fillHighSchool: 'Brooklyn Tech',
      fillUniversity: 'NYU',
    });
  });

  it('does nothing when the record has no bio or school info to contribute', () => {
    expect(planRecord(record({ bio: null }), [row({ bio: null })])).toEqual({
      action: 'skip',
      note: '',
    });
  });

  it('does not resurrect a soft-deleted row for the same role', () => {
    const plan = planRecord(record(), [row({ deletedAt: new Date('2026-01-01') })]);
    expect(plan.action).toBe('skip');
    expect(plan).toHaveProperty('note', expect.stringMatching(/soft-deleted/));
  });

  it('matches by role when multiple active rows exist', () => {
    const plan = planRecord(record({ role: 'President', bio: 'new bio' }), [
      row({ id: 'a', role: 'Engineering Director', bio: null }),
      row({ id: 'b', role: 'President', bio: null }),
    ]);
    expect(plan.action).toBe('fill-bio');
    expect(plan).toHaveProperty('id', 'b');
  });
});

describe('dedupeRecords', () => {
  it('passes distinct records through untouched', () => {
    const records = [record(), record({ year: '2023' }), record({ name: 'Bob Smith' })];
    expect(dedupeRecords(records).unique).toHaveLength(3);
    expect(dedupeRecords(records).collapsed).toEqual([]);
  });

  it('preserves distinct roles for the same person in the same year without data loss', () => {
    const records = [
      record({ role: 'President', bio: 'Pres bio' }),
      record({ role: 'Game Director', bio: 'Director bio' }),
    ];
    const { unique, collapsed } = dedupeRecords(records);
    expect(unique).toHaveLength(2);
    expect(collapsed).toEqual([]);
    expect(unique.map((r) => r.role)).toEqual(['President', 'Game Director']);
  });

  it('collapses records sharing person, year, and role and reports them', () => {
    const { unique, collapsed } = dedupeRecords([record(), record()]);
    expect(unique).toHaveLength(1);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toContain('Jane Doe');
    expect(collapsed[0]).toContain('2022');
    expect(collapsed[0]).toContain('VALORANT Director');
  });

  it('keeps a bio from a later duplicate when the first has none', () => {
    const { unique } = dedupeRecords([record({ bio: null }), record({ bio: 'likes cats' })]);
    expect(unique[0].bio).toBe('likes cats');
  });

  it('prefers the first record when both have a bio', () => {
    const { unique } = dedupeRecords([record({ bio: 'first' }), record({ bio: 'second' })]);
    expect(unique[0].bio).toBe('first');
  });
});
