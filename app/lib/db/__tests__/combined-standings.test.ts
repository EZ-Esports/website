import { describe, expect, it } from 'vitest';
import {
  COMBINED_DIVISION,
  DERIVED_STANDINGS_NOTE,
  canonicalDivision,
  isDerivedStandings,
  rankComputedStandings,
  seasonDivisionList,
  standingsTeamLabel,
} from '@/app/lib/db/match-page';
import { buildFormGuide, type FormEntry } from '@/app/lib/game-hub-form';

/**
 * The combined-standings behaviour end to end through the pure layer, on the
 * shape of the season that forced it.
 *
 * 2023-24 League of Legends was ONE ten-team competition. Three schools —
 * Brooklyn Technical, Midwood and Bronx Science — entered two squads each,
 * labelled A/B upstream and surfaced as Varsity/JV, and all ten entries played a
 * complete single round-robin (nine distinct opponents each). 23 of its 48
 * fixtures pair an A-labelled entry against a B-labelled one and 3 are a school
 * against its own other squad, so the label names *which squad a school entered*,
 * not which bracket it is ranked in.
 *
 * Grouping that by division fabricated a 7-team "Varsity" table and a 3-team
 * "JV" table in which most games counted were played against teams in the other
 * one: Bronx Science JV was shown 1-8 with 7 of its 9 games against
 * Varsity-labelled opponents. No database is involved here — the records below
 * are illustrative, only the *shape* is real — because everything that decides
 * how such a table is grouped, ranked and labelled lives in `match-page.ts`.
 */
const TWO_SQUAD_SCHOOLS = ['Brooklyn Technical High School', 'Midwood High School', 'Bronx Science'];

const ENTRY = (schoolName: string, division: string, wins: number, losses: number) => ({
  schoolName,
  division,
  wins,
  losses,
});

/** Ten team-entries, three schools appearing twice — the real field size. */
const COMBINED_FIELD = [
  ENTRY('Brooklyn Technical High School', 'Varsity', 8, 1),
  ENTRY('Brooklyn Technical High School', 'JV', 3, 6),
  ENTRY('Midwood High School', 'Varsity', 7, 2),
  ENTRY('Midwood High School', 'JV', 4, 5),
  ENTRY('Bronx Science', 'Varsity', 6, 3),
  ENTRY('Bronx Science', 'JV', 1, 8),
  ENTRY('Stuyvesant High School', 'Varsity', 5, 4),
  ENTRY('Francis Lewis High School', 'Varsity', 4, 5),
  ENTRY('Forest Hills High School', 'Varsity', 2, 7),
  ENTRY('Townsend Harris High School', 'Varsity', 0, 9),
];

describe('a combined season is one table', () => {
  it('ranks all ten entries together, 1..10, with no rank shared', () => {
    // The bug produced two tables of 7 and 3, each with its own rank 1.
    const ranked = rankComputedStandings(COMBINED_FIELD);
    expect(ranked).toHaveLength(10);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('offers one tab, not a Varsity/JV switch', () => {
    const stored = COMBINED_FIELD.map((r) => r.division);
    expect(seasonDivisionList('combined', stored)).toEqual([COMBINED_DIVISION]);
    // The same rows in a genuinely divided season still get both tabs.
    expect(seasonDivisionList('divided', stored)).toEqual(['Varsity', 'JV']);
  });

  it('lists a two-squad school twice, distinguishably', () => {
    const labels = rankComputedStandings(COMBINED_FIELD).map((r) =>
      standingsTeamLabel(r, 'combined')
    );
    // Every row is a distinct line of the table — the failure this fixes is a
    // reader seeing "Brooklyn Technical High School" at rank 2 and rank 7 with
    // nothing to tell them apart.
    expect(new Set(labels).size).toBe(labels.length);
    for (const school of TWO_SQUAD_SCHOOLS) {
      expect(labels.filter((label) => label.startsWith(school))).toEqual([
        `${school} — Varsity`,
        `${school} — JV`,
      ]);
    }
  });

  it('names the squad on a single-squad school too, not only the doubled ones', () => {
    // Schools that entered once still carry their squad: the suffix is the
    // column's meaning, not a disambiguator applied only where it is needed, and
    // a table where three rows carry it and seven don't reads as three
    // footnotes.
    const labels = rankComputedStandings(COMBINED_FIELD).map((r) =>
      standingsTeamLabel(r, 'combined')
    );
    expect(labels).toContain('Townsend Harris High School — Varsity');
  });

  it('keeps each row on its own squad rather than the requested division', () => {
    // The divided path deliberately overwrites `division` with the division the
    // caller asked for. Doing that here would leave Brooklyn Technical listed
    // twice, identically, at two different ranks.
    const ranked = rankComputedStandings(COMBINED_FIELD);
    expect(ranked.filter((r) => canonicalDivision(r.division) === 'JV')).toHaveLength(3);
    expect(ranked.filter((r) => canonicalDivision(r.division) === 'Varsity')).toHaveLength(7);
  });
});

describe('the derived-standings marker', () => {
  it('recognises the table the pipeline reconstructed', () => {
    const rows = COMBINED_FIELD.map(() => ({ notes: DERIVED_STANDINGS_NOTE }));
    expect(isDerivedStandings(rows)).toBe(true);
  });

  it('does not caption an imported archive table as reconstructed', () => {
    expect(isDerivedStandings(COMBINED_FIELD.map(() => ({ notes: null })))).toBe(false);
  });
});

/**
 * The trap the hub's raw-name/label split exists to avoid.
 *
 * `buildFormGuideQuery` matches the school strings it is handed against
 * `schools.name` in SQL, and `buildFormGuide` keys its result map by the same
 * string. A squad-suffixed name is not a school name, so passing labels through
 * either side matches nothing — and drops every form chip on the page with no
 * error to show for it.
 */
describe('form guides are keyed by the raw school name', () => {
  const school = 'Brooklyn Technical High School';
  const played: FormEntry[] = [
    { id: 'm1', school, scored: 2, conceded: 0, scheduledAt: '2024-01-08T22:00:00Z' },
    { id: 'm2', school, scored: 0, conceded: 2, scheduledAt: '2024-01-15T22:00:00Z' },
  ];

  it('resolves the raw name and misses the display label', () => {
    const guides = buildFormGuide(played);
    expect(guides.get(school)).toEqual(['W', 'L']);
    expect(guides.get(standingsTeamLabel({ schoolName: school, division: 'JV' }, 'combined'))).toBeUndefined();
  });

  it('so the label must never be the key the hub looks up', () => {
    // Mirrors `getGameHubData`: `team` is the key, `teamLabel` is printed.
    const shownTeams = rankComputedStandings(COMBINED_FIELD)
      .slice(0, 5)
      .map((r) => ({ team: r.schoolName, teamLabel: standingsTeamLabel(r, 'combined') }));
    const guides = buildFormGuide(played);
    for (const entry of shownTeams) {
      expect(entry.team).not.toContain('—');
    }
    // The one shown school with matches on record gets its chips; keying by the
    // label instead would return nothing for it.
    const tech = shownTeams.find((entry) => entry.team === school);
    expect(guides.get(tech!.team)).toEqual(['W', 'L']);
    expect(guides.get(tech!.teamLabel)).toBeUndefined();
  });
});
