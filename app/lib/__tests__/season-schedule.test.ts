import { describe, expect, it } from 'vitest';
import {
  addWeeksYmd,
  generateRegularSeasonRounds,
  isValidYmd,
  kickoffForRound,
  scheduleFingerprint,
  validateParticipantCount,
} from '../season-schedule';
import { buildSeasonPlan } from '../season-generation';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `school-${String(i).padStart(2, '0')}`);

describe('validateParticipantCount', () => {
  it('rejects fewer than 8, odd counts, and accepts even counts from 8', () => {
    expect(validateParticipantCount(0)).toMatch(/at least 8/);
    expect(validateParticipantCount(6)).toMatch(/at least 8/);
    expect(validateParticipantCount(9)).toMatch(/odd number/);
    expect(validateParticipantCount(15)).toMatch(/Add one school or remove one/);
    for (const n of [8, 10, 12, 20, 30]) expect(validateParticipantCount(n)).toBeNull();
  });
});

describe('generateRegularSeasonRounds', () => {
  for (const n of [8, 10, 12, 14, 16, 22, 30]) {
    it(`gives every one of ${n} schools exactly 7 distinct opponents, once per round`, () => {
      const schools = ids(n);
      const rounds = generateRegularSeasonRounds(schools, 'seed');
      expect(rounds).toHaveLength(7);

      const opponents = new Map<string, Set<string>>(schools.map((s) => [s, new Set()]));
      let total = 0;
      for (const round of rounds) {
        const seenThisRound = new Set<string>();
        expect(round.pairs).toHaveLength(n / 2);
        for (const { homeId, awayId } of round.pairs) {
          expect(homeId).not.toBe(awayId);
          expect(seenThisRound.has(homeId)).toBe(false);
          expect(seenThisRound.has(awayId)).toBe(false);
          seenThisRound.add(homeId);
          seenThisRound.add(awayId);
          expect(opponents.get(homeId)!.has(awayId)).toBe(false);
          opponents.get(homeId)!.add(awayId);
          opponents.get(awayId)!.add(homeId);
          total++;
        }
        expect(seenThisRound.size).toBe(n);
      }
      expect(total).toBe((n * 7) / 2);
      for (const set of opponents.values()) expect(set.size).toBe(7);
    });
  }

  it('is deterministic for a seed, independent of input order, and varies with the seed', () => {
    const a = generateRegularSeasonRounds(ids(12), 's1');
    expect(generateRegularSeasonRounds(ids(12), 's1')).toEqual(a);
    expect(generateRegularSeasonRounds([...ids(12)].reverse(), 's1')).toEqual(a);
    expect(generateRegularSeasonRounds(ids(12), 's2')).not.toEqual(a);
  });

  it('keeps home games roughly balanced', () => {
    const rounds = generateRegularSeasonRounds(ids(16), 'x');
    const home = new Map<string, number>();
    for (const r of rounds) for (const p of r.pairs) home.set(p.homeId, (home.get(p.homeId) ?? 0) + 1);
    for (const h of home.values()) {
      expect(h).toBeGreaterThanOrEqual(2);
      expect(h).toBeLessThanOrEqual(5);
    }
  });

  it('throws clear errors for odd, too few, and duplicate schools', () => {
    expect(() => generateRegularSeasonRounds(ids(9))).toThrow(/odd number/);
    expect(() => generateRegularSeasonRounds(ids(6))).toThrow(/at least 8/);
    expect(() => generateRegularSeasonRounds([...ids(7), 'school-00'])).toThrow(/only be selected once/);
  });
});

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidYmd('2026-11-02')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('11/02/2026')).toBe(false);
  });

  it('adds weeks as pure date arithmetic', () => {
    expect(addWeeksYmd('2026-10-26', 1)).toBe('2026-11-02');
    expect(addWeeksYmd('2026-12-28', 1)).toBe('2027-01-04');
  });

  it('keeps 7:00 PM Eastern across the November DST change', () => {
    // Sunday 1 Nov 2026 is the fall-back day: 7 PM EDT is 23:00Z before, 7 PM EST is 00:00Z after.
    expect(kickoffForRound('2026-10-28', 1).toISOString()).toBe('2026-10-28T23:00:00.000Z');
    expect(kickoffForRound('2026-10-28', 2).toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });
});

describe('buildSeasonPlan', () => {
  const schools = ids(8).map((id) => ({ id, name: `Name ${id}` }));
  const base = { seasonId: 'season-1', startYmd: '2026-11-02', division: 'Varsity' as const, schools };

  it('creates teams and rosters only for what is missing (idempotent for existing ones)', () => {
    const plan = buildSeasonPlan({
      ...base,
      existingTeams: [
        { id: 't0', schoolId: 'school-00' },
        { id: 't1', schoolId: 'school-01' },
      ],
      existingRosters: [
        { id: 'r0', teamId: 't0', name: 'Varsity', division: 'A' },
        { id: 'r1', teamId: 't1', name: 'JV', division: 'B' },
      ],
    });
    expect(plan.teamsToCreate.map((s) => s.id)).not.toContain('school-00');
    expect(plan.teamsToCreate).toHaveLength(6);
    // school-01 has a team but only a JV roster, so it still needs a Varsity one.
    expect(plan.rostersToCreate.map((s) => s.id)).toContain('school-01');
    expect(plan.rostersToCreate.map((s) => s.id)).not.toContain('school-00');
    expect(plan.rosterDivision).toBe('A');
  });

  it('plans 28 matches, 7 per school, on weekly 7 PM ET kickoffs', () => {
    const plan = buildSeasonPlan({ ...base, existingTeams: [], existingRosters: [] });
    expect(plan.matches).toHaveLength(28);
    for (const s of schools) expect(plan.matchesPerSchool[s.id]).toBe(7);
    expect(new Set(plan.matches.map((m) => m.kickoff.toISOString())).size).toBe(7);
  });

  it('fingerprint is stable and changes with date, division or pairing', () => {
    const a = buildSeasonPlan({ ...base, existingTeams: [], existingRosters: [] });
    const b = buildSeasonPlan({ ...base, existingTeams: [], existingRosters: [] });
    const c = buildSeasonPlan({ ...base, startYmd: '2026-11-09', existingTeams: [], existingRosters: [] });
    const d = buildSeasonPlan({ ...base, division: 'JV', existingTeams: [], existingRosters: [] });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(c.fingerprint).not.toBe(a.fingerprint);
    expect(d.fingerprint).not.toBe(a.fingerprint);
    expect(scheduleFingerprint([], 'x')).toHaveLength(8);
  });

  describe('existing teams and rosters never error and are left untouched', () => {
    const plan = (rosters: Array<{ id: string; teamId: string; name: string; division: string }>, teams = [{ id: 't0', schoolId: 'school-00' }]) =>
      buildSeasonPlan({ ...base, existingTeams: teams, existingRosters: rosters });
    const created = (p: ReturnType<typeof plan>) => p.rostersToCreate.find((s) => s.id === 'school-00');

    it('(a) reuses a team with a roster in the division', () => {
      const p = plan([{ id: 'r0', teamId: 't0', name: 'Main', division: 'A' }]);
      expect(p.reusedRosters).toEqual([{ id: 'school-00', name: 'Name school-00', rosterName: 'Main' }]);
      expect(created(p)).toBeUndefined();
      expect(p.teamsToCreate.map((s) => s.id)).not.toContain('school-00');
    });

    it('(a) with several rosters in the division, deterministically uses the first by name', () => {
      const p = plan([
        { id: 'r1', teamId: 't0', name: 'Beta', division: 'A' },
        { id: 'r0', teamId: 't0', name: 'Alpha', division: 'Varsity' },
      ]);
      expect(p.reusedRosters[0].rosterName).toBe('Alpha');
      expect(created(p)).toBeUndefined();
    });

    it('(b) creates only the roster when the team has none in the division', () => {
      const p = plan([{ id: 'r0', teamId: 't0', name: 'JV', division: 'B' }]);
      expect(created(p)?.rosterName).toBe('Varsity');
      expect(p.teamsToCreate.map((s) => s.id)).not.toContain('school-00');
    });

    it('(c) creates team and roster when the school has no team', () => {
      const p = plan([], []);
      expect(p.teamsToCreate.map((s) => s.id)).toContain('school-00');
      expect(created(p)?.rosterName).toBe('Varsity');
      expect(p.reusedRosters).toHaveLength(0);
    });

    it('(d) picks a non-colliding name when the division name is taken by another division', () => {
      const p = plan([
        { id: 'r0', teamId: 't0', name: 'Varsity', division: 'B' },
        { id: 'r1', teamId: 't0', name: 'Varsity 2', division: 'B' },
      ]);
      expect(created(p)?.rosterName).toBe('Varsity 3');
    });
  });
});
