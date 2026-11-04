import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/actions', () => ({
  createPlayer: vi.fn(), createRoster: vi.fn(), createTeam: vi.fn(),
  deleteRoster: vi.fn(), deleteRosterMember: vi.fn(), updatePlayer: vi.fn(), updateRoster: vi.fn(),
}));

import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { buildSeasonBlocks } from '@/app/lib/school-roster-view';

const blocks = buildSeasonBlocks([{
  teamId: 't1', gameId: 'g1', gameSlug: 'valorant', gameName: 'Valorant', seasonId: 's1', seasonName: '2026-27',
  seasonIsActive: true, rostersLockedAt: null,
  rosters: [{ id: 'r1', name: 'Varsity', division: 'A', players: [
    { id: 'p1', memberId: 'm1', firstName: 'Ada', lastName: 'Lovelace', name: 'Ada Lovelace', ign: 'ada#1', discord: 'ada', graduationYear: 2027, schoolEmail: 'ada@nycstudents.net', hasStudentId: true, role: 'captain' },
  ] }],
}]);
const props = { schoolId: 'sc1', schoolName: 'Stuyvesant', blocks, options: { members: [], games: [], seasons: [] }, initialFilters: { game: '', division: 'both' as const, phone: 'Varsity' as const } };

describe('SchoolRostersView season scope', () => {
  const html = renderToStaticMarkup(<SchoolRostersView {...props} scope="season" />);

  it('shows the roster and every player field Schools & Rosters shows', () => {
    for (const text of ['Varsity', '1/10 player', 'ada#1', 'Captain', 'Ada Lovelace', 'Discord: ada', 'Class of 2027', 'School email: ada@nycstudents.net', 'View student ID']) {
      expect(html).toContain(text);
    }
  });

  it('has no game filter, season header, register-team panel or edit controls', () => {
    expect(html).not.toContain('roster-game-filter');
    expect(html).not.toContain('All games');
    expect(html).not.toContain('Register team');
    expect(html).not.toContain('aria-expanded');
    expect(html).not.toMatch(/Edit roster|Delete roster|Add player/);
  });

  it('the default scope still has them', () => {
    const full = renderToStaticMarkup(<SchoolRostersView {...props} />);
    expect(full).toContain('roster-game-filter');
    expect(full).toMatch(/Edit roster/);
  });
});
