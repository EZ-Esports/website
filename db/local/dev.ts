/**
 * `next dev` pointed at the LOCAL database, no matter what `.env` says.
 *
 * Next.js lets variables already in the process environment win over `.env`, so this sets DATABASE_URL to the
 * loopback URL before starting the dev server. It refuses to start when that URL is not loopback. The rest of
 * `.env` still loads (Supabase sign-in keys, for example), so signing in goes to the Supabase project in `.env`;
 * only Postgres is local. Anything that calls Supabase directly (invite emails, student ID storage) still uses it.
 *
 *   npm run dev:local
 */
import { spawn } from 'child_process';
import { requireLocalUrl } from './target';

const url = requireLocalUrl();
console.log(`Starting next dev with DATABASE_URL=${url} (local, from this script; .env's DATABASE_URL is ignored).`);

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev'], {
  stdio: 'inherit',
  // One connection: the local server is PGlite (a single connection); more would interleave protocol messages.
  env: { ...process.env, DATABASE_URL: url, DATABASE_POOL_MAX: '1' },
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
