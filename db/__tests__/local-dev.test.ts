import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { applyMigrations } from './helpers/pglite-migrations';
import { requireLocalUrl, DEFAULT_LOCAL_URL } from '../local/target';
import { parseServerArgs, THROUGH_CHOICES } from '../local/server';
import { seedSample } from '../local/seed-sample';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

describe('local-dev target guard', () => {
  it('defaults to the loopback URL and ignores DATABASE_URL entirely', () => {
    expect(requireLocalUrl({ DATABASE_URL: 'postgres://u:p@db.prod.example.com/postgres' } as never)).toBe(DEFAULT_LOCAL_URL);
  });

  it('accepts only loopback hosts, even with SEED_ALLOW_REMOTE set', () => {
    expect(requireLocalUrl({ LOCAL_DATABASE_URL: 'postgres://postgres:postgres@localhost:5555/x' } as never)).toContain('localhost');
    expect(() =>
      requireLocalUrl({ LOCAL_DATABASE_URL: 'postgres://u:p@db.prod.example.com:5432/postgres', SEED_ALLOW_REMOTE: 'db.prod.example.com' } as never),
    ).toThrow(/loopback/);
  });

  it('parses server flags and rejects unknown ones', () => {
    expect(parseServerArgs([])).toEqual({ through: '0061', fresh: false, port: 54329 });
    expect(parseServerArgs(['--through', '0062', '--fresh', '--port', '54400'])).toEqual({ through: '0062', fresh: true, port: 54400 });
    expect(() => parseServerArgs(['--through', '0099'])).toThrow();
    expect(() => parseServerArgs(['--nope'])).toThrow(/Unknown/);
  });
});

describe.each([['0061'], ['0062']] as const)('sample data over the socket server (schema through %s)', (through) => {
  let pg: PGlite;
  let server: PGLiteSocketServer;
  let sql: postgres.Sql;

  beforeAll(async () => {
    pg = new PGlite();
    await applyMigrations(pg, { through: THROUGH_CHOICES[through] });
    server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 4 });
    await server.start();
    const conn = server.getServerConn();
    const port = Number(conn.split(':').pop());
    sql = postgres(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, { prepare: false, max: 1, onnotice: () => {} });
  });
  afterAll(async () => {
    await sql.end({ timeout: 2 });
    await server.stop();
    await pg.close();
  });

  it('seeds the league, and a second run refuses', async () => {
    await seedSample(sql);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from season_schools`;
    expect(n).toBe(8 + 6 + 3); // Valorant 2026-27, Valorant 2025-26, LoL 2026-27
    const [{ r }] = await sql<{ r: number }[]>`select count(*)::int as r from rosters`;
    expect(r).toBeGreaterThan(30);
    await expect(seedSample(sql)).rejects.toThrow(/already has games/);
  });

  it('leaves the two Add school cases to try: a school in no season, and one with rosters but no membership', async () => {
    const rows = await sql<{ name: string; memberships: number; rosters: number }[]>`
      select s.name,
        (select count(*)::int from season_schools m where m.school_id = s.id) as memberships,
        (select count(*)::int from rosters r where r.school_id = s.id) as rosters
      from schools s where s.name in ('Gamma Sample HS', 'Removed Sample HS') order by s.name`;
    expect(rows).toEqual([
      { name: 'Gamma Sample HS', memberships: 0, rosters: 0 },
      { name: 'Removed Sample HS', memberships: 0, rosters: 2 },
    ]);
  });
});
