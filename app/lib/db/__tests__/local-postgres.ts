/**
 * Helpers for tests (and dev tooling) that need a REAL Postgres. Only a loopback database is ever
 * accepted, so a stray production DATABASE_URL can never be used by accident.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export function isLoopbackUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

/** The part of Supabase the migrations reference (roles, `auth` schema), for a plain Postgres. */
const SUPABASE_SHIM = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select 'authenticated'::text $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
create schema if not exists storage;
`;

/** Applies every real migration in `db/migrations` to a loopback database. Idempotent. */
export async function migrateLocal(url: string): Promise<number> {
  if (!isLoopbackUrl(url)) throw new Error('migrateLocal only accepts a loopback database URL.');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(SUPABASE_SHIM);
    await migrate(drizzle(sql), { migrationsFolder: 'db/migrations' });
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return row.n;
  } finally {
    await sql.end();
  }
}
