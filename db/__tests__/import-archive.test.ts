import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  slugify,
  divisionLabel,
  parseScheduledAt,
  formatRole,
  displayName,
  buildImportPlan,
} from '../import-archive';

describe('parseCSV', () => {
  it('parses quoted fields with embedded commas and escaped quotes', () => {
    const rows = parseCSV('a,b,c\n1,"two, with comma","say ""hi"""\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, with comma', 'say "hi"'],
    ]);
  });

  it('handles a trailing row without a newline', () => {
    expect(parseCSV('x,y\n1,2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('divisionLabel', () => {
  it('maps competitive divisions to league labels', () => {
    expect(divisionLabel('A')).toBe('Varsity');
    expect(divisionLabel('B')).toBe('JV');
    expect(divisionLabel('a')).toBe('Varsity');
  });
});

describe('parseScheduledAt', () => {
  it('combines date with a PM time', () => {
    expect(parseScheduledAt('11/18/2022', '7:30PM').toISOString()).toBe('2022-11-18T19:30:00.000Z');
  });
  it('handles a space before the meridiem', () => {
    expect(parseScheduledAt('10/27/2023', '9:00 PM').toISOString()).toBe('2023-10-27T21:00:00.000Z');
  });
  it('defaults to 7:00 PM when the time is missing', () => {
    expect(parseScheduledAt('3/8/2026', '').toISOString()).toBe('2026-03-08T19:00:00.000Z');
  });
});

describe('formatRole', () => {
  it('drops the department for executive/advisor rows', () => {
    expect(formatRole('Executive', 'President')).toBe('President');
    expect(formatRole('Advisor', 'Advisor')).toBe('Advisor');
    expect(formatRole('', 'Special Thanks')).toBe('Special Thanks');
  });
  it('prefixes the department for divisional roles', () => {
    expect(formatRole('VALORANT', 'Director')).toBe('VALORANT Director');
    expect(formatRole('Broadcasting', 'Associate')).toBe('Broadcasting Associate');
  });
});

describe('displayName', () => {
  it('appends a distinct preferred name', () => {
    expect(displayName('Kishi Wijaya', 'DolphyVix')).toBe('Kishi Wijaya (DolphyVix)');
    expect(displayName('Edison Zhong', '')).toBe('Edison Zhong');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Bronx HS of Science')).toBe('bronx-hs-of-science');
    expect(slugify('Leon M. Goldstein HS')).toBe('leon-m-goldstein-hs');
  });
});

describe('buildImportPlan', () => {
  const matches = [
    {
      match_id: 'm1',
      season_id: '2022-23',
      division: 'A',
      match_date: '11/18/2022',
      match_time: '7:30PM',
      school_1: 'Stuyvesant HS',
      school_2: 'Bronx HS of Science',
    },
    {
      match_id: 'm2',
      season_id: '2022-23',
      division: 'B',
      match_date: '11/19/2022',
      match_time: '',
      school_1: 'Stuyvesant HS',
      school_2: 'Bronx HS of Science',
    },
  ];
  const staff = [
    { person_id: 'p1', season_id: '2022-23', name: 'Jane Doe', preferred_name: '', division: 'VALORANT', role: 'Director', fun_fact: 'likes cats', notes: '' },
  ];

  it('derives unique schools, seasons, teams and rosters with no dangling match refs', () => {
    const plan = buildImportPlan(matches as never, staff as never);
    expect(plan.schoolNames).toEqual(['Bronx HS of Science', 'Stuyvesant HS']);
    expect(plan.seasonNames).toEqual(['2022-23']);
    expect(plan.teamKeys.sort()).toEqual(['2022-23|Bronx HS of Science', '2022-23|Stuyvesant HS']);
    expect(plan.rosterKeys.length).toBe(4); // 2 schools x 2 divisions

    const rosterSet = new Set(plan.rosterKeys);
    for (const m of plan.matches) {
      expect(rosterSet.has(m.homeRosterKey)).toBe(true);
      expect(rosterSet.has(m.awayRosterKey)).toBe(true);
    }
  });

  it('maps staff into leadership with start-year and composed role', () => {
    const plan = buildImportPlan(matches as never, staff as never);
    expect(plan.leadership).toEqual([
      { name: 'Jane Doe', role: 'VALORANT Director', year: '2022', bio: 'likes cats' },
    ]);
  });
});
