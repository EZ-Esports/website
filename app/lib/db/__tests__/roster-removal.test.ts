import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import {
  cleanupOrphanMember,
  isMissingRelationError,
  KEEP_REASON_TEXT,
  removalCacheTags,
  removalNotice,
  removePlayerFromRosterTx,
  type RosterRemovalResult,
} from '../roster-removal';
import { rosterRemovalConfirmMessage } from '@/app/lib/roster-removal-copy';

/**
 * A scripted transaction. `select` answers per table name (a function receives the 1-based call
 * number for that table, so the two reads of `matches` can differ); `delete` answers from
 * `deleted`. Every statement is appended to `log`. A nested `transaction` is a savepoint: if its
 * callback throws, the statements it logged are dropped and 'ROLLBACK SAVEPOINT' is logged.
 */
const state = {
  log: [] as string[],
  selects: {} as Record<string, unknown[] | ((call: number) => unknown[])>,
  deleted: {} as Record<string, unknown[]>,
  fail: {} as Record<string, unknown>,
  calls: {} as Record<string, number>,
};

function makeTx() {
  const tx: Record<string, unknown> = {
    select: () => ({
      from: (table: unknown) => {
        const name = getTableName(table as never);
        let locked = false;
        const run = () => {
          // The keep-checks are ONE select (EXISTS subqueries) on `members` after the lock. The script
          // stays per table: a table's rows make its flag true, a scripted failure for it throws.
          if (name === 'members' && !locked) {
            const flag = (...tables: string[]) => {
              for (const t of tables) {
                state.calls[t] = (state.calls[t] ?? 0) + 1;
                if (state.fail[`select:${t}`]) throw state.fail[`select:${t}`];
              }
              return tables.some((t) => {
                const s = state.selects[t];
                return (typeof s === 'function' ? s(state.calls[t]) : (s ?? [])).length > 0;
              });
            };
            state.log.push('select keep-checks');
            return [{
              otherRoster: flag('players'), staff: flag('staff_members'), schoolManager: flag('school_managers'),
              managerInvite: flag('manager_invites'), leadership: flag('leadership'), people: flag('people'),
            }];
          }
          state.calls[name] = (state.calls[name] ?? 0) + 1;
          state.log.push(`select ${name}`);
          if (state.fail[`select:${name}`]) throw state.fail[`select:${name}`];
          const s = state.selects[name];
          return typeof s === 'function' ? s(state.calls[name]) : (s ?? []);
        };
        // `from` may be followed by joins, `.where()`, `.for('update')` and `.limit()` in any mix.
        const chain: Record<string, unknown> = {};
        const thenable = () => Promise.resolve().then(run);
        for (const k of ['innerJoin', 'where', 'for', 'limit']) {
          chain[k] = (...args: unknown[]) => {
            void args;
            if (k === 'for') { locked = true; state.log.push(`lock ${name}`); }
            return chain;
          };
        }
        chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => thenable().then(res, rej);
        return chain;
      },
    }),
    delete: (table: unknown) => {
      const name = getTableName(table as never);
      return {
        where: () => ({
          returning: async () => {
            state.log.push(`delete ${name}`);
            if (state.fail[`delete:${name}`]) throw state.fail[`delete:${name}`];
            return state.deleted[name] ?? [{ id: 'row' }];
          },
        }),
      };
    },
    transaction: async (cb: (t: unknown) => Promise<unknown>) => {
      const mark = state.log.length;
      try {
        return await cb(tx);
      } catch (e) {
        state.log.splice(mark);
        state.log.push('ROLLBACK SAVEPOINT');
        throw e;
      }
    },
  };
  return tx as never;
}

const MEMBER = { id: 'm1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', memberKey: null };
// Drizzle wraps the driver error; Postgres' own message (with the quoted relation) is on `cause`.
const missing = (code: string, table: string) =>
  Object.assign(new Error('Failed query'), { cause: { code, message: `relation "${table}" does not exist` } });

beforeEach(() => {
  state.log = [];
  state.selects = { members: [MEMBER] };
  state.deleted = { players: [{ memberId: 'm1', ign: 'Ada#NA1' }] };
  state.fail = {};
  state.calls = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const deletes = () => state.log.filter((l) => l.startsWith('delete '));

describe('removePlayerFromRosterTx: orphan', () => {
  it('deletes the roster spot, then the leftovers, then the member, in that order', async () => {
    state.deleted.onboarding_consents = [{ id: 1 }, { id: 2 }];
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toEqual({
      removed: true,
      memberId: 'm1',
      studentRecord: 'deleted',
      deleted: { consents: 2, demographics: 1, identities: 1, contentFlags: 1, invites: 1 },
    });
    expect(deletes()).toEqual([
      'delete players',
      'delete onboarding_consents',
      'delete student_demographics',
      'delete player_identities',
      'delete onboarding_content_flags',
      'delete player_invites',
      'delete members',
    ]);
  });

  it('locks the member row before it looks at any other table', async () => {
    await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    const lock = state.log.indexOf('lock members');
    const firstCheck = state.log.indexOf('select keep-checks');
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(firstCheck);
  });

  it('a stale player row (already gone or moved) does nothing else', async () => {
    state.deleted.players = [];
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toEqual({ removed: false });
    expect(state.log).toEqual(['delete players']);
  });
});

describe('removePlayerFromRosterTx: member is kept', () => {
  async function keptBecause(reason: string) {
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toEqual({ removed: true, memberId: 'm1', studentRecord: 'kept', keptReason: reason });
    // Only the roster spot was deleted: no onboarding record and no member row.
    expect(deletes()).toEqual(['delete players']);
  }

  it('still on another roster (any team or season)', async () => {
    state.selects.players = [{ id: 'other' }];
    await keptBecause('other_roster');
  });

  it('linked to a staff member by member id or email', async () => {
    state.selects.staff_members = [{ id: 'u1' }];
    await keptBecause('staff');
  });

  it('a school manager, or holding a manager invite', async () => {
    state.selects.school_managers = [{ id: 's1' }];
    await keptBecause('school_manager');
    state.log = [];
    state.selects = { members: [MEMBER], manager_invites: [{ id: 'i1' }] };
    await keptBecause('school_manager');
  });

  it('has a leadership or people profile', async () => {
    state.selects.leadership = [{ id: 'l1' }];
    await keptBecause('profile');
    state.log = [];
    state.selects = { members: [MEMBER], people: [{ id: 'p1' }] };
    await keptBecause('profile');
  });

  it('is a gold-archive member', async () => {
    state.selects.members = [{ ...MEMBER, memberKey: 'school|ada|lovelace' }];
    await keptBecause('archive_member');
  });

  it('the removed roster has a scored or played match', async () => {
    state.selects.matches = (call) => (call === 1 ? [{ id: 'match' }] : []);
    await keptBecause('match_history');
  });

  it('the removed roster has stored game data', async () => {
    state.selects.match_games = [{ id: 'g' }];
    await keptBecause('match_history');
  });

  it('their name or in-game name is on a standings row', async () => {
    state.selects.season_standings = [{ id: 's' }];
    await keptBecause('match_history');
  });

  it('their name is the recorded match MVP', async () => {
    state.selects.matches = (call) => (call === 2 ? [{ id: 'match' }] : []);
    await keptBecause('match_history');
  });

  it('their in-game or Riot name is on a stored Valorant scoreboard', async () => {
    state.selects.valorant_game_players = [{ id: 'v' }];
    await keptBecause('match_history');
  });

  it('checks Riot identities of the member as well as the in-game name', async () => {
    state.selects.player_identities = [{ id: 'Ada#NA1' }];
    state.selects.valorant_game_players = [{ id: 'v' }];
    await keptBecause('match_history');
    expect(state.log).toContain('select player_identities');
  });

  it('member already gone: nothing more to delete', async () => {
    state.selects.members = [];
    await keptBecause('member_missing');
  });

  it('does not run any later check once a reason is found', async () => {
    state.selects.players = [{ id: 'other' }];
    await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(state.log).not.toContain('select staff_members');
    expect(state.log).not.toContain('select matches');
  });
});

describe('fail-closed and missing tables', () => {
  it('a history table or delete target missing from this database (42P01 naming it) is treated as empty', async () => {
    for (const t of ['match_games', 'season_standings', 'valorant_game_players']) {
      state.fail[`select:${t}`] = missing('42P01', t);
    }
    state.fail['delete:onboarding_consents'] = missing('42P01', 'onboarding_consents');
    state.selects.player_identities = [{ id: 'Ada#NA1' }];
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toMatchObject({ removed: true, studentRecord: 'deleted', deleted: { consents: 0 } });
    expect(deletes()).toContain('delete members');
  });

  it('a missing column (42703) on an optional table is treated like a missing table', async () => {
    state.fail['select:season_standings'] = missing('42703', 'season_standings');
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toMatchObject({ studentRecord: 'deleted' });
  });

  it('a missing table that is NOT the one being read does not count as "optional table absent"', async () => {
    state.fail['select:season_standings'] = missing('42P01', 'some_other_table');
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toMatchObject({ studentRecord: 'kept', keptReason: 'cleanup_error' });
  });

  it.each(['players', 'staff_members', 'school_managers', 'manager_invites', 'leadership', 'people', 'player_identities'])(
    'keep-checks fail closed: %s missing keeps the member and deletes nothing else',
    async (table) => {
      state.fail[`select:${table}`] = missing('42P01', table);
      const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
      expect(result).toEqual({ removed: true, memberId: 'm1', studentRecord: 'kept', keptReason: 'cleanup_error' });
      expect(deletes()).toEqual(['delete players']);
    },
  );

  it('any other error keeps the member, rolls the cleanup back and keeps the roster removal', async () => {
    state.fail['select:season_standings'] = Object.assign(new Error('deadlock'), { code: '40P01' });
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toEqual({ removed: true, memberId: 'm1', studentRecord: 'kept', keptReason: 'cleanup_error' });
    expect(state.log).toContain('ROLLBACK SAVEPOINT');
    expect(deletes()).toEqual(['delete players']);
    expect(String(vi.mocked(console.error).mock.calls.at(-1)?.join(' '))).toContain('40P01');
  });

  it('a failure halfway through the deletes undoes the ones already done', async () => {
    state.fail['delete:player_invites'] = Object.assign(new Error('boom'), { code: '23503' });
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toMatchObject({ studentRecord: 'kept', keptReason: 'cleanup_error' });
    expect(deletes()).toEqual(['delete players']);
  });

  it('the member row delete must hit exactly one row', async () => {
    state.deleted.members = [];
    const result = await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(result).toMatchObject({ studentRecord: 'kept', keptReason: 'cleanup_error' });
    expect(deletes()).toEqual(['delete players']);
  });

  it('isMissingRelationError sees the Postgres code through drizzle\'s cause wrapper', () => {
    expect(isMissingRelationError(missing('42P01', 'match_games'), 'match_games')).toBe(true);
    expect(isMissingRelationError(missing('42703', 'match_games'), 'match_games')).toBe(true);
    expect(isMissingRelationError(missing('42P01', 'people'), 'match_games')).toBe(false);
    expect(isMissingRelationError(missing('23505', 'match_games'), 'match_games')).toBe(false);
    expect(isMissingRelationError(new Error('x'), 'match_games')).toBe(false);
  });
});

describe('cleanupOrphanMember (roster delete path)', () => {
  it('keeps a member who is still on a different roster', async () => {
    state.selects.players = [{ id: 'other' }];
    expect(await cleanupOrphanMember(makeTx(), { memberId: 'm1', rosterId: 'r1' })).toEqual({
      studentRecord: 'kept',
      keptReason: 'other_roster',
    });
    expect(deletes()).toEqual([]);
  });

  it('deletes an orphan', async () => {
    const out = await cleanupOrphanMember(makeTx(), { memberId: 'm1', rosterId: 'r1' });
    expect(out.studentRecord).toBe('deleted');
  });
});

describe('invite handling', () => {
  it('deletes the member\'s player invites instead of resetting them (a spent token must never work again)', async () => {
    await removePlayerFromRosterTx(makeTx(), { playerId: 'p1', rosterId: 'r1' });
    expect(deletes()).toContain('delete player_invites');
    // The manager invite table is only read (a manager invite means the member is kept), never deleted.
    expect(deletes()).not.toContain('delete manager_invites');
  });
});

describe('outcome wording and cache tags', () => {
  const deleted: RosterRemovalResult = {
    removed: true, memberId: 'm1', studentRecord: 'deleted',
    deleted: { consents: 1, demographics: 1, identities: 1, contentFlags: 1, invites: 1 },
  };
  const kept: RosterRemovalResult = { removed: true, memberId: 'm1', studentRecord: 'kept', keptReason: 'match_history' };

  it('says what happened to the student record', () => {
    expect(removalNotice(deleted, 'Ada Lovelace')).toBe(
      'Ada Lovelace was removed from the roster and their onboarding record was deleted.');
    expect(removalNotice(kept, 'Ada Lovelace')).toBe(
      'Ada Lovelace was removed from the roster. Their student record was kept because they have match history.');
    expect(removalNotice({ removed: false })).toMatch(/already removed/);
  });

  it('every keep reason has plain wording', () => {
    for (const text of Object.values(KEEP_REASON_TEXT)) expect(text.length).toBeGreaterThan(5);
  });

  it('members tag is refreshed only when a member was deleted; rosters then players come first', () => {
    expect(removalCacheTags(kept)).toEqual(['rosters', 'players']);
    expect(removalCacheTags({ removed: false })).toEqual(['rosters', 'players']);
    expect(removalCacheTags(deleted)).toEqual(['rosters', 'players', 'members']);
  });
});

describe('confirmation copy', () => {
  const msg = rosterRemovalConfirmMessage('Ada Lovelace', 'Varsity');

  it('names the player and roster and says the removal is permanent', () => {
    expect(msg).toContain('Remove Ada Lovelace from Varsity?');
    expect(msg).toContain('This will remove them permanently.');
  });

  it('says it cannot be undone', () => {
    expect(msg).toContain('This action cannot be undone.');
  });
});
