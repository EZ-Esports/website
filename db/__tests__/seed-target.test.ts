/**
 * The production interlock on the two destructive seeds.
 *
 * The cases that matter most here are the ones where the answer is "I don't
 * know", because the guard's whole value rests on those failing closed. A
 * host-detector that quietly answers "local" on a string it could not parse is
 * worse than no guard at all: it reads as protection while authorising exactly
 * the run it was added to stop.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { seedTargetHost, assertSeedTargetAllowed, ALLOW_REMOTE_ENV } from '../seed-target';

describe('seedTargetHost', () => {
  it.each([
    ['postgresql://u:pw@localhost:5432/app', 'localhost'],
    ['postgres://u:pw@127.0.0.1:5432/app', '127.0.0.1'],
    ['postgresql://u:pw@127.7.7.7:5432/app', '127.7.7.7'],
    ['postgresql://u:pw@[::1]:5432/app', '::1'],
    ['POSTGRESQL://u:pw@LOCALHOST:5432/app', 'localhost'],
    ['postgresql://u:pw@db.abcdef.supabase.co:5432/postgres', 'db.abcdef.supabase.co'],
    ['postgresql://u:pw@h:5432/d?sslmode=require', 'h'],
    // Passwords containing characters that trip naive URL splitting.
    ['postgresql://u:p%40ss@h:5432/d', 'h'],
    ['postgresql://u:p%2Fss@h:5432/d', 'h'],
    // No host at all is libpq's local socket.
    ['postgresql:///app', 'localhost'],
    ['postgresql://u:pw@%2Fvar%2Frun%2Fpostgresql/d', 'localhost'],
    // Keyword/value DSNs.
    ['host=db.example.com port=5432 dbname=app', 'db.example.com'],
    ['dbname=app user=postgres', 'localhost'],
    ['host=/var/run/postgresql dbname=app', 'localhost'],
  ])('reads the host out of %s', (url, expected) => {
    expect(seedTargetHost(url)).toBe(expected);
  });

  it.each([
    ['', 'an empty string'],
    ['   ', 'whitespace'],
    ['mydb', 'a bare database name'],
    ['not a connection string at all', 'prose'],
    ['mysql://u:pw@h:3306/d', 'a non-postgres scheme'],
    ['postgresql://u:pw@h1:5432,h2:5432/d', 'a multi-host string'],
  ])('returns undefined for %s (%s)', (url) => {
    expect(seedTargetHost(url)).toBeUndefined();
  });
});

describe('assertSeedTargetAllowed', () => {
  const saved = process.env[ALLOW_REMOTE_ENV];
  beforeEach(() => {
    delete process.env[ALLOW_REMOTE_ENV];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[ALLOW_REMOTE_ENV];
    else process.env[ALLOW_REMOTE_ENV] = saved;
  });

  it.each([
    'postgresql://postgres@localhost:5432/app',
    'postgresql://postgres@127.0.0.1:55433/pr1_seedfix',
    'postgresql://postgres@[::1]:5432/app',
    'postgresql:///app',
  ])('allows loopback target %s with no opt-in', (url) => {
    expect(() => assertSeedTargetAllowed(url)).not.toThrow();
  });

  it('refuses a remote target with no opt-in', () => {
    expect(() => assertSeedTargetAllowed('postgresql://u:pw@db.abc.supabase.co:5432/postgres'))
      .toThrow(/not loopback/);
  });

  it('names the host to set in the refusal, so the fix is copy-pasteable', () => {
    expect(() => assertSeedTargetAllowed('postgresql://u:pw@db.abc.supabase.co:5432/postgres'))
      .toThrow(/SEED_ALLOW_REMOTE=db\.abc\.supabase\.co/);
  });

  it('allows a remote target when the opt-in names that exact host', () => {
    process.env[ALLOW_REMOTE_ENV] = 'db.abc.supabase.co';
    expect(() => assertSeedTargetAllowed('postgresql://u:pw@db.abc.supabase.co:5432/postgres'))
      .not.toThrow();
  });

  it('refuses when the opt-in names a different host', () => {
    process.env[ALLOW_REMOTE_ENV] = 'db.staging.supabase.co';
    expect(() => assertSeedTargetAllowed('postgresql://u:pw@db.prod.supabase.co:5432/postgres'))
      .toThrow(/was not the one authorised/);
  });

  // The blanket-value case is the reason the opt-in is a hostname. `=1` left in
  // a shell profile would otherwise authorise every future run of both seeds
  // against every database, forever.
  it.each(['1', 'true', 'yes', '*'])('refuses a blanket opt-in value %s', (value) => {
    process.env[ALLOW_REMOTE_ENV] = value;
    expect(() => assertSeedTargetAllowed('postgresql://u:pw@db.prod.supabase.co:5432/postgres'))
      .toThrow();
  });

  it('refuses a target it cannot parse, even with an opt-in set', () => {
    process.env[ALLOW_REMOTE_ENV] = 'localhost';
    expect(() => assertSeedTargetAllowed('something unparseable')).toThrow(/unrecognised host/);
  });

  it('refuses when DATABASE_URL is unset', () => {
    expect(() => assertSeedTargetAllowed(undefined)).toThrow(/DATABASE_URL is not set/);
  });
});
