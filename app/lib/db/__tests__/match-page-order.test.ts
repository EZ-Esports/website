import { describe, expect, it } from 'vitest';
import { buildMatchesPageQuery } from '@/app/lib/db/queries';
import { cursorFor } from '@/app/lib/db/match-page';

const cursor = cursorFor({
  scheduledAt: new Date('2026-11-02T00:00:00.000Z'),
  homeTeam: 'Bronx Science',
  division: 'JV',
  id: '11111111-1111-4111-8111-111111111111',
});

describe('staff match list ordering', () => {
  it('orders ties on one kickoff by home school, then division, then id, in both directions', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const { sql } = buildMatchesPageQuery({ sort: dir }).toSQL();
      const order = sql.slice(sql.indexOf(' order by '));
      const at = (needle: string) => order.indexOf(needle);
      expect(at('scheduled_at')).toBeGreaterThan(-1);
      expect(at('scheduled_at')).toBeLessThan(at('"home_school"."name"'));
      expect(at('"home_school"."name"')).toBeLessThan(at('case'));
      expect(at('case')).toBeLessThan(order.lastIndexOf('"matches"."id"'));
      // Every key runs the same way, so the reversed list is the exact mirror image.
      expect(order.match(new RegExp(` ${dir}`, 'g'))).toHaveLength(4);
      expect(order.match(new RegExp(` ${dir === 'asc' ? 'desc' : 'asc'}`, 'g'))).toBeNull();
    }
  });

  it('builds a four-column lexicographic keyset: gt for asc, lt for desc, all four values bound', () => {
    const asc = buildMatchesPageQuery({ sort: 'asc', cursor }).toSQL();
    const desc = buildMatchesPageQuery({ sort: 'desc', cursor }).toSQL();
    const where = (sql: string) => sql.slice(sql.indexOf(' where '), sql.indexOf(' order by '));
    expect(where(asc.sql)).toContain(' > ');
    expect(where(asc.sql)).not.toContain(' < ');
    expect(where(desc.sql)).toContain(' < ');
    expect(where(desc.sql)).not.toContain(' > ');
    // One OR branch per key column: 4 comparisons, with the earlier keys pinned by equality.
    expect(where(asc.sql).match(/ > /g)).toHaveLength(4);
    // Branch k pins keys 0..k-1 by equality, so the home name is bound in branches 2, 3 and 4.
    expect(asc.params.filter((p) => p === 'Bronx Science')).toHaveLength(3);
    expect(asc.params.filter((p) => p === cursor.id)).toHaveLength(1);
    for (const v of ['Bronx Science', 'JV', cursor.id]) expect(asc.params).toContain(v);
    expect(asc.params.some((p) => p instanceof Date || p === cursor.scheduledAt || String(p).startsWith('2026-11-02'))).toBe(true);
  });

  it('cursorFor carries every key of the row, so the next page resumes exactly after it', () => {
    expect(cursor).toEqual({
      scheduledAt: '2026-11-02T00:00:00.000Z',
      home: 'Bronx Science',
      division: 'JV',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });
});

describe('keyset paging across a shared kickoff (reference model of the SQL)', () => {
  type Row = { scheduledAt: Date; homeTeam: string; division: string; id: string };
  const kickoff = new Date('2026-11-02T00:00:00.000Z');
  const rows: Row[] = ['Alpha', 'Bronx', 'Cardozo', 'Dewitt'].flatMap((school, i) =>
    (['Varsity', 'JV'] as const).map((division, j) => ({
      scheduledAt: kickoff,
      homeTeam: school,
      division,
      id: `00000000-0000-4000-8000-${String(((i * 7 + j * 3) * 13) % 97).padStart(12, '0')}`,
    }))
  );
  const key = (r: Row) => [r.scheduledAt.toISOString(), r.homeTeam, r.division, r.id];
  const cmp = (a: Row, b: Row) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  };
  const after = (r: Row, c: ReturnType<typeof cursorFor>, sort: 'asc' | 'desc') => {
    const d = cmp(r, { scheduledAt: new Date(c.scheduledAt), homeTeam: c.home, division: c.division, id: c.id });
    return sort === 'asc' ? d > 0 : d < 0;
  };

  for (const sort of ['asc', 'desc'] as const) {
    it(`pages ${sort} with no skipped or repeated rows, interleaving divisions per school`, () => {
      const ordered = [...rows].sort((a, b) => (sort === 'asc' ? cmp(a, b) : cmp(b, a)));
      const seen: Row[] = [];
      let cur: ReturnType<typeof cursorFor> | null = null;
      for (let guard = 0; guard < 10; guard++) {
        const page: Row[] = ordered.filter((r) => !cur || after(r, cur, sort)).slice(0, 3);
        if (!page.length) break;
        seen.push(...page);
        cur = cursorFor(page[page.length - 1]);
      }
      expect(seen).toEqual(ordered);
      // Page boundaries fall mid-school (3 rows per page, 2 per school) without losing anything.
      expect(new Set(seen.map((r) => r.id)).size).toBe(rows.length);
      if (sort === 'asc') {
        expect(seen.slice(0, 4).map((r) => `${r.homeTeam}/${r.division}`)).toEqual(['Alpha/JV', 'Alpha/Varsity', 'Bronx/JV', 'Bronx/Varsity']);
      }
    });
  }
});
