import { describe, it, expect } from 'vitest';
import { parseEastern, formatNY } from '../dates';
import { toScheduleCalendarItem } from '../db/match-page';

const mapMatchToScheduleItem = toScheduleCalendarItem;

describe('schedule match status and result mapping', () => {
  it('treats 0-0 forfeits as Completed, never Upcoming, and marks outcome as Draw (D 0-0)', () => {
    const match = {
      id: 'm-forfeit-0',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'forfeit' as const,
      homeScore: 0,
      awayScore: 0,
    };

    const item = mapMatchToScheduleItem(match);
    expect(item.status).toBe('Completed');
    expect(item.forfeit).toBe(true);
    expect(item.result).toBe('D 0-0');
  });

  it('treats forfeits with non-equal scores as Completed with correct winner outcome', () => {
    const match = {
      id: 'm-forfeit-1',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'forfeit' as const,
      homeScore: 1,
      awayScore: 0,
    };

    const item = mapMatchToScheduleItem(match);
    expect(item.status).toBe('Completed');
    expect(item.forfeit).toBe(true);
    expect(item.result).toBe('W 1-0');
  });

  it('maps draws (equal scores) to D, never L', () => {
    const match = {
      id: 'm-draw-1',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'completed' as const,
      homeScore: 1,
      awayScore: 1,
    };

    const item = mapMatchToScheduleItem(match);
    expect(item.status).toBe('Completed');
    expect(item.forfeit).toBe(false);
    expect(item.result).toBe('D 1-1');
  });

  it('maps wins and losses correctly for completed matches', () => {
    const winMatch = {
      id: 'm-win',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'completed' as const,
      homeScore: 2,
      awayScore: 1,
    };
    expect(mapMatchToScheduleItem(winMatch).result).toBe('W 2-1');

    const lossMatch = {
      id: 'm-loss',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'completed' as const,
      homeScore: 0,
      awayScore: 3,
    };
    expect(mapMatchToScheduleItem(lossMatch).result).toBe('L 0-3');
  });

  it('treats scheduled matches as Upcoming with undefined result', () => {
    const scheduledMatch = {
      id: 'm-sched',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'scheduled' as const,
      homeScore: null,
      awayScore: null,
    };

    const item = mapMatchToScheduleItem(scheduledMatch);
    expect(item.status).toBe('Upcoming');
    expect(item.forfeit).toBe(false);
    expect(item.result).toBeUndefined();
  });

  it('treats live matches as Live with undefined result until completed', () => {
    const liveMatch = {
      id: 'm-live',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'live' as const,
      homeScore: 1,
      awayScore: 0,
    };

    const item = mapMatchToScheduleItem(liveMatch);
    expect(item.status).toBe('Live');
    expect(item.forfeit).toBe(false);
    expect(item.result).toBeUndefined();
  });

  it('handles completed matches with unrecorded scores safely', () => {
    const unrecordedMatch = {
      id: 'm-completed-null-score',
      scheduledAt: parseEastern('2026-09-18T19:00'),
      homeTeam: 'Team Alpha',
      awayTeam: 'Team Beta',
      division: 'Varsity',
      status: 'completed' as const,
      homeScore: null,
      awayScore: null,
    };

    const item = mapMatchToScheduleItem(unrecordedMatch);
    expect(item.status).toBe('Completed');
    expect(item.forfeit).toBe(false);
    expect(item.result).toBeUndefined();
  });
});

describe('calendar timezone and date alignment', () => {
  it('anchors calendar cell date keys to America/New_York', () => {
    // 8:00 PM ET on Sept 30, 2026 is midnight 00:00 UTC on Oct 1, 2026
    const eveningMatchDate = parseEastern('2026-09-30T20:00');
    expect(formatNY(eveningMatchDate, 'ymd')).toBe('2026-09-30');

    // 1:00 AM ET on Oct 1, 2026 is 10:00 PM PT on Sept 30, 2026
    const earlyMorningMatchDate = parseEastern('2026-10-01T01:00');
    expect(formatNY(earlyMorningMatchDate, 'ymd')).toBe('2026-10-01');
  });

  it('calculates calendar month grid days cleanly without local timezone shifts', () => {
    // Test February in a leap year (2024) vs non-leap year (2025)
    const feb2024Days = new Date(Date.UTC(2024, 2, 0)).getUTCDate();
    expect(feb2024Days).toBe(29);

    const feb2025Days = new Date(Date.UTC(2025, 2, 0)).getUTCDate();
    expect(feb2025Days).toBe(28);

    // September has 30 days
    const sept2026Days = new Date(Date.UTC(2026, 9, 0)).getUTCDate();
    expect(sept2026Days).toBe(30);

    // September 1, 2026 falls on a Tuesday (day of week index 2)
    const sept1stDow = new Date(Date.UTC(2026, 8, 1)).getUTCDay();
    expect(sept1stDow).toBe(2); // 0=Sun, 1=Mon, 2=Tue
  });

  it('initial calendar focus does not treat forfeits as upcoming matches', () => {
    const matches = [
      mapMatchToScheduleItem({
        id: 'm1-forfeit',
        scheduledAt: parseEastern('2026-09-10T19:00'),
        homeTeam: 'A',
        awayTeam: 'B',
        division: 'Varsity',
        status: 'forfeit',
        homeScore: 0,
        awayScore: 0,
      }),
      mapMatchToScheduleItem({
        id: 'm2-scheduled',
        scheduledAt: parseEastern('2026-10-05T19:00'),
        homeTeam: 'A',
        awayTeam: 'C',
        division: 'Varsity',
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
      }),
    ];

    const upcoming = matches.filter(
      (m) => m.status !== 'Completed' && !m.forfeit && m.status !== 'Forfeit'
    );
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('m2-scheduled');
  });
});
