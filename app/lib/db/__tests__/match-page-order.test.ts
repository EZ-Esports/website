import { describe, expect, it } from 'vitest';
import { buildMatchesPageQuery, buildSeasonMatchesQuery } from '@/app/lib/db/queries';
import { cursorFor, matchOrderKey } from '@/app/lib/db/match-page';
import { divisionBlockStarts, groupMatchesByDay } from '@/app/lib/admin-match-list';

const cursor = cursorFor({
  scheduledAt: new Date('2026-11-02T00:00:00.000Z'),
  homeTeam: 'Bronx Science',
  division: 'JV',
  id: '11111111-1111-4111-8111-111111111111',
});

describe('staff match list ordering (SQL)', () => {
  it('orders by ET day, division rank, kickoff, home school, id with every key in one direction', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const { sql } = buildMatchesPageQuery({ sort: dir }).toSQL();
      const order = sql.slice(sql.indexOf(' order by '));
      const at = (needle: string) => order.indexOf(needle);
      expect(at('America/New_York')).toBeGreaterThan(-1);
      expect(at('America/New_York')).toBeLessThan(at("when 'Varsity' then 0"));
      // Rank comes before the kickoff time so a day never alternates divisions.
      expect(at("when 'Varsity' then 0")).toBeLessThan(order.lastIndexOf('"matches"."scheduled_at"'));
      expect(order.lastIndexOf('"matches"."scheduled_at"')).toBeLessThan(at('"home_school"."name"'));
      expect(at('"home_school"."name"')).toBeLessThan(order.lastIndexOf('"matches"."id"'));
      expect(order.match(new RegExp(` ${dir}`, 'g'))).toHaveLength(5);
      expect(order.match(new RegExp(` ${dir === 'asc' ? 'desc' : 'asc'}(,|$| )`, 'g'))).toBeNull();
    }
  });

  it('applies the same order to the season calendar query', () => {
    const { sql } = buildSeasonMatchesQuery('s').toSQL();
    expect(sql).toContain('America/New_York');
    expect(sql.indexOf("when 'Varsity' then 0")).toBeLessThan(sql.lastIndexOf('"matches"."scheduled_at"'));
  });

  it('builds a five-key lexicographic keyset: gt for asc, lt for desc, string and number params only', () => {
    const asc = buildMatchesPageQuery({ sort: 'asc', cursor }).toSQL();
    const desc = buildMatchesPageQuery({ sort: 'desc', cursor }).toSQL();
    const where = (sql: string) => sql.slice(sql.indexOf(' where '), sql.indexOf(' order by '));
    expect(where(asc.sql)).toContain(' > ');
    expect(where(asc.sql)).not.toContain(' < ');
    expect(where(desc.sql)).toContain(' < ');
    expect(where(desc.sql)).not.toContain(' > ');
    expect(where(asc.sql).match(/ > /g)).toHaveLength(5);
    // Branch k pins keys 0..k-1: the ET day is bound in all 5 branches, the id only in the last.
    expect(asc.params.filter((p) => p === '2026-11-01')).toHaveLength(5);
    expect(asc.params.filter((p) => p === cursor.id)).toHaveLength(1);
    expect(asc.params).toContain('Bronx Science');
    expect(asc.params).toContain(1); // JV rank
    // A Date inside a raw sql fragment bypasses the column encoder and 500s Load more.
    expect(asc.params.some((p) => p instanceof Date)).toBe(false);
    expect(desc.params.some((p) => p instanceof Date)).toBe(false);
  });

  it('cursorFor carries plain strings', () => {
    expect(cursor).toEqual({
      scheduledAt: '2026-11-02T00:00:00.000Z',
      home: 'Bronx Science',
      division: 'JV',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });
});

describe('keyset paging model: one block per division per date', () => {
  type Row = { scheduledAt: string; homeTeam: string; division: string; id: string };
  const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // 2 Nov 2026 is Eastern Standard Time, so a wall hour h is h + 5 in UTC.
  const at = (hour: number) => new Date(Date.UTC(2026, 10, 2, hour + 5)).toISOString();
  const rows: Row[] = [
    { scheduledAt: at(18), homeTeam: 'Zeta', division: 'JV', id: uid(1) },
    { scheduledAt: at(19), homeTeam: 'Alpha', division: 'Varsity', id: uid(2) },
    { scheduledAt: at(20), homeTeam: 'Bronx', division: 'JV', id: uid(3) },
    { scheduledAt: at(19), homeTeam: 'Bronx', division: 'Varsity', id: uid(4) },
    { scheduledAt: at(18), homeTeam: 'Cardozo', division: 'Varsity', id: uid(5) },
    { scheduledAt: at(19), homeTeam: 'Alpha', division: 'JV', id: uid(6) },
    // 11 PM ET on 2 Nov is already 3 Nov in UTC but still the 2nd on the Eastern calendar.
    { scheduledAt: at(23), homeTeam: 'Dewitt', division: 'JV', id: uid(7) },
    { scheduledAt: new Date(Date.UTC(2026, 10, 3, 5)).toISOString(), homeTeam: 'Eagle', division: 'Varsity', id: uid(8) },
    { scheduledAt: new Date(Date.UTC(2026, 10, 9, 0)).toISOString(), homeTeam: 'Alpha', division: 'JV', id: uid(9) },
  ];
  const keyOf = (r: Row) => matchOrderKey({ scheduledAt: r.scheduledAt, division: r.division, home: r.homeTeam, id: r.id });
  const cmp = (a: Row, b: Row) => {
    const [ka, kb] = [keyOf(a), keyOf(b)];
    for (let i = 0; i < 5; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  };
  const after = (r: Row, c: ReturnType<typeof cursorFor>, sort: 'asc' | 'desc') => {
    const d = cmp(r, { scheduledAt: c.scheduledAt, homeTeam: c.home, division: c.division, id: c.id });
    return sort === 'asc' ? d > 0 : d < 0;
  };
  const pageThrough = (sort: 'asc' | 'desc', size: number) => {
    const ordered = [...rows].sort((a, b) => (sort === 'asc' ? cmp(a, b) : cmp(b, a)));
    const seen: Row[] = [];
    let cur: ReturnType<typeof cursorFor> | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const page = ordered.filter((r) => !cur || after(r, cur, sort)).slice(0, size);
      if (!page.length) break;
      seen.push(...page);
      cur = cursorFor(page[page.length - 1]);
    }
    return { ordered, seen };
  };

  for (const sort of ['asc', 'desc'] as const) {
    for (const size of [1, 2, 3, 4, 100]) {
      it(`${sort}, page size ${size}: no skipped or repeated rows`, () => {
        const { ordered, seen } = pageThrough(sort, size);
        expect(seen.map((r) => r.id)).toEqual(ordered.map((r) => r.id));
        expect(new Set(seen.map((r) => r.id)).size).toBe(rows.length);
      });
    }

    it(`${sort}: every date is one contiguous block per division, with mixed kickoff times`, () => {
      const { seen } = pageThrough(sort, 3);
      const days = groupMatchesByDay(seen);
      expect(days.map((d) => d.items.length)).toEqual(sort === 'asc' ? [7, 1, 1] : [1, 1, 7]);
      for (const day of days) {
        const runs = day.items.filter((m, i) => i === 0 || m.division !== day.items[i - 1].division);
        // JV 6 PM, Varsity 7 PM, JV 8 PM never comes out JV, Varsity, JV.
        expect(runs.length).toBe(new Set(day.items.map((m) => m.division)).size);
      }
      const nov2 = days.find((d) => d.key === '2026-11-02')!;
      expect(nov2.items.map((m) => m.division)).toEqual(
        sort === 'asc'
          ? ['Varsity', 'Varsity', 'Varsity', 'JV', 'JV', 'JV', 'JV']
          : ['JV', 'JV', 'JV', 'JV', 'Varsity', 'Varsity', 'Varsity']
      );
    });
  }

  it('within a division block rows run by kickoff, then home school, then id', () => {
    const { ordered } = pageThrough('asc', 100);
    expect(ordered.slice(0, 3).map((r) => r.homeTeam)).toEqual(['Cardozo', 'Alpha', 'Bronx']);
    expect(ordered.slice(3, 7).map((r) => r.homeTeam)).toEqual(['Zeta', 'Alpha', 'Bronx', 'Dewitt']);
  });

  it('labels each division block only when a date holds more than one division', () => {
    const { ordered } = pageThrough('asc', 100);
    const [d1, d2, d3] = groupMatchesByDay(ordered);
    expect([...divisionBlockStarts(d1.items).values()]).toEqual([
      { division: 'Varsity', count: 3 },
      { division: 'JV', count: 4 },
    ]);
    expect(divisionBlockStarts(d2.items).size).toBe(0);
    expect(divisionBlockStarts(d3.items).size).toBe(0);
  });
});
