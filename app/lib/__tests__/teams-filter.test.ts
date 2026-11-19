import { describe, it, expect } from 'vitest';
import {
  sortSchoolsAlphabetically,
  sortSchools,
  filterSchoolsBySeason,
  filterSchoolsByDivision,
  filterSchoolsByQuery,
  getAvailableSeasons,
  getDefaultSeason,
  getSchoolDivisionBadges,
  getTeamRosterUrl,
  type SchoolGroup,
  type TeamRosterGroup,
} from '@/app/(marketing)/[game]/teams/TeamsFilterClient';
import { sortRostersByDivision } from '@/app/(marketing)/[game]/teams/[school]/SchoolSnapshotsClient';
import { slugify } from '@/app/lib/text-utils';

describe('Teams & Rosters Dedicated School Route Architecture', () => {
  const sampleSchoolGroups: SchoolGroup[] = [
    {
      schoolId: 'school-1',
      schoolName: 'Stuyvesant High School',
      schoolSlug: 'stuyvesant-high-school',
      websiteUrl: 'https://stuy.edu',
      seasons: [
        {
          seasonId: 'season-spring-2025',
          seasonName: 'Spring 2025',
          isSeasonActive: true,
          rosters: [
            {
              id: 'roster-2',
              name: 'JV',
              division: 'B',
              record: '3-2',
              players: [
                { name: 'Charlie "Spark" Wu', role: 'Initiator', bio: 'Recon specialist' },
              ],
            },
            {
              id: 'roster-1',
              name: 'Varsity',
              division: 'A',
              record: '5-1',
              players: [
                { name: 'Alex "Ace" Chen', role: 'Captain', bio: 'Entry duelist', isCaptain: true },
                { name: 'Blake "Shadow" Lin', role: 'Controller', bio: 'Smokes main' },
              ],
            },
          ],
        },
        {
          seasonId: 'season-fall-2024',
          seasonName: 'Fall 2024',
          isSeasonActive: false,
          rosters: [
            {
              id: 'roster-3',
              name: 'Varsity',
              division: 'A',
              record: '6-0',
              players: [
                { name: 'Alex "Ace" Chen', role: 'Captain', bio: 'Entry duelist', isCaptain: true },
              ],
            },
          ],
        },
      ],
    },
    {
      schoolId: 'school-2',
      schoolName: 'Midwood High School',
      schoolSlug: 'midwood-high-school',
      seasons: [
        {
          seasonId: 'season-spring-2025',
          seasonName: 'Spring 2025',
          isSeasonActive: true,
          rosters: [
            {
              id: 'roster-4',
              name: 'Varsity',
              division: 'A',
              record: '4-2',
              players: [
                { name: 'Dana "Anchor" Kim', role: 'Sentinel', bio: 'Site hold master' },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('correctly structures schools with nested season snapshots', () => {
    expect(sampleSchoolGroups).toHaveLength(2);
    expect(sampleSchoolGroups[0].schoolName).toBe('Stuyvesant High School');
    expect(sampleSchoolGroups[0].seasons).toHaveLength(2);
    expect(sampleSchoolGroups[0].seasons[0].seasonName).toBe('Spring 2025');
    expect(sampleSchoolGroups[0].seasons[1].seasonName).toBe('Fall 2024');
  });

  it('sorts Varsity rosters on top (1st) and Junior Varsity/JV on bottom (last)', () => {
    const unsortedRosters = [
      { name: 'Junior Varsity' },
      { name: 'Varsity' },
      { name: 'JV' },
    ];
    const sorted = sortRostersByDivision(unsortedRosters);

    expect(sorted[0].name).toBe('Varsity');
    expect(sorted[sorted.length - 1].name).toBe('JV');
  });

  it('generates clean dedicated school route URLs using getTeamRosterUrl and slugify', () => {
    const school = sampleSchoolGroups[0];
    const slug = school.schoolSlug || slugify(school.schoolName);
    const href = getTeamRosterUrl('valorant', school);

    expect(slug).toBe('stuyvesant-high-school');
    expect(href).toBe('/valorant/teams/stuyvesant-high-school');
  });

  it('identifies the active season as default season filter state', () => {
    const activeSeason = sampleSchoolGroups[0].seasons.find((s) => s.isSeasonActive);
    expect(activeSeason?.seasonName).toBe('Spring 2025');
  });

  it('hides individual students behind the school top-level container on the main view', () => {
    const school = sampleSchoolGroups[0];
    expect(school.schoolName).toBeDefined();
    expect(school.seasons).toBeDefined();
    expect(school.seasons[0].rosters[0].players).toHaveLength(1);
  });

  it('normalizes legacy teamGroups into school groups with season snapshots for PR 68 compatibility', () => {
    const legacyTeamGroups: TeamRosterGroup[] = [
      {
        teamName: 'Bronx Science',
        rosters: [
          {
            id: 'legacy-r1',
            name: 'Varsity',
            division: 'A',
            record: '2-2',
            players: [{ name: 'Evan "Nova" Zhang', role: 'Flex', bio: 'Flex main' }],
          },
        ],
      },
    ];

    const normalized: SchoolGroup[] = legacyTeamGroups.map((g, idx) => ({
      schoolId: `legacy-${idx}`,
      schoolName: g.teamName,
      schoolSlug: slugify(g.teamName),
      seasons: [
        {
          seasonId: 'current-season',
          seasonName: 'Current Season',
          isSeasonActive: true,
          rosters: g.rosters,
        },
      ],
    }));

    expect(normalized).toHaveLength(1);
    expect(normalized[0].schoolName).toBe('Bronx Science');
    expect(normalized[0].schoolSlug).toBe('bronx-science');
    expect(normalized[0].seasons[0].seasonName).toBe('Current Season');
    expect(normalized[0].seasons[0].rosters[0].players[0].name).toBe('Evan "Nova" Zhang');
  });

  describe('Alphabetical Ordering & Division Indication (Varsity, JV, Both)', () => {
    const schoolBoth: SchoolGroup = sampleSchoolGroups[0]; // Stuyvesant: has JV and Varsity
    const schoolVarsity: SchoolGroup = sampleSchoolGroups[1]; // Midwood: has Varsity only

    const schoolJv: SchoolGroup = {
      schoolId: 'school-3',
      schoolName: 'Brooklyn Technical High School',
      schoolSlug: 'brooklyn-technical-high-school',
      seasons: [
        {
          seasonId: 'season-spring-2025',
          seasonName: 'Spring 2025',
          isSeasonActive: true,
          rosters: [
            {
              id: 'roster-jv',
              name: 'Junior Varsity',
              division: 'B',
              record: '4-1',
              players: [],
            },
          ],
        },
      ],
    };

    const schoolBronx: SchoolGroup = {
      schoolId: 'school-4',
      schoolName: 'Bronx Science',
      schoolSlug: 'bronx-science',
      seasons: [],
    };

    const schoolTournament: SchoolGroup = {
      schoolId: 'school-5',
      schoolName: 'Townsend Harris High School',
      schoolSlug: 'townsend-harris-high-school',
      seasons: [
        {
          seasonId: 'season-spring-2025',
          seasonName: 'Spring 2025',
          isSeasonActive: true,
          rosters: [
            {
              id: 'roster-open',
              name: 'Entrants',
              division: 'All',
              record: '0-0',
              players: [],
            },
          ],
        },
      ],
    };

    it('sorts schools alphabetically by school name (A–Z)', () => {
      const unsorted = [schoolBoth, schoolVarsity, schoolJv, schoolBronx];
      const sorted = sortSchoolsAlphabetically(unsorted);

      expect(sorted.map((s) => s.schoolName)).toEqual([
        'Bronx Science',
        'Brooklyn Technical High School',
        'Midwood High School',
        'Stuyvesant High School',
      ]);
    });

    it('correctly provides both tags ["Varsity", "Junior Varsity"] without a "Both" tag when a school fields both', () => {
      const badges = getSchoolDivisionBadges(schoolBoth);
      expect(badges).toEqual(['Varsity', 'Junior Varsity']);
      expect(badges).not.toContain('Both');
    });

    it('correctly provides one tag ["Varsity"] when a school fields only Varsity rosters', () => {
      const badges = getSchoolDivisionBadges(schoolVarsity);
      expect(badges).toEqual(['Varsity']);
    });

    it('correctly provides one tag ["Junior Varsity"] when a school fields only JV/Junior Varsity rosters', () => {
      const badges = getSchoolDivisionBadges(schoolJv);
      expect(badges).toEqual(['Junior Varsity']);
    });

    it('labels tournament or undivided model rosters appropriately', () => {
      expect(getSchoolDivisionBadges(schoolTournament)).toEqual(['Open']);
    });

    it('labels schools with no rosters as ["Registered"]', () => {
      expect(getSchoolDivisionBadges(schoolBronx)).toEqual(['Registered']);
    });

    it('uses divisionBadges directly when provided by the page component', () => {
      const schoolWithBadges: SchoolGroup = {
        schoolId: 'school-custom',
        schoolName: 'Custom High School',
        seasons: [],
        divisionBadges: ['Varsity'],
      };
      expect(getSchoolDivisionBadges(schoolWithBadges)).toEqual(['Varsity']);
    });

    it('ignores empty placeholder rosters when valid rosters with players exist', () => {
      const schoolWithEmptyJvPlaceholder: SchoolGroup = {
        schoolId: 'school-placeholder',
        schoolName: 'Edward R. Murrow High School',
        seasons: [
          {
            seasonId: 'season-current',
            seasonName: '2023-24',
            isSeasonActive: true,
            rosters: [
              {
                id: 'r-varsity',
                name: 'Varsity',
                division: 'Varsity',
                record: 'Unpublished',
                players: [{ name: 'Player 1', role: 'Player', bio: 'Bio' }],
              },
              {
                id: 'r-jv',
                name: 'JV',
                division: 'B',
                record: 'Unpublished',
                players: [],
              },
            ],
          },
        ],
      };
      expect(getSchoolDivisionBadges(schoolWithEmptyJvPlaceholder)).toEqual(['Varsity']);
    });

    it('keeps unplayed rosters with registered players even when another roster has published standings', () => {
      const schoolWithUnplayedJvWithPlayers: SchoolGroup = {
        schoolId: 'school-active-both',
        schoolName: 'Bayside High School',
        seasons: [
          {
            seasonId: 'season-current',
            seasonName: '2026-27',
            isSeasonActive: true,
            rosters: [
              {
                id: 'r-varsity',
                name: 'Varsity',
                division: 'A',
                record: '3-0',
                players: [{ name: 'Player 1', role: 'Player', bio: 'Bio' }],
              },
              {
                id: 'r-jv',
                name: 'JV',
                division: 'B',
                record: 'Unpublished',
                players: [{ name: 'Player 2', role: 'Player', bio: 'Bio' }],
              },
            ],
          },
        ],
      };
      expect(getSchoolDivisionBadges(schoolWithUnplayedJvWithPlayers)).toEqual(['Varsity', 'Junior Varsity']);
    });

    it('generates the correct roster URL for each school', () => {
      expect(getTeamRosterUrl('valorant', schoolBoth)).toBe('/valorant/teams/stuyvesant-high-school');
      expect(getTeamRosterUrl('rocket-league', schoolBronx)).toBe('/rocket-league/teams/bronx-science');
    });

    describe('Search Query Filtering', () => {
      const list = [schoolBoth, schoolVarsity, schoolJv, schoolBronx];

      it('returns all schools when query is empty or whitespace', () => {
        expect(filterSchoolsByQuery(list, '')).toEqual(list);
        expect(filterSchoolsByQuery(list, '   ')).toEqual(list);
      });

      it('filters schools by partial school name (case-insensitive)', () => {
        const results = filterSchoolsByQuery(list, 'tech');
        expect(results.map((s) => s.schoolName)).toEqual(['Brooklyn Technical High School']);

        const resultsStuy = filterSchoolsByQuery(list, 'STUY');
        expect(resultsStuy.map((s) => s.schoolName)).toEqual(['Stuyvesant High School']);
      });

      it('filters schools by division name ("varsity")', () => {
        const results = filterSchoolsByQuery(list, 'varsity');
        // schoolBoth (Varsity & JV), schoolVarsity (Varsity) have Varsity badges
        expect(results.map((s) => s.schoolName)).toEqual([
          'Stuyvesant High School',
          'Midwood High School',
        ]);
      });

      it('filters schools by "jv" keyword alias to Junior Varsity', () => {
        const results = filterSchoolsByQuery(list, 'jv');
        // schoolBoth and schoolJv have Junior Varsity
        expect(results.map((s) => s.schoolName)).toEqual([
          'Stuyvesant High School',
          'Brooklyn Technical High School',
        ]);
      });

      it('returns empty array when query matches nothing', () => {
        expect(filterSchoolsByQuery(list, 'nonexistent high school xyz')).toEqual([]);
      });
    });

    describe('Season Filtering (filterSchoolsBySeason)', () => {
      const list = [schoolBoth, schoolVarsity, schoolJv, schoolBronx];

      it('defaults to returning all schools when season filter is "all" or empty', () => {
        expect(filterSchoolsBySeason(list, 'all')).toEqual(list);
        expect(filterSchoolsBySeason(list, '')).toEqual(list);
        expect(filterSchoolsBySeason(list, '   ')).toEqual(list);
      });

      it('filters schools by specific season name', () => {
        // schoolBoth, schoolVarsity, schoolJv have 'Spring 2025'
        const spring = filterSchoolsBySeason(list, 'Spring 2025');
        expect(spring.map((s) => s.schoolName)).toEqual([
          'Stuyvesant High School',
          'Midwood High School',
          'Brooklyn Technical High School',
        ]);

        // only schoolBoth has 'Fall 2024'
        const fall = filterSchoolsBySeason(list, 'Fall 2024');
        expect(fall.map((s) => s.schoolName)).toEqual(['Stuyvesant High School']);
      });

      it('returns empty array when season matches no schools', () => {
        expect(filterSchoolsBySeason(list, 'Winter 2099')).toEqual([]);
      });
    });

    describe('Season & Alphabetical Sorting (sortSchools)', () => {
      const schoolOldSeason: SchoolGroup = {
        schoolId: 'school-old',
        schoolName: 'Abraham Lincoln High School',
        seasons: [
          {
            seasonId: 's-2023',
            seasonName: '2023-24',
            isSeasonActive: false,
            rosters: [],
          },
        ],
      };

      const schoolActiveSeason: SchoolGroup = {
        schoolId: 'school-active',
        schoolName: 'Zebra High School',
        seasons: [
          {
            seasonId: 's-2026',
            seasonName: '2026-27',
            isSeasonActive: true,
            rosters: [],
          },
        ],
      };

      it('sorts schools alphabetically A–Z by default (name-asc)', () => {
        const sorted = sortSchools([schoolActiveSeason, schoolOldSeason, schoolBoth], 'name-asc');
        expect(sorted.map((s) => s.schoolName)).toEqual([
          'Abraham Lincoln High School',
          'Stuyvesant High School',
          'Zebra High School',
        ]);
      });

      it('sorts schools reverse alphabetically Z–A (name-desc)', () => {
        const sorted = sortSchools([schoolActiveSeason, schoolOldSeason, schoolBoth], 'name-desc');
        expect(sorted.map((s) => s.schoolName)).toEqual([
          'Zebra High School',
          'Stuyvesant High School',
          'Abraham Lincoln High School',
        ]);
      });

      it('sorts schools by season (season-desc) prioritizing active seasons first', () => {
        const sorted = sortSchools([schoolOldSeason, schoolActiveSeason], 'season-desc');
        expect(sorted.map((s) => s.schoolName)).toEqual([
          'Zebra High School',
          'Abraham Lincoln High School',
        ]);
      });
    });

    describe('Available Seasons Extraction (getAvailableSeasons)', () => {
      it('extracts unique seasons and sorts active seasons first', () => {
        const seasons = getAvailableSeasons([schoolBoth, schoolVarsity, schoolJv, schoolBronx]);
        expect(seasons).toEqual([
          { seasonName: 'Spring 2025', isSeasonActive: true },
          { seasonName: 'Fall 2024', isSeasonActive: false },
        ]);
      });
    });

    describe('Default Season Selection (getDefaultSeason)', () => {
      it('defaults to current season 2026-27 when active', () => {
        const seasons = [
          { seasonName: '2026-27', isSeasonActive: true },
          { seasonName: '2025-26', isSeasonActive: false },
        ];
        expect(getDefaultSeason(seasons)).toBe('2026-27');
      });

      it('defaults to 2026-27 even if another active flag is not present', () => {
        const seasons = [
          { seasonName: '2026-27', isSeasonActive: false },
          { seasonName: '2024-25', isSeasonActive: false },
        ];
        expect(getDefaultSeason(seasons)).toBe('2026-27');
      });

      it('defaults to any active season when 2026-27 is absent', () => {
        const seasons = [
          { seasonName: 'Spring 2025', isSeasonActive: true },
          { seasonName: 'Fall 2024', isSeasonActive: false },
        ];
        expect(getDefaultSeason(seasons)).toBe('Spring 2025');
      });

      it('returns all when no seasons are available', () => {
        expect(getDefaultSeason([])).toBe('all');
      });
    });

    describe('Division Filtering (filterSchoolsByDivision)', () => {
      // schoolBoth has ['Varsity', 'Junior Varsity']
      // schoolVarsity has ['Varsity']
      // schoolJv has ['Junior Varsity']
      // schoolBronx has ['Registered']
      const list = [schoolBoth, schoolVarsity, schoolJv, schoolBronx];

      it('defaults to showing all schools (both Varsity and JV) when division is "all"', () => {
        expect(filterSchoolsByDivision(list, 'all')).toEqual(list);
        expect(filterSchoolsByDivision(list, '')).toEqual(list);
      });

      it('filters to schools that field Varsity rosters (including schools with both)', () => {
        const varsity = filterSchoolsByDivision(list, 'varsity');
        expect(varsity.map((s) => s.schoolName)).toEqual([
          'Stuyvesant High School',
          'Midwood High School',
        ]);
      });

      it('filters to schools that field Junior Varsity rosters (including schools with both)', () => {
        const jv = filterSchoolsByDivision(list, 'jv');
        expect(jv.map((s) => s.schoolName)).toEqual([
          'Stuyvesant High School',
          'Brooklyn Technical High School',
        ]);
      });
    });
  });
});
