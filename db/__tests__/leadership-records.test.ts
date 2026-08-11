/**
 * Composing gold_leadership.csv rows into the (name, role, year) identity the
 * importer merges on.
 *
 * These are pinned against the real strings in the surviving 99 production rows.
 * If this composition drifts, the merge stops recognising people who are already
 * in the table and inserts a second copy of each of them — which is the failure
 * mode that matters here, because the whole point of the import is to add the
 * ~70 who are missing without disturbing the ones who are not.
 */
import { describe, it, expect } from 'vitest';
import { toLeadershipRecords } from '../import-archive';

const row = (over: Record<string, string> = {}) => ({
  first_name: 'Austin',
  last_name: 'Pierron',
  preferred_name: 'Red',
  division: 'Productions',
  position: 'Director',
  year: '2025',
  fun_fact: 'likes racing',
  ...over,
});

describe('toLeadershipRecords', () => {
  // Verbatim from production: "Austin Pierron (Red)" / "Productions Director".
  it('reproduces a surviving row exactly', () => {
    expect(toLeadershipRecords([row()])[0]).toEqual({
      name: 'Austin Pierron (Red)',
      role: 'Productions Director',
      year: '2025',
      bio: 'likes racing',
      highSchool: null,
      university: null,
    });
  });

  it('extracts high school and university fields', () => {
    const [r] = toLeadershipRecords([
      row({ high_school: 'Stuyvesant High School', university: 'Columbia University' }),
    ]);
    expect(r.highSchool).toBe('Stuyvesant High School');
    expect(r.university).toBe('Columbia University');
  });

  it('leaves the name alone when there is no preferred name', () => {
    // Production has "Ivan Chen" / "Finance Director" with no handle.
    const [r] = toLeadershipRecords([
      row({ first_name: 'Ivan', last_name: 'Chen', preferred_name: '', division: 'Finance' }),
    ]);
    expect(r.name).toBe('Ivan Chen');
    expect(r.role).toBe('Finance Director');
  });

  // formatRole drops these two departments rather than prefixing them, so the
  // role reads "President", not "Executive President".
  it.each(['Executive', 'Advisor'])('drops the %s department from the role', (division) => {
    expect(toLeadershipRecords([row({ division, position: 'President' })])[0].role)
      .toBe('President');
  });

  it('falls back to the department when there is no position', () => {
    expect(toLeadershipRecords([row({ division: 'Advisor', position: '' })])[0].role)
      .toBe('Advisor');
  });

  it('treats an empty fun fact as no bio rather than an empty one', () => {
    // planRecord fills a blank bio; '' would count as present and block that.
    expect(toLeadershipRecords([row({ fun_fact: '' })])[0].bio).toBeNull();
  });

  // The People tab has exactly this today: a first name and nothing else.
  it('tolerates a person with only one name part', () => {
    expect(
      toLeadershipRecords([row({ first_name: 'Simon', last_name: '', preferred_name: '' })])[0].name
    ).toBe('Simon');
  });
});
