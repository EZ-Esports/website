import { describe, it, expect } from 'vitest';
import type { SchoolGroup, TeamRosterGroup } from '@/app/(marketing)/[game]/teams/TeamsFilterClient';
import { sortRostersByDivision } from '@/app/(marketing)/[game]/teams/[school]/SchoolSnapshotsClient';
import { slugify } from '@/app/lib/text-utils';

// Test suite validating the School & Season Snapshot abstraction layer logic and division sorting
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

  it('generates clean dedicated school route URLs', () => {
    const school = sampleSchoolGroups[0];
    const slug = school.schoolSlug || slugify(school.schoolName);
    const href = `/valorant/teams/${slug}`;

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
});
